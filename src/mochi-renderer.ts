import * as THREE from 'three';
import type { LivingCharacter } from './characters';
import type { GummyGlyph } from './typography';

// Production adaptation of experiments/mochi-material: a raster SDF and a
// Poisson-smoothed height field feed one shared shader for both blobs/glyphs.
// Blob maps are refreshed round-robin from the real V3 spring skin, never per
// frame, so interaction remains responsive on phones.
const SIZE = 256;
const GLYPH_SIZE = 512;
const POISSON_GRID = 128;
const RANGE = 48;
type Point = { x: number; y: number };
type Surface = { mesh: THREE.Mesh; material: THREE.ShaderMaterial; texture: THREE.DataTexture; lastMap: number; key: string };

function edt1d(f: Float64Array, n: number, out: Float64Array) {
  const v = new Int32Array(n), z = new Float64Array(n + 1); let k = 0;
  v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) { let s = 0; while (true) { const p = v[k]; s = ((f[q] + q*q) - (f[p] + p*p)) / (2*q - 2*p); if (s <= z[k] && k > 0) k--; else break; } if (s <= z[k]) { v[k] = q; z[k] = -1e20; z[k + 1] = 1e20; } else { k++; v[k] = q; z[k] = s; z[k + 1] = 1e20; } }
  k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; out[q] = (q-v[k])*(q-v[k]) + f[v[k]]; }
}
function distance(on: Uint8Array, size: number) {
  const g = new Float64Array(size * size), f = new Float64Array(size), o = new Float64Array(size);
  for (let i = 0; i < g.length; i++) g[i] = on[i] ? 0 : 1e10;
  for (let x = 0; x < size; x++) { for (let y = 0; y < size; y++) f[y] = g[y*size+x]; edt1d(f,size,o); for (let y = 0; y < size; y++) g[y*size+x] = o[y]; }
  for (let y = 0; y < size; y++) { for (let x = 0; x < size; x++) f[x] = g[y*size+x]; edt1d(f,size,o); for (let x = 0; x < size; x++) g[y*size+x] = o[x]; }
  const d = new Float32Array(g.length); for (let i = 0; i < d.length; i++) d[i] = Math.sqrt(g[i]); return d;
}
function blur(src: Float32Array, dst: Float32Array, size: number, stride: number, lineStride: number, radius: number) {
  for (let l = 0; l < size; l++) { const base = l * lineStride; let sum = 0; for (let k = -radius; k <= radius; k++) sum += src[base + Math.min(size-1, Math.max(0,k))*stride]; for (let i = 0; i < size; i++) { dst[base+i*stride] = sum/(radius*2+1); sum += src[base+Math.min(size-1,i+radius+1)*stride] - src[base+Math.max(0,i-radius)*stride]; } }
}
function heightfield(draw: (ctx: CanvasRenderingContext2D) => void, size = SIZE, grid = size >> 1) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.fillStyle = '#fff'; draw(ctx);
  const pixels = ctx.getImageData(0,0,size,size).data, inside = new Uint8Array(size*size), outside = new Uint8Array(size*size);
  for (let i=0;i<inside.length;i++) { inside[i] = pixels[i*4+3] > 127 ? 1 : 0; outside[i] = 1-inside[i]; }
  const dout = distance(inside,size), din = distance(outside,size), sd = new Float32Array(size*size), tmp = new Float32Array(size*size);
  let maxD = 1; for (let i=0;i<sd.length;i++) { sd[i] = inside[i] ? din[i]-.5 : -(dout[i]-.5); maxD = Math.max(maxD, sd[i]); }
  for (let p=0;p<2;p++) { blur(sd,tmp,size,1,size,3); blur(tmp,sd,size,size,1,3); }
  const G = grid, u = new Float32Array(G*G), mask = new Uint8Array(G*G), omega = 2/(1+Math.sin(Math.PI/G));
  for (let y=0;y<G;y++) for (let x=0;x<G;x++) mask[y*G+x] = sd[Math.min(size-1,Math.floor(y*size/G))*size+Math.min(size-1,Math.floor(x*size/G))] > 0 ? 1 : 0;
  // Same red-black Poisson solve as the approved workbench, reduced resolution
  // and cadence for production mobile.
  for (let it=0;it<180;it++) for (let color=0;color<2;color++) for (let y=1;y<G-1;y++) for (let x=1+((y+color)&1);x<G-1;x+=2) { const i=y*G+x; if (mask[i]) u[i] += omega*((u[i-1]+u[i+1]+u[i-G]+u[i+G]+1)*.25-u[i]); }
  let umax=1e-6; for (const n of u) umax=Math.max(umax,n); const h = new Float32Array(size*size), eps=.3, norm=Math.sqrt(1+eps*eps)-eps;
  // Bilinear upsampling removes the 2px Poisson staircase that was showing
  // as a jagged candy edge in narrow glyphs.
  for (let y=0;y<size;y++) for (let x=0;x<size;x++) { const fx=x*G/size,fy=y*G/size,x0=Math.min(G-1,Math.floor(fx)),y0=Math.min(G-1,Math.floor(fy)),x1=Math.min(G-1,x0+1),y1=Math.min(G-1,y0+1),tx=fx-x0,ty=fy-y0,q0=u[y0*G+x0]*(1-tx)+u[y0*G+x1]*tx,q1=u[y1*G+x0]*(1-tx)+u[y1*G+x1]*tx,q=(q0*(1-ty)+q1*ty)/umax; h[y*size+x]=(Math.sqrt(q+eps*eps)-eps)/norm; }
  for (let p=0;p<2;p++) { blur(h,tmp,size,1,size,2); blur(tmp,h,size,size,1,2); }
  // Byte packing is universally sampleable across Safari/Zen WebGL paths.
  // It preserves the same Poisson field (R = signed distance, G = height).
  const data=new Uint8Array(size*size*4); for (let i=0;i<size*size;i++) { data[i*4]=Math.round((Math.max(-RANGE,Math.min(RANGE,sd[i]))/RANGE*.5+.5)*255); data[i*4+1]=Math.round(Math.max(0,Math.min(1,h[i]))*255); data[i*4+2]=pixels[i*4+3]; data[i*4+3]=255; }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat,THREE.UnsignedByteType); texture.minFilter=texture.magFilter=THREE.LinearFilter; texture.generateMipmaps=false; texture.needsUpdate=true; texture.userData.maxD=maxD; texture.userData.size=size; return texture;
}

const vertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragment = `precision highp float;
varying vec2 vUv; uniform sampler2D uSdf; uniform vec3 uColor,uRim; uniform float uT,uTime,uGlyph,uTexSize;
float sd(vec2 p){return (texture2D(uSdf,p).r*2.-1.)*${RANGE}.0;} float hh(vec2 p){return texture2D(uSdf,p).g;} float coverage(vec2 p){return texture2D(uSdf,p).b;}
float softbox(vec2 p,vec2 c,vec2 size){vec2 q=(p-c)/size;return exp(-dot(q,q)*1.65);}
vec3 env(vec3 r){
 vec3 c=mix(vec3(.035,.05,.17),vec3(.22,.20,.48),r.y*.5+.5);
 c+=vec3(.88,.82,1.)*1.05*softbox(r.xy,vec2(-.35,.46),vec2(.56,.22));
 c+=vec3(1.,.62,.86)*.56*softbox(r.xy,vec2(.52,-.18),vec2(.28,.52));
 c+=vec3(.42,.66,1.)*.40*softbox(r.xy,vec2(.04,-.62),vec2(.74,.18));
 c+=vec3(.90,.76,1.)*.18*softbox(r.xy,vec2(-.68,-.05),vec2(.25,.60));
 return c;
}
void main(){
 float d=sd(vUv),a=smoothstep(-1.25,1.25,d)*coverage(vUv);if(a<.003)discard;float e=mix(3.,7.,uGlyph)/uTexSize,h=hh(vUv);
 vec2 g=vec2(hh(vUv+vec2(e,0.))-hh(vUv-vec2(e,0.)),hh(vUv+vec2(0.,e))-hh(vUv-vec2(0.,e)))/6.;
 vec2 drift=vec2(sin(vUv.y*5.+uTime*.38),sin(vUv.x*5.-uTime*.31))*.012*(1.-uGlyph)*smoothstep(.08,.58,h);
 vec3 n=normalize(vec3(-g*uT*(.40+.03*uGlyph)+drift,1.));vec3 L=normalize(vec3(-.42,.56,.70)),V=vec3(0.,0.,1.),R=reflect(-V,n);
 float edge=1.-clamp(d/max(uT,.01),0.,1.),thin=1.-h,wrap=clamp((dot(n,L)+1.)*.5,0.,1.);
 vec3 body=mix(uColor*.88,mix(uColor,vec3(1.),.13),smoothstep(.08,.96,edge));
 vec3 col=body*(.82+.26*wrap);
 col+=mix(uColor,uRim,.58)*exp(-pow((h-.57)/.48,2.))*.32;
 col+=uRim*.13*pow(clamp(dot(V,-normalize(L+n*.42)),0.,1.),2.0)*(.28+.72*thin);
 col+=vec3(.34,.28,.78)*max(-n.y,0.)*.18;
 float fresnel=.05+.88*pow(1.-max(n.z,0.),2.7);col+=env(R)*(.14+.42*fresnel);
 col+=vec3(1.,.93,1.)*pow(max(dot(R,L),0.),18.)*(.12+.12*uGlyph);
 col+=vec3(1.,.89,1.)*softbox(vUv,vec2(.31,.25),vec2(.34,.18))*.14*uGlyph*smoothstep(.04,.70,h);
 col+=uRim*pow(1.-n.z,2.3)*.10;col=1.-exp(-1.45*col);gl_FragColor=vec4(col,a);
}`;
function hex(value: string) { return new THREE.Color(value); }

export class MochiStageRenderer {
  private renderer: THREE.WebGLRenderer | null = null; private scene = new THREE.Scene(); private camera = new THREE.OrthographicCamera(0,1,1,0,-10,10); private quad = new THREE.PlaneGeometry(1,1); private blobs = new Map<LivingCharacter,Surface>(); private glyphs = new Map<GummyGlyph,Surface>(); private refreshQueue = new Set<LivingCharacter>(); private available=true; private lastMapMs=0;
  constructor(canvas: HTMLCanvasElement) { try { this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,premultipliedAlpha:false}); this.renderer.setClearColor(0,0); this.camera.position.z=5; } catch { this.available=false; } }
  get enabled(){return this.available && !!this.renderer;}
  hasBlob(character: LivingCharacter) { return this.blobs.has(character); }
  requestContourRefresh(character: LivingCharacter) { this.refreshQueue.add(character); }
  getLastMapMs() { return this.lastMapMs; }
  resize(width:number,height:number,dpr:number){if(!this.renderer)return;this.renderer.setPixelRatio(dpr);this.renderer.setSize(width,height,false);this.camera.left=0;this.camera.right=width;this.camera.top=0;this.camera.bottom=height;this.camera.updateProjectionMatrix();}
  private surface(texture: THREE.DataTexture,color:string,rim:string,key:string){const material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide,uniforms:{uSdf:{value:texture},uColor:{value:hex(color)},uRim:{value:hex(rim)},uT:{value:texture.userData.maxD},uTime:{value:0},uGlyph:{value:key.startsWith('glyph:')?1:0},uTexSize:{value:texture.userData.size}}});const mesh=new THREE.Mesh(this.quad,material);this.scene.add(mesh);return{mesh,material,texture,lastMap:0,key};}
  private replace(s:Surface,texture:THREE.DataTexture){s.texture.dispose();s.texture=texture;s.material.uniforms.uSdf.value=texture;s.material.uniforms.uT.value=texture.userData.maxD;s.material.uniforms.uTexSize.value=texture.userData.size;}
  private blobMap(character:LivingCharacter){const contour=character.getMochiContour(), scale=SIZE/(character.radius*2.75), map=(p:Point):Point=>({x:SIZE*.5+p.x*scale,y:SIZE*.5+p.y*scale});return heightfield(ctx=>{ctx.fillStyle='#fff';ctx.beginPath();const first=map(contour[0]);ctx.moveTo(first.x,first.y);for(let i=0;i<contour.length;i++){const a=map(contour[i]),b=map(contour[(i+1)%contour.length]);ctx.quadraticCurveTo(a.x,a.y,(a.x+b.x)*.5,(a.y+b.y)*.5);}ctx.closePath();ctx.fill();});}
  private glyphMap(glyph:GummyGlyph){return heightfield(ctx=>{ctx.fillStyle='#fff';ctx.font='700 380px "DynaPuff Hero", "Be Vietnam Pro", sans-serif';const m=ctx.measureText(glyph.char),inkW=Math.max(1,m.width),inkH=Math.max(1,m.actualBoundingBoxAscent+m.actualBoundingBoxDescent),fit=Math.min(GLYPH_SIZE*.96/inkW,GLYPH_SIZE*.88/inkH);ctx.save();ctx.translate(GLYPH_SIZE*.5,GLYPH_SIZE*.5);ctx.scale(fit,fit);ctx.textAlign='center';ctx.textBaseline='alphabetic';/* Real filled DynaPuff outline: counters stay open, with no synthetic stroke/dilation. */ctx.fillText(glyph.char,0,(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)*.5);ctx.restore();},GLYPH_SIZE,POISSON_GRID);}
  sync(characters:LivingCharacter[],glyphs:GummyGlyph[],time:number){if(!this.renderer)return;const seconds=time*.001;
    // Build one expensive Poisson map per frame. This lets boot reveal as soon
    // as the first materialized blob is ready instead of blocking on all five.
    const missing=characters.find(c=>!this.blobs.has(c));
    if(missing){const palette=missing.getMochiPalette(),started=performance.now();this.blobs.set(missing,this.surface(this.blobMap(missing),palette.mid,palette.light,'blob'));this.lastMapMs=performance.now()-started;}
    characters.forEach(c=>{const s=this.blobs.get(c);if(!s)return;const tr=c.getMochiTransform();s.mesh.position.set(c.x,c.y,0);s.mesh.rotation.z=-(tr.rotation+tr.stretchAngle);s.mesh.scale.set(2.75*c.radius*tr.scaleX,2.75*c.radius*tr.scaleY,1);s.material.uniforms.uTime.value=seconds;});
    // Transform matrices are smooth every frame. The expensive SDF/Poisson map
    // only refreshes after a released V3 interaction, one contour per frame.
    // This removes the former 120ms drag stalls without freezing position,
    // rotation, squash or face feedback during a drag.
    const refresh = this.refreshQueue.values().next().value as LivingCharacter | undefined;
    if (refresh) { const s=this.blobs.get(refresh); if (s) { const started=performance.now(); this.replace(s,this.blobMap(refresh)); this.lastMapMs=performance.now()-started; s.lastMap=time; } this.refreshQueue.delete(refresh); }
    const live=new Set(glyphs);for(const [g,s] of this.glyphs)if(!live.has(g)){this.scene.remove(s.mesh);s.texture.dispose();s.material.dispose();this.glyphs.delete(g);}glyphs.forEach(g=>{let s=this.glyphs.get(g);if(!s){s=this.surface(this.glyphMap(g),g.theme.gradMid,g.theme.gradTop,`glyph:${g.char}`);this.glyphs.set(g,s);}const emerge=g.isAttached?.34+.66*Math.min(1,g.emergeProgress*1.2):Math.min(1,g.emergeProgress*1.2);s.mesh.visible=g.isEmerging&&g.emergeProgress>.01;s.mesh.position.set(g.x,g.y,1);s.mesh.rotation.z=-g.rotation;s.mesh.scale.set(g.width*1.12*emerge,g.height*1.08*emerge,1);s.material.uniforms.uTime.value=seconds;});
  }
  render(){if(this.renderer)this.renderer.render(this.scene,this.camera);}
}
