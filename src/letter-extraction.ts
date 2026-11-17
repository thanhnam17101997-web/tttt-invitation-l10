/**
 * L08: SDF material extraction (WebGL2 compositor).
 * Renders only the material outside an existing Canvas2D blob. The existing
 * V3 blob is painted over it afterwards, preserving its face and soft body.
 * A single SDF union creates the extending letter silhouette (no bud/tether).
 */
import type { GummyGlyph, GlyphEmitter } from './typography';

type Palette = { light: string; mid: string; dark: string };
const palettes: Record<string, Palette> = {
  pink_dome: { light: '#FFC3E1', mid: '#FF65A2', dark: '#CA216C' },
  yellow_star: { light: '#FFF7B9', mid: '#FFD75D', dark: '#E9A42B' },
  mint_bean: { light: '#D7FFEE', mid: '#78E7CA', dark: '#26B8AD' },
  lilac_flower: { light: '#F9E1FF', mid: '#D8A5F0', dark: '#9669CC' },
  gold_coin: { light: '#FFE2EE', mid: '#FFA9C8', dark: '#DD76A4' },
};
const SDF_SIZE = 128;
function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map(i => parseInt(hex.substring(i, i + 2), 16) / 255) as [number, number, number];
}

const vertexSource = `#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.,1.);}`;
const fragmentSource = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform vec2 uLetterCenter;
uniform vec2 uLetterSize;
uniform float uProgress;
uniform float uTime;
uniform float uBodyAspect;
uniform sampler2D uGlyph;
uniform vec3 uLight;
uniform vec3 uMid;
uniform vec3 uDark;
out vec4 outColor;
float sdEllipse(vec2 p, vec2 ab){float k0=length(p/ab);float k1=length(p/(ab*ab));return k0*(k0-1.)/k1;}
float sUnion(float a, float b, float k){float h=max(k-abs(a-b),0.)/max(k,.0001);return min(a,b)-h*h*k*.25;}
float bodySDF(vec2 p){
 float angle=atan(p.y,p.x);
 float wave=.009*sin(3.*angle+uTime*.65)+.005*sin(5.*angle-uTime*.42);
 vec2 q=p/(1.+wave);
 float d=sdEllipse(q,vec2(.5*uBodyAspect,.5));
 float grow=smoothstep(.12,.5,uProgress)*(1.-smoothstep(.65,.88,uProgress));
 float recoil=smoothstep(.79,.98,uProgress);
 vec2 shoulder=uLetterCenter*.67;
 float patch=exp(-dot((p-shoulder)/vec2(.17,.2),(p-shoulder)/vec2(.17,.2)));
 return d-.045*grow*patch+.018*recoil*patch;
}
float letterSDF(vec2 p){
 vec2 uv=(p-uLetterCenter)/uLetterSize+.5;
 vec2 clamped=clamp(uv,0.,1.);
 float outside=length((uv-clamped)*uLetterSize);
 float s=texture(uGlyph,clamped).r;
 // Glyph texture stores signed distance around .5, negative inside.
 return (s-.5)*.27*uLetterSize.y+outside;
}
void main(){
 // shader p is in local blob radius units, positive y up
 vec2 p=(gl_FragCoord.xy-uResolution*.5)/min(uResolution.x,uResolution.y)*2.;
 float t=uProgress;
 float body=bodySDF(p);
 // Reveal letter from bottom up; at first no independent silhouette.
 float rise=smoothstep(.16,.72,t);
 float ceilY=mix(uLetterCenter.y-.25*uLetterSize.y,uLetterCenter.y+.64*uLetterSize.y,rise);
 float letter=max(letterSDF(p), p.y-ceilY);
 float blend=mix(.06,.0015,smoothstep(.7,.98,t));
 float united=sUnion(body,letter,blend);
 float aa=max(fwidth(united)*1.35,.002);
 float unitedAlpha=1.-smoothstep(-aa,aa,united);
 float bodyAlpha=1.-smoothstep(-aa,aa,body);
 // Only draw outside body; Canvas2D paints the actual V3 body on top.
 float alpha=max(0.,unitedAlpha-bodyAlpha);
 if(alpha<.001){outColor=vec4(0.);return;}
 float lum=clamp(.58+.45*p.y,0.,1.);
 vec3 color=mix(uDark,uMid,lum);
 color=mix(color,uLight,.18*exp(-length(p-vec2(-.25,.5))*2.));
 float edge=exp(-abs(united)*26.);
 color=mix(color,uLight,.24*edge);
 outColor=vec4(color,alpha);
}`;

function makeShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw Error('Unable to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw Error(gl.getShaderInfoLog(shader) ?? 'Shader compilation failed');
  }
  return shader;
}

function makeGlyphSDF(char: string): Uint8Array {
  const c = document.createElement('canvas');
  c.width = c.height = SDF_SIZE;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Uint8Array(SDF_SIZE * SDF_SIZE);
  ctx.clearRect(0, 0, SDF_SIZE, SDF_SIZE);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 104px "Fredoka", "Be Vietnam Pro", sans-serif';
  ctx.fillText(char, SDF_SIZE / 2, SDF_SIZE / 2 + 2);
  const pixels = ctx.getImageData(0, 0, SDF_SIZE, SDF_SIZE).data;
  // Two-pass approximate Euclidean distance transform, separately for inside/outside.
  const transform = (inside: boolean): Float32Array => {
    const a = new Float32Array(SDF_SIZE * SDF_SIZE);
    const diag = Math.SQRT2;
    for (let i = 0; i < a.length; i++) a[i] = ((pixels[4 * i + 3] > 127) === inside) ? 0 : 1e4;
    for (let y = 0; y < SDF_SIZE; y++) for (let x = 0; x < SDF_SIZE; x++) {
      const i = y * SDF_SIZE + x;
      if (x > 0) a[i] = Math.min(a[i], a[i - 1] + 1);
      if (y > 0) a[i] = Math.min(a[i], a[i - SDF_SIZE] + 1);
      if (x > 0 && y > 0) a[i] = Math.min(a[i], a[i - SDF_SIZE - 1] + diag);
      if (x < SDF_SIZE - 1 && y > 0) a[i] = Math.min(a[i], a[i - SDF_SIZE + 1] + diag);
    }
    for (let y = SDF_SIZE - 1; y >= 0; y--) for (let x = SDF_SIZE - 1; x >= 0; x--) {
      const i = y * SDF_SIZE + x;
      if (x < SDF_SIZE - 1) a[i] = Math.min(a[i], a[i + 1] + 1);
      if (y < SDF_SIZE - 1) a[i] = Math.min(a[i], a[i + SDF_SIZE] + 1);
      if (x < SDF_SIZE - 1 && y < SDF_SIZE - 1) a[i] = Math.min(a[i], a[i + SDF_SIZE + 1] + diag);
      if (x > 0 && y < SDF_SIZE - 1) a[i] = Math.min(a[i], a[i + SDF_SIZE - 1] + diag);
    }
    return a;
  };
  const inside = transform(true);
  const outside = transform(false);
  const out = new Uint8Array(SDF_SIZE * SDF_SIZE);
  for (let y = 0; y < SDF_SIZE; y++) for (let x = 0; x < SDF_SIZE; x++) {
    const i = y * SDF_SIZE + x;
    out[(SDF_SIZE - 1 - y) * SDF_SIZE + x] = Math.max(0, Math.min(255,
      Math.round((0.5 + (inside[i] - outside[i]) / 48) * 255)));
  }
  return out;
}

export class MaterialExtractionRenderer {
  private canvas = document.createElement('canvas');
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private glyphTextures = new Map<string, WebGLTexture>();
  private available = false;
  constructor() {
    try {
      this.canvas.width = this.canvas.height = 256;
      const gl = this.canvas.getContext('webgl2', {
        alpha: true, antialias: false, premultipliedAlpha: false,
        preserveDrawingBuffer: true, depth: false, stencil: false,
      });
      if (!gl) return;
      this.gl = gl;
      const program = gl.createProgram();
      if (!program) return;
      gl.attachShader(program, makeShader(gl, gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, makeShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program) ?? 'Link failed');
      this.program = program;
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const attr = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(attr);
      gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
      for (const name of ['uResolution','uLetterCenter','uLetterSize','uProgress','uTime','uBodyAspect','uGlyph','uLight','uMid','uDark']) {
        this.uniforms[name] = gl.getUniformLocation(program, name);
      }
      gl.uniform1i(this.uniforms.uGlyph, 0);
      gl.disable(gl.BLEND);
      this.available = true;
    } catch (error) {
      console.warn('[TTTT] Material SDF unavailable; using Canvas fallback', error);
      this.available = false;
    }
  }

  private glyphTexture(char: string): WebGLTexture | null {
    const gl = this.gl;
    if (!gl) return null;
    const cached = this.glyphTextures.get(char);
    if (cached) return cached;
    const texture = gl.createTexture();
    if (!texture) return null;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, SDF_SIZE, SDF_SIZE, 0, gl.RED, gl.UNSIGNED_BYTE, makeGlyphSDF(char));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.glyphTextures.set(char, texture);
    return texture;
  }

  /** Returns false when WebGL2 isn't available, allowing Canvas fallback. */
  render(ctx: CanvasRenderingContext2D, glyph: GummyGlyph, now: number): boolean {
    const host: GlyphEmitter | null = glyph.emitter;
    const gl = this.gl;
    if (!this.available || !host || !gl || !this.program) return false;
    const texture = this.glyphTexture(glyph.char);
    if (!texture) return false;
    const progress = Math.max(0, Math.min(1, glyph.emitterElapsed / glyph.emitterDuration));
    const radius = host.radius;
    const palette = palettes[host.type] ?? palettes.pink_dome;
    const r = radius * 3.8;
    const size = 256;
    gl.viewport(0, 0, size, size);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform2f(this.uniforms.uResolution, size, size);
    // Local shader coordinates are centered on the host, 1 unit = 1 radius.
    // GL canvas covers +/-1.9 radius, so local stage offsets are /radius.
    gl.uniform2f(this.uniforms.uLetterCenter, (glyph.x-host.x)/radius/1.9, -(glyph.y-host.y)/radius/1.9);
    gl.uniform2f(this.uniforms.uLetterSize, (glyph.width/radius)/1.9*1.18, (glyph.height/radius)/1.9*1.18);
    gl.uniform1f(this.uniforms.uProgress, progress);
    gl.uniform1f(this.uniforms.uTime, now / 1000);
    gl.uniform1f(this.uniforms.uBodyAspect, 1.0);
    gl.uniform3fv(this.uniforms.uLight, rgb(palette.light));
    gl.uniform3fv(this.uniforms.uMid, rgb(palette.mid));
    gl.uniform3fv(this.uniforms.uDark, rgb(palette.dark));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    ctx.drawImage(this.canvas, host.x - r/2, host.y - r/2, r, r);
    return true;
  }
}
