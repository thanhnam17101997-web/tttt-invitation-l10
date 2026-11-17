import { Vec2, clamp, lerp } from './physics';

export class GummyLetterL {
  x: number;
  y: number;
  vx = 0;
  vy = 0;

  // Normalized position in stage (0..1)
  normX = 0.68;
  normY = 0.54;

  // Geometry dimensions
  width = 98;
  height = 142;
  thickness = 42;

  // Global volume-preserving stretch & tilt
  stretch = 0;
  stretchVel = 0;
  rotation = 0;
  vRot = 0;

  // Soft-body jelly jiggle & breathing
  jellyWobble = 0;
  jellyWobbleVel = 0;
  idleTimer = Math.random() * 10;

  // Interaction
  isDragging = false;
  dragTouchPoint: Vec2 = { x: 0, y: 0 };
  dragOffset: Vec2 = { x: 0, y: 0 };
  lastDragPos: Vec2 = { x: 0, y: 0 };

  // Magnetic snap
  isMagnetizing = false;
  targetPos: Vec2 = { x: 0, y: 0 };
  targetNormPos: Vec2 = { x: 0.5, y: 0.36 };
  onSnapped?: () => void;
  hasSnapped = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  updateProportions(stageW: number, stageH: number) {
    this.x = this.normX * stageW;
    this.y = this.normY * stageH;
    this.targetPos = {
      x: this.targetNormPos.x * stageW,
      y: this.targetNormPos.y * stageH,
    };
  }

  setTarget(target: Vec2, normTarget?: Vec2) {
    this.targetPos = { ...target };
    if (normTarget) {
      this.targetNormPos = { ...normTarget };
    }
  }

  triggerMagneticSnap(onSnapped?: () => void) {
    this.isMagnetizing = true;
    this.hasSnapped = false;
    this.onSnapped = onSnapped;
    this.stretch = -0.15;
    this.stretchVel = 2.5;
  }

  releaseMagnetic() {
    this.isMagnetizing = false;
    this.hasSnapped = false;
  }

  contains(p: Vec2): boolean {
    const lx = p.x - this.x;
    const ly = p.y - this.y;

    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const t = this.thickness;

    // Organic chubby L bounds with generous pill margins
    const inStem = lx >= -halfW - 6 && lx <= -halfW + t + 16 && ly >= -halfH - 10 && ly <= halfH + 8;
    const inFoot = lx >= -halfW - 10 && lx <= halfW + 10 && ly >= halfH - t - 16 && ly <= halfH + 10;

    return inStem || inFoot;
  }

  startDrag(p: Vec2) {
    this.isDragging = true;
    this.isMagnetizing = false;
    this.dragTouchPoint = { ...p };
    this.dragOffset = { x: this.x - p.x, y: this.y - p.y };
    this.lastDragPos = { x: p.x, y: p.y };
    this.vx = 0;
    this.vy = 0;

    // Indent slightly at grab point
    this.jellyWobble = -0.18;
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

    this.x = lerp(this.x, targetX, 0.44);
    this.y = lerp(this.y, targetY, 0.44);

    // Dynamic tilt & stretch
    this.rotation = clamp(this.vx * 0.00045, -0.2, 0.2);
    const speed = Math.hypot(this.vx, this.vy);
    const targetStretch = clamp(speed * 0.0003, 0, 0.25);
    this.stretch = lerp(this.stretch, targetStretch, 0.25);
  }

  endDrag() {
    this.isDragging = false;
    const maxFlick = 700;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > maxFlick) {
      this.vx = (this.vx / speed) * maxFlick;
      this.vy = (this.vy / speed) * maxFlick;
    }

    // Secondary delayed jelly recovery
    this.jellyWobble = 0.25;
    this.jellyWobbleVel = -3.0;
  }

  tap() {
    this.jellyWobble = 0.32;
    this.jellyWobbleVel = -4.5;
    this.vRot += (Math.random() - 0.5) * 3;
  }

  update(dt: number, bounds: { left: number; top: number; right: number; bottom: number }, stageW: number, stageH: number) {
    this.idleTimer += dt;

    // 1. Magnetic motion or free physics
    if (this.isMagnetizing && !this.isDragging) {
      const dx = this.targetPos.x - this.x;
      const dy = this.targetPos.y - this.y;
      const distance = Math.hypot(dx, dy);

      // Soft magnetic spring with overshoot
      const kMag = 110;
      const dMag = 11;
      const fx = kMag * dx - dMag * this.vx;
      const fy = kMag * dy - dMag * this.vy;

      this.vx += fx * dt;
      this.vy += fy * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      this.rotation = lerp(this.rotation, 0, 0.12);

      if (distance < 5 && Math.hypot(this.vx, this.vy) < 18) {
        this.x = this.targetPos.x;
        this.y = this.targetPos.y;
        this.vx = 0;
        this.vy = 0;
        this.rotation = 0;

        if (!this.hasSnapped) {
          this.hasSnapped = true;
          this.jellyWobble = 0.22;
          this.onSnapped?.();
        }
      }
    } else if (!this.isDragging) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Viscous gelatin damping (not rubber ball)
      this.vx *= Math.pow(0.90, dt * 60);
      this.vy *= Math.pow(0.90, dt * 60);

      // Subtle resting float
      this.vy += Math.sin(this.idleTimer * 1.5 + 0.8) * 3.5 * dt;

      // Rotation settling
      this.rotation += this.vRot * dt;
      this.vRot *= 0.88;
      this.rotation = lerp(this.rotation, 0, 0.06);

      // Soft boundary collisions
      const halfW = this.width / 2;
      const halfH = this.height / 2;
      const restitution = 0.28;

      if (this.x - halfW < bounds.left) {
        this.x = bounds.left + halfW;
        this.vx = -this.vx * restitution;
        this.jellyWobble = -0.18;
      } else if (this.x + halfW > bounds.right) {
        this.x = bounds.right - halfW;
        this.vx = -this.vx * restitution;
        this.jellyWobble = -0.18;
      }

      if (this.y - halfH < bounds.top) {
        this.y = bounds.top + halfH;
        this.vy = -this.vy * restitution;
        this.jellyWobble = 0.2;
      } else if (this.y + halfH > bounds.bottom) {
        this.y = bounds.bottom - halfH;
        this.vy = -this.vy * restitution;
        this.jellyWobble = 0.22;
      }
    }

    // Keep normalized coordinates in sync
    if (stageW > 0 && stageH > 0) {
      this.normX = this.x / stageW;
      this.normY = this.y / stageH;
    }

    // 2. Volume-preserving stretch spring
    const kStretch = 130;
    const dStretch = 12;
    const fStretch = -kStretch * this.stretch - dStretch * this.stretchVel;
    this.stretchVel += fStretch * dt;
    this.stretch += this.stretchVel * dt;

    // 3. Secondary jelly wobble oscillator
    const kWobble = 95;
    const dWobble = 8;
    const fWobble = -kWobble * this.jellyWobble - dWobble * this.jellyWobbleVel;
    this.jellyWobbleVel += fWobble * dt;
    this.jellyWobble += this.jellyWobbleVel * dt;
  }

  /**
   * Builds an organic, chubby, marshmallow-gummy 'L' contour
   */
  private buildOrganicLPath(ctx: CanvasRenderingContext2D, inset = 0) {
    const w = this.width - inset * 2;
    const h = this.height - inset * 2;
    const t = this.thickness - inset * 0.7;

    const left = -w / 2 + inset;
    const right = w / 2 - inset;
    const top = -h / 2 + inset;
    const bottom = h / 2 - inset;

    // Bulbous top cap
    const topCapR = t * 0.52;
    // Bulbous foot toe
    const footToeR = t * 0.50;
    // Fleshy inner bend radius
    const innerBendR = 18;
    // Fleshy outer bend radius
    const outerBendR = 28;

    ctx.beginPath();
    // 1. Bulbous rounded top cap
    ctx.arc(left + topCapR, top + topCapR, topCapR, Math.PI, 0, false);

    // 2. Down inner vertical stem with soft waist pinch
    const innerCornerX = left + t;
    const innerCornerY = bottom - t;
    const midStemY = (top + topCapR + innerCornerY - innerBendR) / 2;

    // Gentle organic curvature down the vertical inner edge
    ctx.quadraticCurveTo(innerCornerX - 1.5, midStemY, innerCornerX, innerCornerY - innerBendR);

    // Soft fleshy inner bend fillet
    ctx.arcTo(innerCornerX, innerCornerY, innerCornerX + innerBendR, innerCornerY, innerBendR);

    // 3. Along top edge of foot toward bulbous toe
    ctx.lineTo(right - footToeR, innerCornerY);
    // Bulbous rounded toe cap
    ctx.arc(right - footToeR, bottom - footToeR, footToeR, -Math.PI / 2, Math.PI / 2, false);

    // 4. Along bottom edge to rounded outer heel
    ctx.lineTo(left + outerBendR, bottom);
    ctx.arcTo(left, bottom, left, bottom - outerBendR, outerBendR);

    // 5. Up outer vertical edge with gentle organic swell
    ctx.quadraticCurveTo(left + 1, midStemY, left, top + topCapR);
    ctx.closePath();
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Volume-preserving scale: sX = 1 + stretch + wobble, sY = 1 / sX
    const sX = 1 + this.stretch + this.jellyWobble * 0.5;
    const sY = 1 / Math.max(0.4, 1 + this.stretch - this.jellyWobble * 0.5);
    ctx.scale(sX, sY);

    // Organic idle breathing
    const breath = Math.sin(this.idleTimer * 1.6 + 1.2) * 0.018;
    ctx.scale(1 + breath, 1 + breath);

    // 1. Soft Ambient Drop Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(12, 2, 26, 0.65)';
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 18;
    ctx.shadowOffsetX = 3;
    ctx.fillStyle = '#E50058';
    this.buildOrganicLPath(ctx);
    ctx.fill();
    ctx.restore();

    // 2. Translucent Gummy Candy Shading (Soft depth)
    const bodyGrad = ctx.createLinearGradient(
      -this.width * 0.38, -this.height * 0.48,
      this.width * 0.42, this.height * 0.52
    );
    bodyGrad.addColorStop(0, '#FFA5CE');    // soft translucent crown
    bodyGrad.addColorStop(0.24, '#FF3B81'); // saturated strawberry gummy
    bodyGrad.addColorStop(0.70, '#D60055'); // rich berry body
    bodyGrad.addColorStop(1, '#7C0032');    // deep velvety plum underside

    this.buildOrganicLPath(ctx);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // 3. Clipped Subsurface Glow & Diffused Highlights
    ctx.save();
    this.buildOrganicLPath(ctx);
    ctx.clip();

    // Warm subsurface light leaking through edges (peach/coral glow)
    const sssGrad = ctx.createRadialGradient(
      this.width * 0.35, this.height * 0.35, 10,
      this.width * 0.35, this.height * 0.35, this.width * 0.75
    );
    sssGrad.addColorStop(0, 'rgba(255, 145, 115, 0.52)');
    sssGrad.addColorStop(1, 'rgba(255, 145, 115, 0)');
    ctx.fillStyle = sssGrad;
    ctx.fill();

    // 4. Broad Diffused Highlights (No harsh stickers)
    // A. Stem diffused glow & soft crest highlight
    const stemX = -this.width / 2 + this.thickness / 2 - 2;

    // Broad soft bloom on stem
    const stemBloom = ctx.createLinearGradient(stemX - 18, 0, stemX + 18, 0);
    stemBloom.addColorStop(0, 'rgba(255, 255, 255, 0)');
    stemBloom.addColorStop(0.5, 'rgba(255, 225, 240, 0.35)');
    stemBloom.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = stemBloom;
    ctx.fillRect(stemX - 18, -this.height * 0.45, 36, this.height * 0.72);

    // Soft feathered crest gleam on vertical stem
    ctx.save();
    ctx.translate(stemX - 1, -12);
    const stemGleam = ctx.createLinearGradient(-6, 0, 6, 0);
    stemGleam.addColorStop(0, 'rgba(255, 255, 255, 0)');
    stemGleam.addColorStop(0.5, 'rgba(255, 255, 255, 0.78)');
    stemGleam.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = stemGleam;
    ctx.beginPath();
    ctx.roundRect(-5, -this.height * 0.30, 10, this.height * 0.56, 5);
    ctx.fill();
    ctx.restore();

    // B. Bulbous top rounded highlight
    ctx.beginPath();
    ctx.arc(stemX - 2, -this.height / 2 + this.thickness / 2 - 2, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.fill();

    // C. Horizontal foot diffused crest highlight
    const footY = this.height / 2 - this.thickness / 2 + 1;
    ctx.save();
    ctx.translate(10, footY);
    const footGleam = ctx.createLinearGradient(0, -6, 0, 6);
    footGleam.addColorStop(0, 'rgba(255, 255, 255, 0)');
    footGleam.addColorStop(0.5, 'rgba(255, 255, 255, 0.75)');
    footGleam.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = footGleam;
    ctx.beginPath();
    ctx.roundRect(-this.width * 0.20, -4, this.width * 0.42, 8, 4);
    ctx.fill();
    ctx.restore();

    ctx.restore(); // end clip
    ctx.restore(); // end transform
  }

  drawTargetSlot(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.targetPos.x, this.targetPos.y);

    // Soft glowing candy silhouette
    ctx.shadowColor = 'rgba(255, 194, 71, 0.35)';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = 'rgba(255, 215, 120, 0.38)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 8]);
    this.buildOrganicLPath(ctx);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fill();

    ctx.restore();
  }
}
