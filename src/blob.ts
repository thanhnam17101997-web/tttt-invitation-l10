import { Vec2, vec, clamp, lerp } from './physics';

export class GlossyBlob {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  radius: number;

  // Normalized position in stage (0..1) to survive Safari resizing
  normX = 0.36;
  normY = 0.62;

  // Soft-body mesh with 16 perimeter nodes
  numPoints = 16;
  // Natural asymmetric resting radius offsets (mochi / gummy drop shape)
  baseOffsets: number[];
  pointDeltas: number[];
  pointVelocities: number[];

  // Global squash/stretch with volume preservation
  stretch = 0; // 0 = rest, positive = stretched along angle
  stretchVel = 0;
  stretchAngle = 0;

  // Interaction
  isDragging = false;
  dragTouchPoint: Vec2 = { x: 0, y: 0 };
  dragOffset: Vec2 = { x: 0, y: 0 };
  lastDragPos: Vec2 = { x: 0, y: 0 };

  // Idle animation & breathing
  idleTimer = Math.random() * 10;

  // Living face features
  eyeOffset: Vec2 = { x: 0, y: 0 };
  targetEyeOffset: Vec2 = { x: 0, y: 0 };
  blinkTimer = 2.8;
  blinkProgress = 0;

  constructor(x: number, y: number, radius = 76) {
    this.x = x;
    this.y = y;
    this.radius = radius;

    this.pointDeltas = new Array(this.numPoints).fill(0);
    this.pointVelocities = new Array(this.numPoints).fill(0);

    // Asymmetric organic resting shape (broader resting base, softer shoulders)
    this.baseOffsets = new Array(this.numPoints);
    for (let i = 0; i < this.numPoints; i++) {
      const theta = (i / this.numPoints) * Math.PI * 2;
      // Slight base widening (bottom hemisphere is flatter & broader like resting gelatin)
      const baseDrop = Math.sin(theta) * 0.08;
      // Subtle organic irregularity
      const organicVar = Math.cos(theta * 3 + 0.5) * 0.04 + Math.sin(theta * 2) * 0.03;
      this.baseOffsets[i] = (baseDrop + organicVar) * this.radius;
    }
  }

  updateProportions(stageW: number, stageH: number) {
    this.x = this.normX * stageW;
    this.y = this.normY * stageH;
    this.radius = Math.min(stageW * 0.19, 78);
  }

  contains(p: Vec2): boolean {
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    return Math.hypot(dx, dy) <= this.radius * 1.15;
  }

  startDrag(p: Vec2) {
    this.isDragging = true;
    this.dragTouchPoint = { ...p };
    this.dragOffset = { x: this.x - p.x, y: this.y - p.y };
    this.lastDragPos = { x: p.x, y: p.y };
    this.vx = 0;
    this.vy = 0;

    // Local touch indentation / suction at contact angle
    const localAngle = Math.atan2(p.y - this.y, p.x - this.x);
    this.applyLocalDeformation(localAngle, -12, 1.4);
  }

  drag(p: Vec2, dt: number) {
    if (!this.isDragging) return;
    const targetX = p.x + this.dragOffset.x;
    const targetY = p.y + this.dragOffset.y;

    if (dt > 0) {
      const instantVx = (p.x - this.lastDragPos.x) / dt;
      const instantVy = (p.y - this.lastDragPos.y) / dt;
      this.vx = lerp(this.vx, instantVx, 0.35);
      this.vy = lerp(this.vy, instantVy, 0.35);
    }
    this.lastDragPos = { x: p.x, y: p.y };

    // Fluid drag lag
    this.x = lerp(this.x, targetX, 0.42);
    this.y = lerp(this.y, targetY, 0.42);

    // Dynamic stretch along travel vector
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 40) {
      this.stretchAngle = Math.atan2(this.vy, this.vx);
      const targetStretch = clamp(speed * 0.00035, 0, 0.28);
      this.stretch = lerp(this.stretch, targetStretch, 0.3);
    }

    // Local jelly pull toward drag contact
    const contactAngle = Math.atan2(p.y - this.y, p.x - this.x);
    this.applyLocalDeformation(contactAngle, 6, 1.2);

    // Gaze follows touch
    this.targetEyeOffset = {
      x: clamp((p.x - this.x) * 0.1, -12, 12),
      y: clamp((p.y - this.y) * 0.1, -8, 8),
    };
  }

  endDrag() {
    this.isDragging = false;
    // Cap flick velocity to preserve softness (not pinball)
    const maxFlick = 700;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > maxFlick) {
      this.vx = (this.vx / speed) * maxFlick;
      this.vy = (this.vy / speed) * maxFlick;
    }

    // Secondary jelly wave ripple on release
    for (let i = 0; i < this.numPoints; i++) {
      this.pointVelocities[i] += Math.sin(i * 1.5) * 45;
    }
  }

  tap(p?: Vec2) {
    if (p) {
      const contactAngle = Math.atan2(p.y - this.y, p.x - this.x);
      this.applyLocalDeformation(contactAngle, -16, 1.5);
    } else {
      this.stretch = -0.22;
      this.stretchVel = 3.5;
    }
  }

  /**
   * Applies local soft-body indentation or pull at a specific angle
   */
  private applyLocalDeformation(angle: number, amount: number, spread = 1.2) {
    for (let i = 0; i < this.numPoints; i++) {
      const theta = (i / this.numPoints) * Math.PI * 2;
      let diff = Math.abs(theta - angle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;

      if (diff < spread) {
        const falloff = Math.cos((diff / spread) * (Math.PI / 2));
        this.pointDeltas[i] += amount * falloff;
      }
    }
  }

  update(dt: number, bounds: { left: number; top: number; right: number; bottom: number }, stageW: number, stageH: number) {
    this.idleTimer += dt;

    // 1. Position & momentum
    if (!this.isDragging) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Viscous damping (gelatin, not rubber ball)
      this.vx *= Math.pow(0.90, dt * 60);
      this.vy *= Math.pow(0.90, dt * 60);

      // Subtle resting idle float
      this.vy += Math.sin(this.idleTimer * 1.4) * 4 * dt;
      this.vx += Math.cos(this.idleTimer * 1.1) * 3 * dt;

      // Soft boundary handling (low restitution ~0.28)
      const r = this.radius * 0.95;
      const restitution = 0.28;

      if (this.x - r < bounds.left) {
        this.x = bounds.left + r;
        this.vx = -this.vx * restitution;
        this.applyLocalDeformation(Math.PI, -14);
      } else if (this.x + r > bounds.right) {
        this.x = bounds.right - r;
        this.vx = -this.vx * restitution;
        this.applyLocalDeformation(0, -14);
      }

      if (this.y - r < bounds.top) {
        this.y = bounds.top + r;
        this.vy = -this.vy * restitution;
        this.applyLocalDeformation(-Math.PI / 2, -14);
      } else if (this.y + r > bounds.bottom) {
        this.y = bounds.bottom - r;
        this.vy = -this.vy * restitution;
        this.applyLocalDeformation(Math.PI / 2, -14);
      }
    }

    // Keep normalized coordinates in sync
    if (stageW > 0 && stageH > 0) {
      this.normX = this.x / stageW;
      this.normY = this.y / stageH;
    }

    // 2. Global stretch volume-preserving spring
    const kStretch = 140;
    const dStretch = 13;
    const fStretch = -kStretch * this.stretch - dStretch * this.stretchVel;
    this.stretchVel += fStretch * dt;
    this.stretch += this.stretchVel * dt;

    // 3. Perimeter nodes coupled spring simulation (traveling waves)
    const kAnchor = 110;  // Anchor to rest shape
    const dAnchor = 9;    // Node damping
    const kCoupling = 45; // Neighbor shear tension coupling for jelly waves

    for (let i = 0; i < this.numPoints; i++) {
      const prev = (i - 1 + this.numPoints) % this.numPoints;
      const next = (i + 1) % this.numPoints;

      // Neighbor shear force
      const shearForce = kCoupling * ((this.pointDeltas[prev] - this.pointDeltas[i]) + (this.pointDeltas[next] - this.pointDeltas[i]));
      // Anchor restoring force
      const anchorForce = -kAnchor * this.pointDeltas[i] - dAnchor * this.pointVelocities[i];

      const totalForce = anchorForce + shearForce;
      this.pointVelocities[i] += totalForce * dt;
      this.pointDeltas[i] += this.pointVelocities[i] * dt;
    }

    // 4. Living face & gaze
    this.eyeOffset.x = lerp(this.eyeOffset.x, this.targetEyeOffset.x, 0.12);
    this.eyeOffset.y = lerp(this.eyeOffset.y, this.targetEyeOffset.y, 0.12);
    if (!this.isDragging) {
      this.targetEyeOffset.x = Math.sin(this.idleTimer * 0.8) * 5;
      this.targetEyeOffset.y = Math.cos(this.idleTimer * 0.6) * 3;
    }

    // Blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkProgress += dt * 8;
      if (this.blinkProgress >= Math.PI) {
        this.blinkProgress = 0;
        this.blinkTimer = 2.5 + Math.random() * 3.5;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Compute volume-preserving scale: major = 1 + stretch, minor = 1 / (1 + stretch)
    const sMajor = 1 + this.stretch;
    const sMinor = 1 / Math.max(0.4, sMajor);

    ctx.rotate(this.stretchAngle);
    ctx.scale(sMajor, sMinor);
    ctx.rotate(-this.stretchAngle);

    // Organic shape breathing during idle
    const breath = Math.sin(this.idleTimer * 1.8) * 0.022;

    // 1. Build soft-body spline path
    ctx.beginPath();
    const pts: Vec2[] = [];
    for (let i = 0; i < this.numPoints; i++) {
      const theta = (i / this.numPoints) * Math.PI * 2;
      // Combine base radius + asymmetric resting contour + breathing + elastic delta
      const r = (this.radius + this.baseOffsets[i]) * (1 + breath) + this.pointDeltas[i];
      pts.push(vec(Math.cos(theta) * r, Math.sin(theta) * r));
    }

    const len = pts.length;
    ctx.moveTo((pts[0].x + pts[len - 1].x) / 2, (pts[0].y + pts[len - 1].y) / 2);
    for (let i = 0; i < len; i++) {
      const next = pts[(i + 1) % len];
      const mid = vec((pts[i].x + next.x) / 2, (pts[i].y + next.y) / 2);
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mid.x, mid.y);
    }
    ctx.closePath();

    // 2. Soft Ambient Drop Shadow (subtle spatial lighting, not flat black)
    ctx.save();
    ctx.shadowColor = 'rgba(14, 3, 28, 0.62)';
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 20;
    ctx.fillStyle = '#E50058';
    ctx.fill();
    ctx.restore();

    // 3. Translucent Gummy Body Shading (Soft depth, not hard plastic)
    // Core radial gradient with smooth luminous falloff
    const bodyGrad = ctx.createRadialGradient(
      -this.radius * 0.28, -this.radius * 0.32, this.radius * 0.1,
      0, 0, this.radius * 1.15
    );
    bodyGrad.addColorStop(0, '#FFA2CD');    // luminous translucent inner pink
    bodyGrad.addColorStop(0.22, '#FF3D82');  // vibrant saturated raspberry gummy
    bodyGrad.addColorStop(0.68, '#D60055');  // deep translucent jelly body
    bodyGrad.addColorStop(0.96, '#7E0034');  // rich velvety plum edge
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // 4. Subsurface & Highlights (Clipped inside the jelly contour)
    ctx.save();
    ctx.clip();

    // Warm subsurface light transmission (peach/coral glow at edges)
    const sssGrad = ctx.createRadialGradient(
      this.radius * 0.3, this.radius * 0.45, this.radius * 0.15,
      this.radius * 0.3, this.radius * 0.45, this.radius * 0.75
    );
    sssGrad.addColorStop(0, 'rgba(255, 145, 120, 0.48)');
    sssGrad.addColorStop(1, 'rgba(255, 145, 120, 0)');
    ctx.fillStyle = sssGrad;
    ctx.fill();

    // 5. Broad, Soft Diffused Top Highlight (No harsh white stickers)
    // Large diffused luminous bloom
    const bloomGrad = ctx.createRadialGradient(
      -this.radius * 0.32, -this.radius * 0.38, 4,
      -this.radius * 0.32, -this.radius * 0.38, this.radius * 0.58
    );
    bloomGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
    bloomGrad.addColorStop(0.35, 'rgba(255, 225, 240, 0.32)');
    bloomGrad.addColorStop(1, 'rgba(255, 225, 240, 0)');
    ctx.fillStyle = bloomGrad;
    ctx.beginPath();
    ctx.arc(-this.radius * 0.32, -this.radius * 0.38, this.radius * 0.58, 0, Math.PI * 2);
    ctx.fill();

    // Soft feathered crest gleam along upper curve (feathered edges, not sharp)
    ctx.save();
    ctx.translate(-this.radius * 0.30, -this.radius * 0.42);
    ctx.rotate(-0.55);
    const gleamGrad = ctx.createLinearGradient(-this.radius * 0.28, 0, this.radius * 0.28, 0);
    gleamGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gleamGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.72)');
    gleamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gleamGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.radius * 0.28, this.radius * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Secondary tiny soft glow spot
    ctx.beginPath();
    ctx.arc(-this.radius * 0.06, -this.radius * 0.52, this.radius * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.fill();

    // (Note: artificial bottom oval highlight REMOVED per user instruction)

    // 6. Living Expressive Eyes
    const blinkAmount = Math.sin(this.blinkProgress);
    const eyeY = -this.radius * 0.06 + this.eyeOffset.y;
    const eyeSpacing = this.radius * 0.32;
    const eyeH = 11.5 * (1 - blinkAmount * 0.95);
    const eyeW = 7;

    [-1, 1].forEach((dir) => {
      const eyeX = dir * eyeSpacing + this.eyeOffset.x;
      ctx.save();
      ctx.translate(eyeX, eyeY);

      // Soft eye socket shadow
      ctx.fillStyle = 'rgba(100, 0, 40, 0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 1.2, eyeW, Math.max(1, eyeH), 0, 0, Math.PI * 2);
      ctx.fill();

      // Eye bean
      ctx.fillStyle = '#160222';
      ctx.beginPath();
      ctx.ellipse(0, 0, eyeW, Math.max(1, eyeH), 0, 0, Math.PI * 2);
      ctx.fill();

      // Specular catchlights (when eyes are open)
      if (eyeH > 4) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-1.8, -eyeH * 0.28, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(1.4, eyeH * 0.22, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    ctx.restore(); // end clip
    ctx.restore(); // end transform
  }
}
