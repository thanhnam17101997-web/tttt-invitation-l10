import * as THREE from 'three';

// DOM Elements
const container = document.getElementById('webglContainer') as HTMLElement;
const fallback = document.getElementById('webglFallback') as HTMLElement;
const fpsTag = document.getElementById('fpsTag');
const controlsPanel = document.getElementById('controlsPanel');
const toggleControlsBtn = document.getElementById('toggleControlsBtn');

const sliderRoughness = document.getElementById('sliderRoughness') as HTMLInputElement;
const sliderTransmission = document.getElementById('sliderTransmission') as HTMLInputElement;
const valRoughness = document.getElementById('valRoughness');
const valTransmission = document.getElementById('valTransmission');

const btnMagnet3D = document.getElementById('btnMagnet3D');
const btnReset3D = document.getElementById('btnReset3D');
const presetBtns = document.querySelectorAll('.preset-btn');

// Viewport & Three.js core
let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.OrthographicCamera;
let pmremGenerator: THREE.PMREMGenerator;

let stageW = 390;
let stageH = 693;
const WORLD_WIDTH = 400;
let worldHeight = (WORLD_WIDTH * stageH) / stageW;

// Physics & Scene Objects Interfaces
interface DriftSteering {
  heading: number;        // Current heading in radians
  targetHeading: number;  // Target wander angle
  speed: number;          // Target drift speed (units/sec ~ 10-22 px/s)
  turnTimer: number;      // Countdown to pick next random heading
  turnInterval: number;   // Interval between steering shifts (2-5s)
  phaseOffset: number;    // Unique phase for this object
}

interface BlobPhysics {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  basePositions: Float32Array;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isDragging: boolean;
  dragOffset: { x: number; y: number };
  lastPos: { x: number; y: number };
  wobble: number;
  wobbleVel: number;
  stretch: number;
  stretchVel: number;
  stretchAngle: number;
  eyesGroup: THREE.Group;
  eyeLookTarget: { x: number; y: number };
  eyeLookCurrent: { x: number; y: number };
  steering: DriftSteering;
}

interface LetterPhysics {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  basePositions: Float32Array;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  isDragging: boolean;
  isMagnetizing: boolean;
  dragOffset: { x: number; y: number };
  lastPos: { x: number; y: number };
  wobble: number;
  wobbleVel: number;
  rotationZ: number;
  vRot: number;
  steering: DriftSteering;
}

let blobObj: BlobPhysics;
let letterObj: LetterPhysics;
let gummyMaterial: THREE.MeshPhysicalMaterial;
let targetSilhouette: THREE.LineSegments;

// Raycasting & Pointer
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const planeZ0 = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
let activeDrag: BlobPhysics | LetterPhysics | null = null;
let pointerDownTime = 0;

// Animation & Performance
let lastTime = performance.now();
let frameCount = 0;
let lastFpsUpdate = 0;

/**
 * Check WebGL availability
 */
function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

/**
 * Procedural Studio Environment Map for smooth gummy highlights
 */
function createStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const envScene = new THREE.Scene();
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Smooth studio backdrop gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#552277');
  grad.addColorStop(0.35, '#883399');
  grad.addColorStop(0.65, '#2b0f44');
  grad.addColorStop(1, '#0e031a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Broad soft studio softbox light
  const lightGrad = ctx.createRadialGradient(180, 70, 10, 180, 70, 140);
  lightGrad.addColorStop(0, 'rgba(255, 235, 245, 0.9)');
  lightGrad.addColorStop(0.5, 'rgba(255, 180, 210, 0.4)');
  lightGrad.addColorStop(1, 'rgba(255, 180, 210, 0)');
  ctx.fillStyle = lightGrad;
  ctx.fillRect(0, 0, 512, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;

  const bgMesh = new THREE.Mesh(
    new THREE.SphereGeometry(100, 32, 16),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide })
  );
  envScene.add(bgMesh);

  const rt = pmremGenerator.fromEquirectangular(texture);
  texture.dispose();
  return rt;
}

/**
 * Build chubby 3D Letter L with dense subdivision for smooth organic morphing
 */
function createGummyLetterLGeometry(): { geometry: THREE.BufferGeometry; basePositions: Float32Array } {
  const shape = new THREE.Shape();

  const w = 78;
  const h = 118;
  const t = 34;

  const left = -w / 2;
  const right = w / 2;
  const top = h / 2;
  const bottom = -h / 2;

  const topCapR = t / 2;
  const footToeR = t / 2;
  const innerBendR = 14;
  const outerBendR = 22;

  // 1. Top cap arc
  shape.absarc(left + topCapR, top - topCapR, topCapR, Math.PI, 0, true);

  // 2. Down inner vertical edge
  const innerCornerX = left + t;
  const innerCornerY = bottom + t;
  shape.lineTo(innerCornerX, innerCornerY + innerBendR);

  // 3. Fleshy inner bend fillet
  shape.quadraticCurveTo(innerCornerX, innerCornerY, innerCornerX + innerBendR, innerCornerY);

  // 4. Along top edge of foot to rounded toe cap
  shape.lineTo(right - footToeR, innerCornerY);
  shape.absarc(right - footToeR, bottom + footToeR, footToeR, Math.PI / 2, -Math.PI / 2, true);

  // 5. Along bottom edge to outer heel fillet
  shape.lineTo(left + outerBendR, bottom);
  shape.quadraticCurveTo(left, bottom, left, bottom + outerBendR);

  // 6. Up outer edge back to top cap
  shape.lineTo(left, top - topCapR);

  // Extrude with deep, rounded pillow bevel and high segment count
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 18,
    bevelEnabled: true,
    bevelSegments: 12,
    bevelSize: 15,
    bevelThickness: 15,
    bevelOffset: 0,
    curveSegments: 20,
    steps: 3, // Steps along depth for smooth vertical flex
  };

  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.center();

  // Store base positions
  const pos = geom.attributes.position;
  const base = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    base[i * 3] = pos.getX(i);
    base[i * 3 + 1] = pos.getY(i);
    base[i * 3 + 2] = pos.getZ(i);
  }

  return { geometry: geom, basePositions: base };
}

/**
 * Build Asymmetric Organic Gummy Blob Geometry (High Density)
 */
function createOrganicBlobGeometry(radius: number): { geometry: THREE.BufferGeometry; basePositions: Float32Array } {
  // Detail level 5 provides smooth continuous deformation without faceting
  const geom = new THREE.IcosahedronGeometry(radius, 5);
  const pos = geom.attributes.position;
  const count = pos.count;
  const base = new Float32Array(count * 3);

  // Deform sphere into organic resting mochi shape
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const len = Math.hypot(x, y, z);
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;

    // Asymmetric base drop: bottom hemisphere is broader & flatter like resting gelatin
    let r = radius;
    if (ny < 0) {
      r *= 1.0 + Math.abs(ny) * 0.16; // Flatter resting bottom
    } else {
      r *= 1.0 - ny * 0.05; // Softer dome
    }

    // Subtle initial organic harmonics
    const organic = Math.sin(nx * 3.2 + ny * 2.1) * 0.04 + Math.cos(nz * 2.8) * 0.03;
    r *= 1 + organic;

    pos.setXYZ(i, nx * r, ny * r, nz * r);
    base[i * 3] = nx * r;
    base[i * 3 + 1] = ny * r;
    base[i * 3 + 2] = nz * r;
  }

  geom.computeVertexNormals();
  return { geometry: geom, basePositions: base };
}

/**
 * Create Cute Glossy Living Eyes
 */
function createBlobEyes(radius: number): THREE.Group {
  const group = new THREE.Group();

  const eyeGeo = new THREE.CapsuleGeometry(3.5, 6, 8, 16);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x140220 });

  const pupilGeo = new THREE.SphereGeometry(1.4, 8, 8);
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  [-1, 1].forEach((dir) => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(dir * (radius * 0.32), radius * 0.05, radius * 0.94);

    // Specular catchlight dots
    const p1 = new THREE.Mesh(pupilGeo, pupilMat);
    p1.position.set(-0.8, 1.8, 2.5);
    eye.add(p1);

    const p2 = new THREE.Mesh(pupilGeo, pupilMat);
    p2.scale.set(0.6, 0.6, 0.6);
    p2.position.set(0.9, -1.2, 2.5);
    eye.add(p2);

    group.add(eye);
  });

  return group;
}

/**
 * Target Silhouette wireframe for 'L'
 */
function createTargetSilhouette(geom: THREE.BufferGeometry): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(geom, 25);
  const lineMat = new THREE.LineDashedMaterial({
    color: 0xffc15a,
    dashSize: 6,
    gapSize: 4,
    transparent: true,
    opacity: 0.45,
  });
  const line = new THREE.LineSegments(edges, lineMat);
  line.computeLineDistances();
  return line;
}

/**
 * Pick a random steering angle
 */
function randomAngle(): number {
  return Math.random() * Math.PI * 2;
}

/**
 * Smooth angle interpolation without 360-degree wrapping glitch
 */
function lerpAngle(a: number, b: number, t: number): number {
  const diff = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + diff * t;
}

/**
 * Initialize Three.js Scene
 */
function initThree() {
  if (!isWebGLAvailable()) {
    fallback.style.display = 'block';
    return;
  }

  const rect = container.getBoundingClientRect();
  stageW = rect.width || 390;
  stageH = rect.height || 693;
  worldHeight = (WORLD_WIDTH * stageH) / stageW;

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(stageW, stageH);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();

  // Orthographic Camera (preserves 2D plane)
  const halfW = WORLD_WIDTH / 2;
  const halfH = worldHeight / 2;
  camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 1, 1000);
  camera.position.set(0, 0, 400);
  camera.lookAt(0, 0, 0);

  // Studio Lighting
  pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const envRT = createStudioEnvironment(renderer);
  scene.environment = envRT.texture;

  // Key Studio Light (Warm softbox from top-left)
  const keyLight = new THREE.DirectionalLight(0xfff5f8, 2.2);
  keyLight.position.set(-160, 220, 260);
  scene.add(keyLight);

  // Translucent Rim Light (Vibrant hot coral-pink from back)
  const rimLight = new THREE.DirectionalLight(0xff4488, 3.2);
  rimLight.position.set(0, 180, -220);
  scene.add(rimLight);

  // Ambient Fill Light (Deep velvety plum)
  const ambLight = new THREE.AmbientLight(0x280e46, 1.4);
  scene.add(ambLight);

  // Shared Master Gummy Material (MeshPhysicalMaterial)
  gummyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xff3075,
    roughness: 0.24,
    metalness: 0.0,
    transmission: 0.55,
    ior: 1.36,
    thickness: 2.2,
    attenuationColor: new THREE.Color(0xa80045),
    attenuationDistance: 1.8,
    clearcoat: 0.45,
    clearcoatRoughness: 0.22,
    specularIntensity: 0.85,
  });

  // 1. Create Organic Blob
  const blobGeomData = createOrganicBlobGeometry(68);
  const blobMesh = new THREE.Mesh(blobGeomData.geometry, gummyMaterial);
  blobMesh.position.set(-65, -50, 0);

  const eyes = createBlobEyes(68);
  blobMesh.add(eyes);
  scene.add(blobMesh);

  blobObj = {
    mesh: blobMesh,
    geometry: blobGeomData.geometry,
    basePositions: blobGeomData.basePositions,
    x: -65,
    y: -50,
    vx: 0,
    vy: 0,
    radius: 68,
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
    lastPos: { x: -65, y: -50 },
    wobble: 0,
    wobbleVel: 0,
    stretch: 0,
    stretchVel: 0,
    stretchAngle: 0,
    eyesGroup: eyes,
    eyeLookTarget: { x: 0, y: 0 },
    eyeLookCurrent: { x: 0, y: 0 },
    steering: {
      heading: randomAngle(),
      targetHeading: randomAngle(),
      speed: 15,             // 15 units/sec drift speed
      turnTimer: 2.5,
      turnInterval: 3.5,     // New heading every ~3.5s
      phaseOffset: 0.0,
    },
  };

  // 2. Create Inflated Gummy Letter L
  const letterGeomData = createGummyLetterLGeometry();
  const letterMesh = new THREE.Mesh(letterGeomData.geometry, gummyMaterial);
  letterMesh.position.set(65, 30, 0);
  scene.add(letterMesh);

  // Target silhouette
  targetSilhouette = createTargetSilhouette(letterGeomData.geometry);
  targetSilhouette.position.set(0, 105, -2);
  scene.add(targetSilhouette);

  letterObj = {
    mesh: letterMesh,
    geometry: letterGeomData.geometry,
    basePositions: letterGeomData.basePositions,
    x: 65,
    y: 30,
    vx: 0,
    vy: 0,
    targetX: 0,
    targetY: 105,
    isDragging: false,
    isMagnetizing: false,
    dragOffset: { x: 0, y: 0 },
    lastPos: { x: 65, y: 30 },
    wobble: 0,
    wobbleVel: 0,
    rotationZ: 0,
    vRot: 0,
    steering: {
      heading: randomAngle(),
      targetHeading: randomAngle(),
      speed: 12,             // 12 units/sec drift speed
      turnTimer: 3.2,
      turnInterval: 4.0,     // New heading every ~4s
      phaseOffset: 2.4,      // Asynchronous phase offset
    },
  };

  setupEvents();
  setupUI();

  requestAnimationFrame(loop);
}

/**
 * Screen (px) to Three.js Orthographic World Coordinates
 */
function screenToWorld(clientX: number, clientY: number): THREE.Vector3 {
  const rect = container.getBoundingClientRect();
  const px = clientX - rect.left;
  const py = clientY - rect.top;

  mouse.x = (px / rect.width) * 2 - 1;
  mouse.y = -(py / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersectPoint = new THREE.Vector3();
  raycaster.ray.intersectPlane(planeZ0, intersectPoint);
  return intersectPoint;
}

function setupEvents() {
  const dom = renderer.domElement;

  dom.addEventListener('pointerdown', (e: PointerEvent) => {
    const wPos = screenToWorld(e.clientX, e.clientY);
    pointerDownTime = performance.now();

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([letterObj.mesh, blobObj.mesh], true);

    if (hits.length > 0) {
      dom.setPointerCapture(e.pointerId);

      let root: THREE.Object3D | null = hits[0].object;
      while (root && root !== letterObj.mesh && root !== blobObj.mesh) {
        root = root.parent;
      }

      if (root === letterObj.mesh) {
        activeDrag = letterObj;
        letterObj.isDragging = true;
        letterObj.isMagnetizing = false;
        letterObj.dragOffset = { x: letterObj.x - wPos.x, y: letterObj.y - wPos.y };
        letterObj.lastPos = { x: wPos.x, y: wPos.y };
        letterObj.vx = 0;
        letterObj.vy = 0;
        letterObj.wobble = -0.22;
        return;
      }

      if (root === blobObj.mesh) {
        activeDrag = blobObj;
        blobObj.isDragging = true;
        blobObj.dragOffset = { x: blobObj.x - wPos.x, y: blobObj.y - wPos.y };
        blobObj.lastPos = { x: wPos.x, y: wPos.y };
        blobObj.vx = 0;
        blobObj.vy = 0;
        blobObj.wobble = -0.28;
        return;
      }
    }

    // Tap on target silhouette triggers magnetic snap!
    const distToTarget = Math.hypot(wPos.x - letterObj.targetX, wPos.y - letterObj.targetY);
    if (distToTarget < 65) {
      triggerMagneticSnap();
    }
  });

  dom.addEventListener('pointermove', (e: PointerEvent) => {
    if (!activeDrag) return;
    const wPos = screenToWorld(e.clientX, e.clientY);
    const dt = 1 / 60;

    const targetX = wPos.x + activeDrag.dragOffset.x;
    const targetY = wPos.y + activeDrag.dragOffset.y;

    const instantVx = (wPos.x - activeDrag.lastPos.x) / dt;
    const instantVy = (wPos.y - activeDrag.lastPos.y) / dt;
    activeDrag.vx = THREE.MathUtils.lerp(activeDrag.vx, instantVx, 0.4);
    activeDrag.vy = THREE.MathUtils.lerp(activeDrag.vy, instantVy, 0.4);
    activeDrag.lastPos = { x: wPos.x, y: wPos.y };

    activeDrag.x = THREE.MathUtils.lerp(activeDrag.x, targetX, 0.46);
    activeDrag.y = THREE.MathUtils.lerp(activeDrag.y, targetY, 0.46);

    if (activeDrag === blobObj) {
      const speed = Math.hypot(blobObj.vx, blobObj.vy);
      blobObj.stretchAngle = Math.atan2(blobObj.vy, blobObj.vx);
      blobObj.stretch = Math.min(speed * 0.00032, 0.32);
      blobObj.eyeLookTarget = {
        x: THREE.MathUtils.clamp((wPos.x - blobObj.x) * 0.12, -10, 10),
        y: THREE.MathUtils.clamp((wPos.y - blobObj.y) * 0.12, -8, 8),
      };
    } else if (activeDrag === letterObj) {
      letterObj.rotationZ = THREE.MathUtils.clamp(letterObj.vx * 0.00045, -0.24, 0.24);
    }
  });

  const onPointerUp = (e: PointerEvent) => {
    if (!activeDrag) return;
    const elapsed = performance.now() - pointerDownTime;

    if (elapsed < 280) {
      // Tap jiggle
      activeDrag.wobble = 0.38;
      activeDrag.wobbleVel = -4.5;
    }

    activeDrag.isDragging = false;
    const maxFlick = 850;
    const speed = Math.hypot(activeDrag.vx, activeDrag.vy);
    if (speed > maxFlick) {
      activeDrag.vx = (activeDrag.vx / speed) * maxFlick;
      activeDrag.vy = (activeDrag.vy / speed) * maxFlick;
    }

    // New drift heading in release direction
    if (speed > 40) {
      activeDrag.steering.heading = Math.atan2(activeDrag.vy, activeDrag.vx);
      activeDrag.steering.targetHeading = activeDrag.steering.heading;
      activeDrag.steering.turnTimer = 3.0;
    }

    activeDrag = null;
    try {
      dom.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointercancel', onPointerUp);

  window.addEventListener('resize', onResize);
}

function onResize() {
  const rect = container.getBoundingClientRect();
  if (rect.width < 80 || rect.height < 80) return;

  stageW = rect.width;
  stageH = rect.height;
  worldHeight = (WORLD_WIDTH * stageH) / stageW;

  const halfW = WORLD_WIDTH / 2;
  const halfH = worldHeight / 2;
  camera.left = -halfW;
  camera.right = halfW;
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();

  renderer.setSize(stageW, stageH);
}

function triggerMagneticSnap() {
  letterObj.isMagnetizing = true;
  letterObj.wobble = 0.3;
}

function setupUI() {
  toggleControlsBtn?.addEventListener('click', () => {
    controlsPanel?.classList.toggle('collapsed');
  });

  sliderRoughness?.addEventListener('input', () => {
    const r = parseFloat(sliderRoughness.value);
    gummyMaterial.roughness = r;
    if (valRoughness) valRoughness.textContent = r.toFixed(2);
  });

  sliderTransmission?.addEventListener('input', () => {
    const t = parseFloat(sliderTransmission.value);
    gummyMaterial.transmission = t;
    if (valTransmission) valTransmission.textContent = t.toFixed(2);
  });

  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      presetBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const preset = btn.getAttribute('data-preset');
      if (preset === 'jelly') {
        gummyMaterial.roughness = 0.22;
        gummyMaterial.transmission = 0.65;
        gummyMaterial.clearcoat = 0.45;
        gummyMaterial.thickness = 2.4;
      } else if (preset === 'candy') {
        gummyMaterial.roughness = 0.16;
        gummyMaterial.transmission = 0.42;
        gummyMaterial.clearcoat = 0.75;
        gummyMaterial.thickness = 1.8;
      } else if (preset === 'mochi') {
        gummyMaterial.roughness = 0.42;
        gummyMaterial.transmission = 0.25;
        gummyMaterial.clearcoat = 0.15;
        gummyMaterial.thickness = 1.2;
      }

      sliderRoughness.value = gummyMaterial.roughness.toString();
      sliderTransmission.value = gummyMaterial.transmission.toString();
      if (valRoughness) valRoughness.textContent = gummyMaterial.roughness.toFixed(2);
      if (valTransmission) valTransmission.textContent = gummyMaterial.transmission.toFixed(2);
    });
  });

  btnMagnet3D?.addEventListener('click', () => {
    triggerMagneticSnap();
  });

  btnReset3D?.addEventListener('click', () => {
    letterObj.isMagnetizing = false;
    letterObj.x = 65;
    letterObj.y = 30;
    letterObj.vx = -120;
    letterObj.vy = -60;
    letterObj.wobble = 0.3;
  });
}

/**
 * 1. CONTINUOUS ORGANIC MORPHING FOR BLOB (8-15% silhouette variation)
 * Spatially coherent displacement field with volume preservation
 */
function updateBlobVertices(time: number) {
  const geom = blobObj.geometry;
  const pos = geom.attributes.position;
  const base = blobObj.basePositions;
  const count = pos.count;

  // Real-time wave wobble factor
  const wobbleAmp = blobObj.wobble * 10.0;
  const t = time * 0.0018;

  for (let i = 0; i < count; i++) {
    const bx = base[i * 3];
    const by = base[i * 3 + 1];
    const bz = base[i * 3 + 2];

    const len = Math.hypot(bx, by, bz);
    const nx = bx / len;
    const ny = by / len;
    const nz = bz / len;

    // Multi-frequency low-harmonic spatial displacement:
    // 1. Primary organic swell (large traveling bulge, ~7% variation)
    const swell1 = Math.sin(nx * 2.2 + ny * 1.8 + t * 1.2) * 0.07;
    // 2. Secondary diagonal harmonic (asymmetric indentation, ~5% variation)
    const swell2 = Math.cos(ny * 2.0 + nz * 2.4 - t * 0.9) * 0.05;
    // 3. Fine surface breathing
    const swell3 = Math.sin((nx + nz) * 2.8 + t * 1.6) * 0.03;

    // Combined smooth organic silhouette variation (approx 8-15% local delta)
    const morphFactor = 1.0 + swell1 + swell2 + swell3;

    // Secondary wave ripple propagating vertically after release/collision
    const wave = Math.sin(by * 0.07 + t * 4.0) * wobbleAmp;

    const finalR = (len * morphFactor + wave);
    pos.setXYZ(i, nx * finalR, ny * finalR, nz * finalR);
  }

  pos.needsUpdate = true;
  geom.computeVertexNormals();
}

/**
 * 2. CONTINUOUS LIVING MORPHING FOR GUMMY LETTER L (4-9% stroke variation)
 * Subtle stroke bending, cap expansion/contraction, and corner fillet breathing
 */
function updateLetterVertices(time: number) {
  const geom = letterObj.geometry;
  const pos = geom.attributes.position;
  const base = letterObj.basePositions;
  const count = pos.count;

  const t = time * 0.0016 + letterObj.steering.phaseOffset;
  const wobbleFactor = letterObj.wobble * 7.0;

  for (let i = 0; i < count; i++) {
    const bx = base[i * 3];
    const by = base[i * 3 + 1];
    const bz = base[i * 3 + 2];

    let dx = 0;
    let dy = 0;
    let dz = 0;

    // A. Vertical stem gentle organic bending (flexes gracefully, ~5-7% width variation)
    if (bx < 5) {
      const stemBend = Math.sin(t * 1.4 + by * 0.04) * 3.8;
      dx += stemBend * (1.0 - Math.abs(by) / 80);
    }

    // B. Bulbous top rounded cap breathing (expansion & contraction, ~6%)
    if (by > 32) {
      const capBreath = Math.sin(t * 1.8) * 0.06;
      dx += (bx + 20) * capBreath;
      dy += (by - 35) * capBreath;
    }

    // C. Horizontal foot bulbous toe breathing (~6%)
    if (bx > 12 && by < -15) {
      const toeBreath = Math.sin(t * 1.6 + 1.2) * 0.06;
      dx += (bx - 15) * toeBreath;
      dy += (by + 35) * toeBreath;
    }

    // D. Corner fillet soft breathing (~4%)
    if (bx < 10 && by < -10) {
      const cornerBreath = Math.cos(t * 1.2 + 0.8) * 2.0;
      dx -= cornerBreath * 0.5;
      dy -= cornerBreath * 0.5;
    }

    // E. Soft thickness breathing along Z
    dz += bz * (Math.sin(t * 1.3 + bx * 0.03) * 0.06);

    // F. Secondary jelly jiggle on collision/tap
    const jiggle = Math.sin(by * 0.08 + t * 4.5) * wobbleFactor;
    dx += jiggle;

    pos.setXYZ(i, bx + dx, by + dy, bz + dz);
  }

  pos.needsUpdate = true;
  geom.computeVertexNormals();
}

/**
 * 3. TIME-EVOLVING DRIFT STEERING FIELD
 * Steers objects smoothly across screen boundaries with gentle repulsion
 */
function updateSteering(obj: BlobPhysics | LetterPhysics, dt: number, bounds: { minX: number; maxX: number; minY: number; maxY: number }) {
  const s = obj.steering;
  s.turnTimer -= dt;

  // Gradually pick new smooth steering direction every 2.5 - 4.5 seconds
  if (s.turnTimer <= 0) {
    s.turnInterval = 2.5 + Math.random() * 2.5;
    s.turnTimer = s.turnInterval;
    // Bias new heading towards center if wandering near edges
    const centerAngle = Math.atan2(-obj.y, -obj.x);
    const wanderJitter = (Math.random() - 0.5) * Math.PI * 1.2;
    s.targetHeading = centerAngle * 0.35 + wanderJitter;
  }

  // Soft boundary repulsion margin (starts steering away 55 units before edge)
  const margin = 60;
  let repelX = 0;
  let repelY = 0;

  if (obj.x < bounds.minX + margin) {
    const factor = (bounds.minX + margin - obj.x) / margin;
    repelX += factor * 35;
  } else if (obj.x > bounds.maxX - margin) {
    const factor = (obj.x - (bounds.maxX - margin)) / margin;
    repelX -= factor * 35;
  }

  if (obj.y < bounds.minY + margin) {
    const factor = (bounds.minY + margin - obj.y) / margin;
    repelY += factor * 35;
  } else if (obj.y > bounds.maxY - margin) {
    const factor = (obj.y - (bounds.maxY - margin)) / margin;
    repelY -= factor * 35;
  }

  // Smoothly blend heading
  s.heading = lerpAngle(s.heading, s.targetHeading, dt * 1.2);

  // Desired drift velocity
  const desiredVx = Math.cos(s.heading) * s.speed + repelX;
  const desiredVy = Math.sin(s.heading) * s.speed + repelY;

  // Gentle steering force (blend into existing velocity)
  const steerStrength = 1.4;
  obj.vx = THREE.MathUtils.lerp(obj.vx, desiredVx, dt * steerStrength);
  obj.vy = THREE.MathUtils.lerp(obj.vy, desiredVy, dt * steerStrength);
}

/**
 * 4. PHYSICS & COLLISION BLENDING
 */
function updatePhysics(dt: number, time: number) {
  const halfW = WORLD_WIDTH / 2 - 35;
  const halfH = worldHeight / 2 - 65;
  const bounds = { minX: -halfW, maxX: halfW, minY: -halfH, maxY: halfH };

  // --- BLOB PHYSICS ---
  if (!blobObj.isDragging) {
    updateSteering(blobObj, dt, bounds);

    blobObj.x += blobObj.vx * dt;
    blobObj.y += blobObj.vy * dt;

    // Hard boundary safety clamp (with soft restitution 0.25)
    const r = blobObj.radius * 0.95;
    if (blobObj.x - r < bounds.minX) {
      blobObj.x = bounds.minX + r;
      blobObj.vx *= -0.25;
      blobObj.wobble = -0.15;
    } else if (blobObj.x + r > bounds.maxX) {
      blobObj.x = bounds.maxX - r;
      blobObj.vx *= -0.25;
      blobObj.wobble = -0.15;
    }

    if (blobObj.y - r < bounds.minY) {
      blobObj.y = bounds.minY + r;
      blobObj.vy *= -0.25;
      blobObj.wobble = 0.2;
    } else if (blobObj.y + r > bounds.maxY) {
      blobObj.y = bounds.maxY - r;
      blobObj.vy *= -0.25;
      blobObj.wobble = 0.2;
    }
  }

  // Blob Damped Spring Oscillators
  const kWobble = 110;
  const dWobble = 9;
  const fWobble = -kWobble * blobObj.wobble - dWobble * blobObj.wobbleVel;
  blobObj.wobbleVel += fWobble * dt;
  blobObj.wobble += blobObj.wobbleVel * dt;

  const kStretch = 130;
  const dStretch = 12;
  const fStretch = -kStretch * blobObj.stretch - dStretch * blobObj.stretchVel;
  blobObj.stretchVel += fStretch * dt;
  blobObj.stretch += blobObj.stretchVel * dt;

  // Blob Mesh Transform & Volume-preserving scale
  blobObj.mesh.position.set(blobObj.x, blobObj.y, 0);
  const sMajor = 1 + blobObj.stretch;
  const sMinor = 1 / Math.sqrt(sMajor);
  blobObj.mesh.scale.set(sMajor, sMinor, sMinor);
  blobObj.mesh.rotation.z = blobObj.stretchAngle;

  // Continuous organic silhouette morphing
  updateBlobVertices(time);

  // Eyes look tracking
  blobObj.eyeLookCurrent.x = THREE.MathUtils.lerp(blobObj.eyeLookCurrent.x, blobObj.eyeLookTarget.x, 0.12);
  blobObj.eyeLookCurrent.y = THREE.MathUtils.lerp(blobObj.eyeLookCurrent.y, blobObj.eyeLookTarget.y, 0.12);
  if (!blobObj.isDragging) {
    // Look gently toward wander direction
    blobObj.eyeLookTarget.x = Math.cos(blobObj.steering.heading) * 6;
    blobObj.eyeLookTarget.y = Math.sin(blobObj.steering.heading) * 4;
  }
  blobObj.eyesGroup.position.set(blobObj.eyeLookCurrent.x, blobObj.eyeLookCurrent.y, 0);

  // --- LETTER L PHYSICS ---
  if (letterObj.isMagnetizing && !letterObj.isDragging) {
    const dx = letterObj.targetX - letterObj.x;
    const dy = letterObj.targetY - letterObj.y;
    const dist = Math.hypot(dx, dy);

    // Magnetic spring pull
    const kMag = 120;
    const dMag = 12;
    letterObj.vx += (kMag * dx - dMag * letterObj.vx) * dt;
    letterObj.vy += (kMag * dy - dMag * letterObj.vy) * dt;
    letterObj.x += letterObj.vx * dt;
    letterObj.y += letterObj.vy * dt;

    letterObj.rotationZ = THREE.MathUtils.lerp(letterObj.rotationZ, 0, 0.14);

    if (dist < 3 && Math.hypot(letterObj.vx, letterObj.vy) < 14) {
      letterObj.x = letterObj.targetX;
      letterObj.y = letterObj.targetY;
      letterObj.vx = 0;
      letterObj.vy = 0;
      letterObj.isMagnetizing = false;
      letterObj.wobble = 0.22;
    }
  } else if (!letterObj.isDragging) {
    updateSteering(letterObj, dt, bounds);

    letterObj.x += letterObj.vx * dt;
    letterObj.y += letterObj.vy * dt;

    // Bounds safety clamp
    const halfLW = 42;
    const halfLH = 62;
    if (letterObj.x - halfLW < bounds.minX) {
      letterObj.x = bounds.minX + halfLW;
      letterObj.vx *= -0.25;
      letterObj.wobble = -0.15;
    } else if (letterObj.x + halfLW > bounds.maxX) {
      letterObj.x = bounds.maxX - halfLW;
      letterObj.vx *= -0.25;
      letterObj.wobble = -0.15;
    }

    if (letterObj.y - halfLH < bounds.minY) {
      letterObj.y = bounds.minY + halfLH;
      letterObj.vy *= -0.25;
      letterObj.wobble = 0.2;
    } else if (letterObj.y + halfLH > bounds.maxY) {
      letterObj.y = bounds.maxY - halfLH;
      letterObj.vy *= -0.25;
      letterObj.wobble = 0.2;
    }
  }

  // Letter wobble spring
  const fLWobble = -kWobble * letterObj.wobble - dWobble * letterObj.wobbleVel;
  letterObj.wobbleVel += fLWobble * dt;
  letterObj.wobble += letterObj.wobbleVel * dt;

  letterObj.mesh.position.set(letterObj.x, letterObj.y, 0);

  // Gentle organic rocking within ±8-10 degrees
  const idleRocking = Math.sin(time * 0.0014 + letterObj.steering.phaseOffset) * 0.14;
  letterObj.mesh.rotation.z = letterObj.rotationZ + idleRocking;

  const sLX = 1 + letterObj.wobble * 0.4;
  const sLY = 1 / Math.sqrt(sLX);
  letterObj.mesh.scale.set(sLX, sLY, sLY);

  // Continuous organic stroke morphing for Letter L
  updateLetterVertices(time);

  // --- MUTUAL SOFT COLLISION ---
  const cdx = letterObj.x - blobObj.x;
  const cdy = letterObj.y - blobObj.y;
  const cdist = Math.hypot(cdx, cdy);
  const minCDist = blobObj.radius + 54;

  if (cdist < minCDist && cdist > 0.001) {
    const overlap = minCDist - cdist;
    const nx = cdx / cdist;
    const ny = cdy / cdist;

    // Gently push apart to eliminate visible mesh penetration
    const push = overlap * 0.5;
    if (!blobObj.isDragging) {
      blobObj.x -= nx * push;
      blobObj.y -= ny * push;
      blobObj.vx -= nx * 45;
      blobObj.vy -= ny * 45;
      blobObj.wobble = -0.16;
      // Deflect wander headings smoothly
      blobObj.steering.heading = Math.atan2(-ny, -nx);
    }
    if (!letterObj.isDragging && !letterObj.isMagnetizing) {
      letterObj.x += nx * push;
      letterObj.y += ny * push;
      letterObj.vx += nx * 45;
      letterObj.vy += ny * 45;
      letterObj.wobble = 0.18;
      letterObj.steering.heading = Math.atan2(ny, nx);
    }
  }
}

/**
 * Main Render Loop
 */
function loop(now: number) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  dt = Math.min(dt, 0.033);

  updatePhysics(dt, now);
  renderer.render(scene, camera);

  // FPS Counter update
  frameCount++;
  if (now - lastFpsUpdate >= 500) {
    const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
    if (fpsTag) fpsTag.textContent = `${fps} FPS`;
    frameCount = 0;
    lastFpsUpdate = now;
  }

  requestAnimationFrame(loop);
}

// Start
initThree();
