import * as THREE from 'three';

/**
 * L10 minimal shared Mochi material prototype.
 * One blob + one glyph "O" -> raster mask -> signed distance field -> inflated normals
 * -> ONE ShaderMaterial (same shader + same analytic softbox environment).
 */

const SIZE = 512;   // SDF texture resolution
const S = SIZE / 256; // shapes/thickness are authored in 256-px units
const RANGE = 64 * S;   // SDF encode range (texels)

// ---------- SDF (chamfer distance transform, same idea as src/letter-extraction.ts) ----------
function edt1d(f: Float64Array, n: number, out: Float64Array) {
  // Felzenszwalb-Huttenlocher exact squared Euclidean distance (lower envelope of parabolas)
  const v = new Int32Array(n), z = new Float64Array(n + 1);
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let sx: number;
    while (true) {
      const p = v[k];
      sx = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
      if (sx <= z[k] && k > 0) k--; else break;
    }
    if (sx <= z[k]) { v[k] = q; z[k] = -1e20; z[k + 1] = 1e20; continue; }
    k++; v[k] = q; z[k] = sx; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    out[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

// exact Euclidean distance to nearest `on` pixel
function chamfer(on: Uint8Array): Float32Array {
  const g = new Float64Array(SIZE * SIZE);
  for (let i = 0; i < g.length; i++) g[i] = on[i] ? 0 : 1e10;
  const f = new Float64Array(SIZE), o = new Float64Array(SIZE);
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) f[y] = g[y * SIZE + x];
    edt1d(f, SIZE, o);
    for (let y = 0; y < SIZE; y++) g[y * SIZE + x] = o[y];
  }
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) f[x] = g[y * SIZE + x];
    edt1d(f, SIZE, o);
    for (let x = 0; x < SIZE; x++) g[y * SIZE + x] = o[x];
  }
  const d = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < d.length; i++) d[i] = Math.sqrt(g[i]);
  return d;
}

function sdfTexture(draw: (ctx: CanvasRenderingContext2D) => void): THREE.DataTexture {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = '#fff';
  ctx.scale(S, S);
  draw(ctx);
  const px = ctx.getImageData(0, 0, SIZE, SIZE).data;
  const inside = new Uint8Array(SIZE * SIZE);
  const outside = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < inside.length; i++) { inside[i] = px[i * 4] > 127 ? 1 : 0; outside[i] = 1 - inside[i]; }
  const dOut = chamfer(inside);   // distance to nearest inside pixel (for outside pixels)
  const dIn = chamfer(outside);   // distance to nearest outside pixel (for inside pixels)
  let sd = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < sd.length; i++) sd[i] = inside[i] ? dIn[i] - 0.5 : -(dOut[i] - 0.5);
  // separable box blur, radius R (edge-clamped)
  const tmp = new Float32Array(sd.length);
  const blur = (src: Float32Array, dst: Float32Array, stride: number, lineStride: number, R: number) => {
    for (let l = 0; l < SIZE; l++) {
      const base = l * lineStride;
      let acc = 0;
      for (let k = -R; k <= R; k++) acc += src[base + Math.min(SIZE - 1, Math.max(0, k)) * stride];
      for (let i = 0; i < SIZE; i++) {
        dst[base + i * stride] = acc / (2 * R + 1);
        acc += src[base + Math.min(SIZE - 1, i + R + 1) * stride] - src[base + Math.max(0, i - R) * stride];
      }
    }
  };
  for (let pass = 0; pass < 3; pass++) { blur(sd, tmp, 1, SIZE, 5); blur(tmp, sd, SIZE, 1, 5); }
  const maxD = sd.reduce((m, v) => Math.max(m, v), 0); // medial-axis radius (texels)
  // Inflation field: Poisson problem  lap(u) = -1 inside, u = 0 outside  (Dirichlet), solved at half
  // resolution by red-black SOR. u is smooth across the medial axis (no crease, unlike f(distance)).
  const G = SIZE / 2, u = new Float32Array(G * G), inM = new Uint8Array(G * G);
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) inM[y * G + x] = sd[2 * y * SIZE + 2 * x] > 0 ? 1 : 0;
  const omega = 2 / (1 + Math.sin(Math.PI / G));
  for (let it = 0; it < 500; it++) for (let color = 0; color < 2; color++) {
    for (let y = 1; y < G - 1; y++) for (let x = 1 + ((y + color) & 1); x < G - 1; x += 2) {
      const i = y * G + x;
      if (!inM[i]) continue;
      u[i] += omega * ((u[i - 1] + u[i + 1] + u[i - G] + u[i + G] + 1) * 0.25 - u[i]);
    }
  }
  const uMax = u.reduce((m, v) => Math.max(m, v), 1e-6);
  // bounded-slope root:  h = (sqrt(q + e^2) - e) / (sqrt(1 + e^2) - e),  q = u / uMax,  e = 0.3
  const eps = 0.3, hn = Math.sqrt(1 + eps * eps) - eps;
  const hG = new Float32Array(G * G);
  for (let i = 0; i < hG.length; i++) hG[i] = (Math.sqrt(u[i] / uMax + eps * eps) - eps) / hn;
  // bilinear upsample G -> SIZE, then a light blur (r=3, 2 passes) to hide the G-grid boundary steps
  const H = new Float32Array(sd.length);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const fx = Math.min(G - 1, Math.max(0, (x + 0.5) / 2 - 0.5)), fy = Math.min(G - 1, Math.max(0, (y + 0.5) / 2 - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(G - 1, x0 + 1), y1 = Math.min(G - 1, y0 + 1);
    const tx = fx - x0, ty = fy - y0;
    H[y * SIZE + x] = (hG[y0 * G + x0] * (1 - tx) + hG[y0 * G + x1] * tx) * (1 - ty) + (hG[y1 * G + x0] * (1 - tx) + hG[y1 * G + x1] * tx) * ty;
  }
  for (let pass = 0; pass < 2; pass++) { blur(H, tmp, 1, SIZE, 3); blur(tmp, H, SIZE, 1, 3); }
  const out = new Uint16Array(SIZE * SIZE * 2);
  for (let i = 0; i < SIZE * SIZE; i++) {
    out[2 * i] = THREE.DataUtils.toHalfFloat(Math.max(-RANGE, Math.min(RANGE, sd[i])));
    out[2 * i + 1] = THREE.DataUtils.toHalfFloat(H[i]);
  }
  const tex = new THREE.DataTexture(out, SIZE, SIZE, THREE.RGFormat, THREE.HalfFloatType);
  tex.userData.maxD = maxD;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

// ---------- organic blob contour: 20 spring-skin-like points, smoothed with midpoint quadratics ----------
function drawBlob(ctx: CanvasRenderingContext2D) {
  const N = 20, cx = 128, cy = 128;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 80 * (1 + 0.16 * Math.sin(a * 3 + 0.6) + 0.07 * Math.sin(a * 5 + 1.9));
    pts.push([cx + Math.cos(a) * r * 1.08, cy + Math.sin(a) * r * 0.92]);
  }
  ctx.beginPath();
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[N - 1], pts[0]);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < N; i++) {
    const m = mid(pts[i], pts[(i + 1) % N]);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  ctx.closePath();
  ctx.fill();
}

function drawO(ctx: CanvasRenderingContext2D) {
  ctx.font = '700 230px "Fredoka", "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText('O');
  const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  ctx.fillText('O', 128, 128 + h / 2 - m.actualBoundingBoxDescent);
}

// ---------- shared material ----------
const sharedTime = { value: 0 };

const vert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const frag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSdf;
uniform vec3 uColor;   // core color
uniform vec3 uRim;     // thin-edge color
uniform float uT;      // inflation radius in texels
uniform float uTime;
const float RANGE = ${RANGE}.0;
const float SIZE_ = ${SIZE}.0;

// screen-space uv (y up) -> signed distance in texels (inside positive)
float sd(vec2 p){ return texture2D(uSdf, vec2(p.x, 1.0 - p.y)).r; }
float hh(vec2 p){ return texture2D(uSdf, vec2(p.x, 1.0 - p.y)).g; }   // pre-blurred dome height
float box(vec2 p, vec2 hs, float soft){
  vec2 q = abs(p) - hs;
  return 1.0 - smoothstep(-soft, soft, length(max(q, 0.0)) + min(max(q.x, q.y), 0.0));
}

// shared analytic studio environment: violet room + crisp-edged glossy window boxes
vec3 envMap(vec3 r){
  vec3 c = mix(vec3(0.10, 0.06, 0.28), vec3(0.34, 0.26, 0.62), r.y * 0.5 + 0.5);
  c += vec3(1.00, 0.97, 1.00) * 1.4 * box(r.xy - vec2(-0.40, 0.52), vec2(0.22, 0.08), 0.20);   // main window
  c += vec3(1.00, 0.82, 0.96) * 0.40 * box(r.xy - vec2(-0.40, 0.52), vec2(0.45, 0.26), 0.40);   // its soft halo
  c += vec3(1.00, 0.55, 0.85) * 0.80 * box(r.xy - vec2(0.60, -0.38), vec2(0.07, 0.20), 0.15);   // pink strip
  c += vec3(0.50, 0.65, 1.00) * 0.55 * box(r.xy - vec2(0.05, -0.80), vec2(0.45, 0.06), 0.25);   // blue floor bounce
  c += vec3(1.00, 0.92, 1.00) * 0.45 * smoothstep(0.35, 0.90, r.y);                          // broad sky: bright curved rim on top edges
  c += vec3(0.95, 0.85, 1.00) * 0.30 * smoothstep(0.45, 0.95, -r.x);                         // left window wash
  c += vec3(1.00, 0.95, 1.00) * 1.10 * box(r.xy - vec2(0.52, -0.52), vec2(0.04, 0.16), 0.10); // secondary lower-right streak
  return c;
}
void main(){
  vec2 p = vUv;
  float e = 3.0 / SIZE_;
  float d  = sd(p);
  float mask = smoothstep(-0.8, 0.8, d);
  if (mask < 0.003) discard;

  // inflated normal from height-field gradient
  float h  = hh(p);
  // normal from the gradient of the smooth height field (height in texels = h * uT)
  vec2 gh = vec2(hh(p + vec2(e, 0.0)) - hh(p - vec2(e, 0.0)),
                 hh(p + vec2(0.0, e)) - hh(p - vec2(0.0, e))) / (2.0 * 3.0);
  vec3 n = normalize(vec3(-gh * uT * 0.45, 1.0));

  // very subtle living surface: low-frequency, material-space (uv) normal drift
  vec2 w = vec2(sin(p.y * 7.0 + uTime * 0.5 + sin(p.x * 4.0 + uTime * 0.3)),
                sin(p.x * 7.0 - uTime * 0.4 + sin(p.y * 4.0 - uTime * 0.25)));
  n = normalize(n + vec3(w * 0.035 * smoothstep(0.0, 0.5, h), 0.0));

  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L = normalize(vec3(-0.40, 0.60, 0.70));
  float thin = 1.0 - h;                           // 0 in thick core, 1 at rim

  // jelly body: saturated core -> pale luminous rim, driven by thickness
  float wrap = clamp((dot(n, L) + 1.0) / 2.0, 0.0, 1.0);
  float edge = 1.0 - clamp(d / uT, 0.0, 1.0);        // 0 at the axis -> 1 at the silhouette (linear in distance, not in height)
  vec3 body = mix(uColor * 0.94, mix(uColor, vec3(1.0), 0.16), smoothstep(0.0, 1.0, edge));   // one hue: only a gentle tonal lift toward the edge, no separate zones
  vec3 col = body * (0.88 + 0.22 * wrap);

  // inner glow: light diffused inside, strongest at mid thickness
  float glow = exp(-pow((h - 0.6) / 0.45, 2.0));
  col += mix(uColor, uRim, 0.5) * glow * 0.40;

  // GDC-2011-style translucency: back light seen through thin parts
  vec3 sh = normalize(L + n * 0.45);
  float scat = pow(clamp(dot(V, -sh), 0.0, 1.0), 2.2) * (0.30 + 0.70 * thin);
  col += uRim * 0.18 * scat;

  // bounce light from the violet floor on downward-facing surface
  col += vec3(0.55, 0.38, 1.0) * max(-n.y, 0.0) * 0.30 * (0.4 + 0.6 * thin);

  // wet reflection from shared env (Fresnel-weighted) + small sharp specular spot
  vec3 R = reflect(-V, n);
  float F = 0.06 + 0.94 * pow(1.0 - max(n.z, 0.0), 3.0);
  col += envMap(R) * (0.14 + 0.55 * F);
  col += vec3(1.0) * pow(max(dot(R, L), 0.0), 45.0) * 0.3;

  // colored fresnel rim glow
  col += uRim * pow(1.0 - n.z, 2.6) * 0.16;

  col = 1.0 - exp(-1.7 * col);                      // soft shoulder: no white blow-out
  gl_FragColor = vec4(col, mask);
}
`;

function mochiMaterial(sdf: THREE.Texture, color: number, rim: number, thickness: number) {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    uniforms: {
      uSdf: { value: sdf },
      uColor: { value: new THREE.Color(color) },
      uRim: { value: new THREE.Color(rim) },
      uT: { value: sdf.userData.maxD * thickness }, // inflate to the full medial radius: dome tops out exactly at the axis
      uTime: sharedTime,
    },
  });
}

// ---------- scene ----------
async function main() {
  try { await document.fonts.load('700 230px "Fredoka"', 'O'); } catch { /* fallback font */ }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);

  const quad = new THREE.PlaneGeometry(1.6, 1.6);
  const blob = new THREE.Mesh(quad, mochiMaterial(sdfTexture(drawBlob), 0xff78b4, 0xff9ccb, 1.0));
  const glyph = new THREE.Mesh(quad, mochiMaterial(sdfTexture(drawO), 0xa584ff, 0xb9a2ff, 1.0));
  scene.add(blob, glyph);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight, aspect = w / h;
    const viewH = Math.max(2, 3.4 / aspect), viewW = viewH * aspect;
    camera.left = -viewW / 2; camera.right = viewW / 2; camera.top = viewH / 2; camera.bottom = -viewH / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (aspect >= 1) { blob.position.set(-0.9, 0, 0); glyph.position.set(0.9, 0, 0); }
    else { blob.position.set(0, 0.9, 0); glyph.position.set(0, -0.9, 0); }
  }
  window.addEventListener('resize', resize);
  resize();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    sharedTime.value = t;
    // slow squash/stretch on the blob (quad scale deforms the SDF-lit surface consistently)
    const s = Math.sin(t * 1.1) * 0.12;
    blob.scale.set(1 + s, 1 - s, 1);
    renderer.render(scene, camera);
  });
}
main();
