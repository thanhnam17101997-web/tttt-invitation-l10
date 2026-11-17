
import { Vec2, clamp, lerp } from './physics';

export type BlobCharacterType =
  | 'pink_dome'
  | 'yellow_star'
  | 'mint_bean'
  | 'lilac_flower'
  | 'gold_coin';

type Bounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type SkinPoint = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type Expression =
  | 'idle'
  | 'curious'
  | 'happy'
  | 'surprised'
  | 'squish'
  | 'stretch'
  | 'shy';

type MotionMode = 'wander' | 'pause' | 'burst';

type Palette = {
  light: string;
  mid: string;
  dark: string;
  rim: string;
  ink: string;
  glow: string;
};

type Personality = {
  speed: number;
  curiosity: number;
  shyness: number;
  burstChance: number;
  noiseFrequency: number;
  sociability: number;
};

const TAU = Math.PI * 2;
const POINT_COUNT = 20;

const PALETTES: Record<BlobCharacterType, Palette> = {
  pink_dome: {
    light: '#FFC3E1',
    mid: '#FF65A2',
    dark: '#CA216C',
    rim: '#8E154D',
    ink: '#49122D',
    glow: '255,188,221',
  },
  yellow_star: {
    light: '#FFF7B9',
    mid: '#FFD75D',
    dark: '#E9A42B',
    rim: '#A96D1D',
    ink: '#68401A',
    glow: '255,234,153',
  },
  mint_bean: {
    light: '#D7FFEE',
    mid: '#78E7CA',
    dark: '#26B8AD',
    rim: '#138881',
    ink: '#17504E',
    glow: '188,255,226',
  },
  lilac_flower: {
    light: '#F9E1FF',
    mid: '#D8A5F0',
    dark: '#9669CC',
    rim: '#65439B',
    ink: '#4F306F',
    glow: '235,193,255',
  },
  gold_coin: {
    light: '#FFE2EE',
    mid: '#FFA9C8',
    dark: '#DD76A4',
    rim: '#A44D7A',
    ink: '#71334F',
    glow: '255,207,227',
  },
};

const PERSONALITIES: Record<
  BlobCharacterType,
  Personality
> = {
  pink_dome: {
    speed: 43,
    curiosity: 0.72,
    shyness: 0.15,
    burstChance: 0.22,
    noiseFrequency: 0.65,
    sociability: 0.65,
  },
  yellow_star: {
    speed: 58,
    curiosity: 0.85,
    shyness: 0.05,
    burstChance: 0.48,
    noiseFrequency: 1.0,
    sociability: 0.85,
  },
  mint_bean: {
    speed: 48,
    curiosity: 0.95,
    shyness: 0.10,
    burstChance: 0.3,
    noiseFrequency: 0.85,
    sociability: 0.8,
  },
  lilac_flower: {
    speed: 34,
    curiosity: 0.35,
    shyness: 0.9,
    burstChance: 0.12,
    noiseFrequency: 0.55,
    sociability: 0.25,
  },
  gold_coin: {
    speed: 40,
    curiosity: 0.60,
    shyness: 0.35,
    burstChance: 0.26,
    noiseFrequency: 0.72,
    sociability: 0.5,
  },
};

function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function ease(
  a: number,
  b: number,
  dt: number,
  rate: number
): number {
  return lerp(a, b, 1 - Math.exp(-rate * dt));
}

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

// Smooth deterministic value noise.
// Different seeds produce independent organic trajectories.
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function noise1D(t: number, seed: number): number {
  const x = t + seed;
  const i = Math.floor(x);
  const f = smoothstep(x - i);

  return lerp(hash(i), hash(i + 1), f);
}

function organicNoise(t: number, seed: number): number {
  return (
    noise1D(t, seed) * 0.65 +
    noise1D(t * 2.13, seed + 91.3) * 0.25 +
    noise1D(t * 4.17, seed + 173.8) * 0.1
  );
}

export class LivingCharacter {
  private static instances = new Set<LivingCharacter>();

  type: BlobCharacterType;

  x: number;
  y: number;
  vx = 0;
  vy = 0;
  radius: number;

  normX: number;
  normY: number;

  isDragging = false;
  dragOffset: Vec2 = { x: 0, y: 0 };
  lastDragPos: Vec2 = { x: 0, y: 0 };

  wobble = 0;
  wobbleVel = 0;
  rotation = 0;
  vRot = 0;
  idlePhase = Math.random() * TAU;

  driftHeading = Math.random() * TAU;
  targetHeading = Math.random() * TAU;
  driftSpeed: number;
  turnTimer = 1;

  eyeOffset: Vec2 = { x: 0, y: 0 };
  targetEyeOffset: Vec2 = { x: 0, y: 0 };
  blinkTimer = 2 + Math.random() * 3;
  blinkProgress = 0;

  readonly numPoints = POINT_COUNT;
  baseOffsets: number[] = [];
  pointDeltas: number[] = [];
  pointVelocities: number[] = [];

  stretch = 0;
  stretchVel = 0;
  stretchAngle = 0;

  private skin: SkinPoint[] = [];
  private rest: Vec2[] = [];

  private palette: Palette;
  private personality: Personality;
  private seed = Math.random() * 1000;

  private elapsed = 0;
  private motionMode: MotionMode = 'wander';
  private modeTimer = 1 + Math.random() * 2;
  private burstPower = 0;

  private pointer: Vec2 = { x: 0, y: 0 };
  private contactAngle = 0;

  private expression: Expression = 'idle';
  private expressionTimer = 0;
  private expressionStrength = 0;

  private faceX = 0;
  private faceY = 0;
  private faceVX = 0;
  private faceVY = 0;
  private faceSquash = 0;

  private gazeTimer = 0;
  private idleGaze = 0;
  private neighborLook: LivingCharacter | null = null;

  private readonly coreStiffness = 56;
  private readonly edgeStiffness = 140;
  private readonly skinDamping = 9;

  constructor(
    type: BlobCharacterType,
    normX: number,
    normY: number,
    radius = 54
  ) {
    this.type = type;
    this.normX = normX;
    this.normY = normY;
    this.radius = radius;

    this.x = normX * 390;
    this.y = normY * 693;

    this.palette = PALETTES[type];
    this.personality = PERSONALITIES[type];

    this.driftSpeed = this.personality.speed;

    this.initializeSkin();
    LivingCharacter.instances.add(this);
  }

  private initializeSkin() {
    this.skin = [];
    this.rest = [];
    this.baseOffsets = [];
    this.pointDeltas = [];
    this.pointVelocities = [];

    for (let i = 0; i < POINT_COUNT; i++) {
      const a = (i / POINT_COUNT) * TAU;

      const variation =
        1 +
        Math.sin(a * 2 + this.seed) * 0.025 +
        Math.cos(a * 3 + this.seed * 0.2) * 0.018;

      const r = this.radius * variation;

      const p = {
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
      };

      this.rest.push({ ...p });
      this.skin.push({ ...p, vx: 0, vy: 0 });

      this.baseOffsets.push(r - this.radius);
      this.pointDeltas.push(0);
      this.pointVelocities.push(0);
    }
  }

  updateProportions(w: number, h: number) {
    this.x = this.normX * w;
    this.y = this.normY * h;
  }

  contains(p: Vec2): boolean {
    return Math.hypot(
      p.x - this.x,
      p.y - this.y
    ) <= this.radius * 1.15;
  }

  private express(type: Expression, duration: number) {
    this.expression = type;
    this.expressionTimer = duration;
    this.expressionStrength = 1;
  }

  private dent(angle: number, amount: number) {
    for (let i = 0; i < POINT_COUNT; i++) {
      const a = (i / POINT_COUNT) * TAU;
      const diff = angleDiff(a, angle);

      const weight = Math.exp(
        -(diff * diff) / (2 * 0.55 * 0.55)
      );

      this.skin[i].x += Math.cos(a) * amount * weight;
      this.skin[i].y += Math.sin(a) * amount * weight;
    }
  }

  applyContact(nx: number, ny: number, penetration: number) {
    if (
      Math.hypot(nx, ny) < 0.001 ||
      penetration <= 0
    ) return;

    const angle = Math.atan2(ny, nx);

    const depth = Math.min(
      penetration * 0.65,
      this.radius * 0.26
    );

    for (let i = 0; i < POINT_COUNT; i++) {
      const a = (i / POINT_COUNT) * TAU;
      const diff = Math.abs(angleDiff(a, angle));

      const indentation = Math.exp(
        -(diff * diff) / (2 * 0.48 * 0.48)
      );

      const shoulderDiff = diff - 1.05;
      const bulge = Math.exp(
        -(shoulderDiff * shoulderDiff) /
        (2 * 0.36 * 0.36)
      );

      const displacement =
        -depth * indentation +
        depth * 0.32 * bulge;

      const targetX =
        this.rest[i].x + Math.cos(a) * displacement;

      const targetY =
        this.rest[i].y + Math.sin(a) * displacement;

      const p = this.skin[i];
      const blend = 0.18;

      p.x = lerp(p.x, targetX, blend);
      p.y = lerp(p.y, targetY, blend);
      p.vx *= 0.88;
      p.vy *= 0.88;
    }

    this.faceSquash = Math.max(
      this.faceSquash,
      Math.min(0.32, penetration / this.radius)
    );

    this.express('squish', 0.28);
  }

  startDrag(p: Vec2) {
    this.isDragging = true;

    this.dragOffset = {
      x: this.x - p.x,
      y: this.y - p.y,
    };

    this.pointer = { ...p };
    this.lastDragPos = { ...p };

    this.vx = 0;
    this.vy = 0;

    this.contactAngle = Math.atan2(
      p.y - this.y,
      p.x - this.x
    );

    this.dent(this.contactAngle, -this.radius * 0.1);
    this.express('curious', 0.4);
  }

  drag(p: Vec2, dt: number) {
    if (!this.isDragging) return;

    const h = Math.max(dt, 1 / 120);
    const dx = p.x - this.lastDragPos.x;
    const dy = p.y - this.lastDragPos.y;

    const pxSpeed = clamp(dx / h, -700, 700);
    const pySpeed = clamp(dy / h, -700, 700);

    this.vx = lerp(this.vx, pxSpeed * 0.25, 0.2);
    this.vy = lerp(this.vy, pySpeed * 0.25, 0.2);

    this.pointer = { ...p };
    this.lastDragPos = { ...p };

    // Delayed center movement preserves the gummy feel.
    const follow = 1 - Math.exp(-h * 7);

    this.x = lerp(
      this.x,
      p.x + this.dragOffset.x,
      follow
    );

    this.y = lerp(
      this.y,
      p.y + this.dragOffset.y,
      follow
    );

    const speed = Math.hypot(pxSpeed, pySpeed);

    this.stretchAngle = Math.atan2(pySpeed, pxSpeed);

    this.stretch = ease(
      this.stretch,
      clamp(speed / 2200, 0, 0.12),
      h,
      8
    );

    this.contactAngle = Math.atan2(
      this.pointer.y - this.y,
      this.pointer.x - this.x
    );

    this.targetEyeOffset = {
      x: clamp((p.x - this.x) * 0.14, -11, 11),
      y: clamp((p.y - this.y) * 0.14, -9, 9),
    };

    if (speed > 85) {
      this.express('stretch', 0.22);
    } else {
      this.express('curious', 0.2);
    }
  }

  endDrag() {
    this.isDragging = false;

    this.vx *= 0.25;
    this.vy *= 0.25;

    this.stretchVel = -0.65;
    this.wobble = 0.12;
    this.wobbleVel = -1.8;

    this.express('surprised', 0.3);
  }

  tap() {
    this.dent(
      Math.random() * TAU,
      -this.radius * 0.13
    );

    this.wobble = 0.22;
    this.wobbleVel = -2.6;

    this.express('surprised', 0.45);
  }

  private getNearestNeighbor(): {
    character: LivingCharacter | null;
    distance: number;
  } {
    let nearest: LivingCharacter | null = null;
    let nearestDistance = Infinity;

    for (const other of LivingCharacter.instances) {
      if (other === this) continue;

      const d = Math.hypot(
        other.x - this.x,
        other.y - this.y
      );

      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = other;
      }
    }

    return {
      character: nearest,
      distance: nearestDistance,
    };
  }

  private chooseMotionMode() {
    const chance = Math.random();

    if (chance < this.personality.burstChance) {
      this.motionMode = 'burst';
      this.modeTimer = 0.35 + Math.random() * 0.55;
      this.burstPower = 1;
      this.express('happy', 0.5);
    } else if (chance < this.personality.burstChance + 0.23) {
      this.motionMode = 'pause';
      this.modeTimer = 0.35 + Math.random() * 0.9;
    } else {
      this.motionMode = 'wander';
      this.modeTimer = 1.3 + Math.random() * 2.5;
    }
  }

  private updateOrganicMotion(
    dt: number,
    bounds: Bounds
  ) {
    this.modeTimer -= dt;

    if (this.modeTimer <= 0) {
      this.chooseMotionMode();
    }

    const f = this.personality.noiseFrequency;
    const t = this.elapsed;

    const noiseX = organicNoise(
      t * f,
      this.seed
    );

    const noiseY = organicNoise(
      t * f + 17.3,
      this.seed + 100.7
    );

    // Noise bends the heading; it does not jump positions.
    const noiseAngle = Math.atan2(
      noiseY,
      noiseX
    );

    this.targetHeading += angleDiff(
      noiseAngle,
      this.targetHeading
    ) * Math.min(1, dt * 2.2);

    const nearest = this.getNearestNeighbor();
    this.neighborLook = nearest.character;

    let socialX = 0;
    let socialY = 0;

    if (nearest.character) {
      const other = nearest.character;
      const dx = other.x - this.x;
      const dy = other.y - this.y;

      const distance = Math.max(
        0.001,
        Math.hypot(dx, dy)
      );

      const nx = dx / distance;
      const ny = dy / distance;

      const comfortDistance =
        this.radius + other.radius + 25;

      if (distance < comfortDistance + 35) {
        // Never deliberately steer into an overlapping blob.
        const avoidance = clamp(
          (comfortDistance + 35 - distance) / 65,
          0,
          1
        );

        socialX -= nx * avoidance * 85;
        socialY -= ny * avoidance * 85;
      } else if (
        distance < 280 &&
        !other.isDragging
      ) {
        const attraction =
          this.personality.sociability *
          this.personality.curiosity;

        socialX += nx * attraction * 21;
        socialY += ny * attraction * 21;
      }

      // Shy characters keep their distance.
      if (distance < 220) {
        socialX -=
          nx * this.personality.shyness * 22;

        socialY -=
          ny * this.personality.shyness * 22;
      }

      // Someone being dragged gets everybody's attention.
      if (other.isDragging && distance < 300) {
        const response =
          this.personality.shyness > 0.6 ? -28 : 17;

        socialX += nx * response;
        socialY += ny * response;

        if (this.personality.shyness > 0.6) {
          this.express('shy', 0.3);
        } else {
          this.express('curious', 0.25);
        }
      }
    }

    let speedFactor = 1;

    if (this.motionMode === 'pause') {
      speedFactor = 0.08;
    } else if (this.motionMode === 'burst') {
      speedFactor = 1.75;
      this.burstPower = ease(
        this.burstPower,
        0,
        dt,
        1.5
      );
    } else {
      // Low-frequency speed modulation.
      speedFactor =
        0.75 +
        (organicNoise(t * 0.7, this.seed + 39) + 1) *
        0.28;
    }

    const desiredSpeed =
      this.personality.speed * speedFactor;

    let desiredVX =
      Math.cos(this.targetHeading) * desiredSpeed +
      socialX;

    let desiredVY =
      Math.sin(this.targetHeading) * desiredSpeed +
      socialY;

    // Gentle steering away from stage boundaries.
    const margin = this.radius + 55;

    if (this.x < bounds.left + margin) {
      desiredVX +=
        (bounds.left + margin - this.x) * 1.7;
    }

    if (this.x > bounds.right - margin) {
      desiredVX -=
        (this.x - (bounds.right - margin)) * 1.7;
    }

    if (this.y < bounds.top + margin) {
      desiredVY +=
        (bounds.top + margin - this.y) * 1.7;
    }

    if (this.y > bounds.bottom - margin) {
      desiredVY -=
        (this.y - (bounds.bottom - margin)) * 1.7;
    }

    // Limit desired speed and acceleration.
    const desiredMagnitude = Math.hypot(
      desiredVX,
      desiredVY
    );

    const maxSpeed = this.motionMode === 'burst'
      ? 110
      : 76;

    if (desiredMagnitude > maxSpeed) {
      desiredVX *= maxSpeed / desiredMagnitude;
      desiredVY *= maxSpeed / desiredMagnitude;
    }

    const responsiveness =
      this.motionMode === 'burst' ? 3.6 : 2.2;

    const nextVX = ease(
      this.vx,
      desiredVX,
      dt,
      responsiveness
    );

    const nextVY = ease(
      this.vy,
      desiredVY,
      dt,
      responsiveness
    );

    const maxAcceleration = 185 * dt;

    const changeX = nextVX - this.vx;
    const changeY = nextVY - this.vy;
    const changeMagnitude = Math.hypot(
      changeX,
      changeY
    );

    const factor = changeMagnitude > maxAcceleration
      ? maxAcceleration / changeMagnitude
      : 1;

    this.vx += changeX * factor;
    this.vy += changeY * factor;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (Math.hypot(this.vx, this.vy) > 20) {
      this.driftHeading = Math.atan2(
        this.vy,
        this.vx
      );
    }
  }

  private updateSkin(dt: number) {
    const steps = Math.max(
      1,
      Math.ceil(dt / (1 / 120))
    );

    const h = dt / steps;

    for (let sub = 0; sub < steps; sub++) {
      const forces: Vec2[] = Array.from(
        { length: POINT_COUNT },
        () => ({ x: 0, y: 0 })
      );

      // Soft inner-to-surface springs.
      for (let i = 0; i < POINT_COUNT; i++) {
        const p = this.skin[i];
        const rest = this.rest[i];

        const angle = (i / POINT_COUNT) * TAU;

        const breathe =
          Math.sin(
            this.elapsed * 1.6 +
            angle * 2 +
            this.seed
          ) * this.radius * 0.018;

        const targetX =
          rest.x + Math.cos(angle) * breathe;

        const targetY =
          rest.y + Math.sin(angle) * breathe;

        forces[i].x +=
          (targetX - p.x) * this.coreStiffness;

        forces[i].y +=
          (targetY - p.y) * this.coreStiffness;
      }

      // Neighbour-to-neighbour springs.
      for (let i = 0; i < POINT_COUNT; i++) {
        const j = (i + 1) % POINT_COUNT;

        const a = this.skin[i];
        const b = this.skin[j];

        const ra = this.rest[i];
        const rb = this.rest[j];

        const restLength = Math.hypot(
          rb.x - ra.x,
          rb.y - ra.y
        );

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.max(
          0.001,
          Math.hypot(dx, dy)
        );

        const force =
          (length - restLength) *
          this.edgeStiffness;

        const fx = dx / length * force;
        const fy = dy / length * force;

        forces[i].x += fx;
        forces[i].y += fy;
        forces[j].x -= fx;
        forces[j].y -= fy;
      }

      // Approximate area conservation.
      let area2 = 0;

      for (let i = 0; i < POINT_COUNT; i++) {
        const a = this.skin[i];
        const b = this.skin[(i + 1) % POINT_COUNT];

        area2 += a.x * b.y - b.x * a.y;
      }

      const area = Math.abs(area2) * 0.5;
      const targetArea =
        Math.PI * this.radius * this.radius;

      const pressure = clamp(
        (targetArea - area) / targetArea,
        -0.25,
        0.25
      );

      for (let i = 0; i < POINT_COUNT; i++) {
        const p = this.skin[i];
        const r = Math.max(
          1,
          Math.hypot(p.x, p.y)
        );

        forces[i].x +=
          p.x / r * pressure * 145;

        forces[i].y +=
          p.y / r * pressure * 145;
      }

      // Broad surface drag patch.
      // Important: no single point receives all the force.
      if (this.isDragging) {
        const targetX = this.pointer.x - this.x;
        const targetY = this.pointer.y - this.y;

        const angle = Math.atan2(
          targetY,
          targetX
        );

        const targetRadius = Math.min(
          Math.hypot(targetX, targetY),
          this.radius * 1.18
        );

        for (let i = 0; i < POINT_COUNT; i++) {
          const p = this.skin[i];
          const a = (i / POINT_COUNT) * TAU;

          const diff = angleDiff(a, angle);
          const influence = Math.exp(
            -(diff * diff) / (2 * 0.52 * 0.52)
          );

          if (influence < 0.03) continue;

          const restRadius = Math.hypot(
            this.rest[i].x,
            this.rest[i].y
          );

          const desiredRadius = lerp(
            restRadius,
            targetRadius,
            influence * 0.72
          );

          const desiredX =
            Math.cos(a) * desiredRadius +
            Math.cos(angle) *
            this.radius * 0.05 * influence;

          const desiredY =
            Math.sin(a) * desiredRadius +
            Math.sin(angle) *
            this.radius * 0.05 * influence;

          forces[i].x +=
            (desiredX - p.x) * 170 * influence;

          forces[i].y +=
            (desiredY - p.y) * 170 * influence;
        }
      }

      const damping = Math.exp(
        -this.skinDamping * h
      );

      for (let i = 0; i < POINT_COUNT; i++) {
        const p = this.skin[i];

        p.vx = clamp(
          (p.vx + forces[i].x * h) * damping,
          -450,
          450
        );

        p.vy = clamp(
          (p.vy + forces[i].y * h) * damping,
          -450,
          450
        );

        p.x += p.vx * h;
        p.y += p.vy * h;

        const r = Math.hypot(p.x, p.y);
        const maxR = this.radius * 1.65;

        if (r > maxR) {
          p.x *= maxR / r;
          p.y *= maxR / r;
          p.vx *= 0.5;
          p.vy *= 0.5;
        }
      }
    }

    for (let i = 0; i < POINT_COUNT; i++) {
      const p = this.skin[i];
      const rest = this.rest[i];

      this.pointDeltas[i] =
        Math.hypot(p.x, p.y) -
        Math.hypot(rest.x, rest.y);

      const angle = (i / POINT_COUNT) * TAU;

      this.pointVelocities[i] =
        p.vx * Math.cos(angle) +
        p.vy * Math.sin(angle);
    }
  }

  private updateFace(dt: number) {
    this.expressionTimer -= dt;

    if (this.expressionTimer <= 0 && !this.isDragging) {
      this.expression = 'idle';
    }

    this.expressionStrength = ease(
      this.expressionStrength,
      0,
      dt,
      2.5
    );

    this.faceSquash = ease(
      this.faceSquash,
      0,
      dt,
      4
    );

    // Face lags a little behind body acceleration.
    const targetX = clamp(
      -this.vx * 0.055,
      -10,
      10
    );

    const targetY = clamp(
      -this.vy * 0.055,
      -9,
      9
    );

    this.faceVX += (
      (targetX - this.faceX) * 85 -
      this.faceVX * 13
    ) * dt;

    this.faceVY += (
      (targetY - this.faceY) * 85 -
      this.faceVY * 13
    ) * dt;

    this.faceX += this.faceVX * dt;
    this.faceY += this.faceVY * dt;

    this.gazeTimer -= dt;

    if (this.gazeTimer <= 0) {
      this.gazeTimer = 0.7 + Math.random() * 1.7;
      this.idleGaze = (Math.random() - 0.5) * 2;

      if (
        this.motionMode === 'pause' &&
        Math.random() < 0.45
      ) {
        this.express('curious', 0.5);
      }
    }

    if (!this.isDragging) {
      const neighbor = this.neighborLook;

      if (neighbor) {
        const dx = neighbor.x - this.x;
        const dy = neighbor.y - this.y;
        const distance = Math.hypot(dx, dy);

        if (distance < 260) {
          this.targetEyeOffset = {
            x: clamp(dx * 0.065, -9, 9),
            y: clamp(dy * 0.065, -7, 7),
          };

          if (
            neighbor.isDragging &&
            this.expressionTimer <= 0
          ) {
            this.express('curious', 0.35);
          }
        } else {
          this.targetEyeOffset = {
            x: this.idleGaze * 5,
            y: Math.sin(this.elapsed * 1.2) * 2,
          };
        }
      } else {
        this.targetEyeOffset = {
          x: this.idleGaze * 5,
          y: Math.sin(this.elapsed) * 2,
        };
      }
    }

    this.eyeOffset.x = ease(
      this.eyeOffset.x,
      this.targetEyeOffset.x,
      dt,
      9
    );

    this.eyeOffset.y = ease(
      this.eyeOffset.y,
      this.targetEyeOffset.y,
      dt,
      9
    );

    this.blinkTimer -= dt;

    if (this.blinkTimer <= 0) {
      this.blinkProgress += dt * 11;

      if (this.blinkProgress >= Math.PI) {
        this.blinkProgress = 0;
        this.blinkTimer = 1.8 + Math.random() * 3.6;
      }
    }
  }

  update(
    dt: number,
    bounds: Bounds,
    stageW: number,
    stageH: number,
    time: number
  ) {
    const h = clamp(dt, 0, 0.04);

    this.elapsed += h;
    this.idlePhase += h;

    if (!this.isDragging) {
      this.updateOrganicMotion(h, bounds);
    }

    // Final hard bounds, with damped contact.
    const r = this.radius;

    if (this.x < bounds.left + r) {
      this.x = bounds.left + r;
      this.vx = Math.max(0, -this.vx * 0.18);
      this.applyContact(-1, 0, r * 0.12);
    }

    if (this.x > bounds.right - r) {
      this.x = bounds.right - r;
      this.vx = Math.min(0, -this.vx * 0.18);
      this.applyContact(1, 0, r * 0.12);
    }

    if (this.y < bounds.top + r) {
      this.y = bounds.top + r;
      this.vy = Math.max(0, -this.vy * 0.18);
      this.applyContact(0, -1, r * 0.12);
    }

    if (this.y > bounds.bottom - r) {
      this.y = bounds.bottom - r;
      this.vy = Math.min(0, -this.vy * 0.18);
      this.applyContact(0, 1, r * 0.12);
    }

    const speed = Math.hypot(this.vx, this.vy);

    if (speed > 135) {
      this.vx = this.vx / speed * 135;
      this.vy = this.vy / speed * 135;
    }

    // Character leans subtly into its motion.
    const targetRotation = clamp(
      this.vx * 0.001,
      -0.1,
      0.1
    );

    this.rotation = ease(
      this.rotation,
      targetRotation +
      Math.sin(this.elapsed * 1.5 + this.seed) * 0.025,
      h,
      2.7
    );

    this.vRot *= Math.exp(-h * 5);

    this.stretchVel += (
      -45 * this.stretch -
      10 * this.stretchVel
    ) * h;

    this.stretch += this.stretchVel * h;
    this.stretch = clamp(this.stretch, -0.1, 0.18);

    this.wobbleVel += (
      -75 * this.wobble -
      12 * this.wobbleVel
    ) * h;

    this.wobble += this.wobbleVel * h;

    // Mild directional deformation during swimming.
    if (!this.isDragging && speed > 35) {
      this.stretchAngle = Math.atan2(this.vy, this.vx);

      this.stretch = ease(
        this.stretch,
        clamp(speed / 1600, 0, 0.055),
        h,
        2.5
      );
    }

    this.updateSkin(h);
    this.updateFace(h);

    if (stageW > 0 && stageH > 0) {
      this.normX = this.x / stageW;
      this.normY = this.y / stageH;
    }

    void time;
  }

  private buildPath(ctx: CanvasRenderingContext2D) {
    const first = this.skin[0];
    const last = this.skin[POINT_COUNT - 1];

    ctx.beginPath();

    ctx.moveTo(
      (first.x + last.x) / 2,
      (first.y + last.y) / 2
    );

    for (let i = 0; i < POINT_COUNT; i++) {
      const a = this.skin[i];
      const b = this.skin[(i + 1) % POINT_COUNT];

      ctx.quadraticCurveTo(
        a.x,
        a.y,
        (a.x + b.x) / 2,
        (a.y + b.y) / 2
      );
    }

    ctx.closePath();
  }

  private drawFace(ctx: CanvasRenderingContext2D) {
    const r = this.radius;
    const ink = this.palette.ink;

    const left = this.skin[POINT_COUNT / 2];
    const right = this.skin[0];
    const top = this.skin[POINT_COUNT * 3 / 4];
    const bottom = this.skin[POINT_COUNT / 4];

    const scaleX = clamp(
      (right.x - left.x) / (r * 2),
      0.75,
      1.25
    );

    const scaleY = clamp(
      (bottom.y - top.y) / (r * 2),
      0.75,
      1.25
    );

    ctx.save();

    ctx.translate(this.faceX, this.faceY);
    ctx.scale(
      lerp(1, scaleX, 0.5),
      lerp(1, scaleY, 0.5)
    );

    const surprised =
      this.expression === 'surprised' ||
      this.expression === 'curious';

    const squished = this.expression === 'squish';
    const stretched = this.expression === 'stretch';
    const shy = this.expression === 'shy';
    const happy = this.expression === 'happy';

    const blink = Math.sin(this.blinkProgress);

    const eyeHeight = Math.max(
      0.8,
      8 *
      (surprised ? 1.28 :
        squished ? 0.35 :
          shy ? 0.65 : 1) *
      (1 - blink * 0.95)
    );

    const eyeWidth =
      surprised ? 5.8 : 4.8;

    const eyeSpacing = r * 0.26;

    // Soft cheek blush.
    ctx.fillStyle = 'rgba(255,100,150,0.16)';

    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(
        side * r * 0.4,
        r * 0.12,
        r * 0.1,
        r * 0.05,
        0,
        0,
        TAU
      );
      ctx.fill();
    }

    // Eyes and pupil glints.
    for (const side of [-1, 1]) {
      const ex =
        side * eyeSpacing + this.eyeOffset.x;

      const ey =
        -r * 0.06 + this.eyeOffset.y;

      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.ellipse(
        ex,
        ey,
        eyeWidth,
        eyeHeight,
        0,
        0,
        TAU
      );
      ctx.fill();

      if (eyeHeight > 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.94)';
        ctx.beginPath();
        ctx.arc(
          ex - 1.2,
          ey - eyeHeight * 0.3,
          1.6,
          0,
          TAU
        );
        ctx.fill();
      }
    }

    const my = r * 0.17;

    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';

    if (
      surprised ||
      stretched
    ) {
      ctx.beginPath();
      ctx.ellipse(
        0,
        my,
        stretched ? 4.3 : 5,
        stretched ? 6.5 : 5.5,
        0,
        0,
        TAU
      );
      ctx.fill();
    } else if (squished) {
      ctx.beginPath();
      ctx.moveTo(-6, my);
      ctx.quadraticCurveTo(0, my + 2, 6, my);
      ctx.stroke();
    } else if (shy) {
      ctx.beginPath();
      ctx.moveTo(-4, my);
      ctx.quadraticCurveTo(0, my + 2, 4, my);
      ctx.stroke();
    } else {
      const smile = happy ? 10 : 6.5;

      ctx.beginPath();
      ctx.moveTo(-smile, my - 2);
      ctx.quadraticCurveTo(
        0,
        my + smile * 0.85,
        smile,
        my - 2
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Read-only V3 skin adapter for the shared WebGL mochi material. */
  getMochiContour(): Array<{ x: number; y: number }> {
    return this.skin.map((point) => ({ x: point.x, y: point.y }));
  }

  getMochiPalette(): { light: string; mid: string; dark: string } {
    return this.palette;
  }

  // Collision deformation remains transform-only: the shared Poisson field
  // stays cached, while the V3 spring returns this squash to neutral.
  applyImpact(normalX: number, normalY: number, overlap: number, speed = 0) {
    const strength = clamp(overlap * 0.012 + speed * 0.00016, 0.035, 0.15);
    // Compress into the collision normal; the mochi expands across it.
    this.stretchAngle = Math.atan2(normalY, normalX) + Math.PI / 2;
    this.stretch = Math.max(this.stretch, strength);
    this.stretchVel = Math.min(this.stretchVel, -strength * 9);
    this.wobble = Math.max(this.wobble, strength * 1.35);
    this.wobbleVel = Math.min(this.wobbleVel, -strength * 12);
  }

  getMochiTransform(): { rotation: number; stretchAngle: number; scaleX: number; scaleY: number } {
    const major = (1 + this.stretch * 0.08) * (1 + this.wobble * 0.12);
    return { rotation: this.rotation, stretchAngle: this.stretchAngle, scaleX: major, scaleY: 1 / major };
  }

  /** Canvas is now only the expressive face overlay; body is WebGL mochi. */
  drawFaceOnly(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    const major = 1 + this.stretch * 0.08;
    ctx.rotate(this.stretchAngle);
    ctx.scale(major, 1 / major);
    ctx.rotate(-this.stretchAngle);
    this.drawFace(ctx);
    ctx.restore();
  }

  // Kept as the Canvas fallback when WebGL is unavailable.
  draw(ctx: CanvasRenderingContext2D, time: number) {
    const r = this.radius;
    const c = this.palette;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    const major = 1 + this.stretch * 0.08;

    ctx.rotate(this.stretchAngle);
    ctx.scale(major, 1 / major);
    ctx.rotate(-this.stretchAngle);

    // Soft shadow.
    ctx.save();
    ctx.shadowColor = 'rgba(12,2,26,0.48)';
    ctx.shadowBlur = 21;
    ctx.shadowOffsetY = 11;

    this.buildPath(ctx);
    ctx.fillStyle = c.dark;
    ctx.fill();
    ctx.restore();

    // Main gummy volume.
    const body = ctx.createRadialGradient(
      -r * 0.34,
      -r * 0.4,
      r * 0.02,
      r * 0.14,
      r * 0.2,
      r * 1.35
    );

    body.addColorStop(0, c.light);
    body.addColorStop(0.34, c.mid);
    body.addColorStop(0.8, c.dark);
    body.addColorStop(1, c.rim);

    this.buildPath(ctx);
    ctx.fillStyle = body;
    ctx.fill();

    ctx.save();
    this.buildPath(ctx);
    ctx.clip();

    const bloom = ctx.createRadialGradient(
      -r * 0.37,
      -r * 0.44,
      0,
      -r * 0.37,
      -r * 0.44,
      r * 0.8
    );

    bloom.addColorStop(
      0,
      'rgba(255,255,255,0.53)'
    );
    bloom.addColorStop(
      0.5,
      'rgba(255,255,255,0.15)'
    );
    bloom.addColorStop(
      1,
      'rgba(255,255,255,0)'
    );

    ctx.fillStyle = bloom;
    ctx.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);

    const transmitted = ctx.createRadialGradient(
      r * 0.1,
      r * 0.55,
      0,
      r * 0.1,
      r * 0.55,
      r
    );

    transmitted.addColorStop(
      0,
      `rgba(${c.glow},0.34)`
    );
    transmitted.addColorStop(
      1,
      `rgba(${c.glow},0)`
    );

    ctx.fillStyle = transmitted;
    ctx.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);

    const glintX =
      -r * 0.34 +
      Math.sin(time * 0.001 + this.seed) *
      r * 0.035;

    const glint = ctx.createRadialGradient(
      glintX,
      -r * 0.45,
      0,
      glintX,
      -r * 0.45,
      r * 0.2
    );

    glint.addColorStop(
      0,
      'rgba(255,255,255,0.38)'
    );

    glint.addColorStop(
      1,
      'rgba(255,255,255,0)'
    );

    ctx.fillStyle = glint;
    ctx.fillRect(-r, -r, r * 2, r * 2);

    this.drawFace(ctx);

    ctx.restore();
    ctx.restore();
  }
}
