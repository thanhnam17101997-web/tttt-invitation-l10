import { Vec2, clamp, lerp } from './physics';

export interface LetterColorTheme {
  name: string;
  gradTop: string;
  gradMid: string;
  gradBase: string;
  gradShadow: string;
  subsurface: string;
  specular: string;
}

export const GUMMY_PALETTES: Record<string, LetterColorTheme> = {
  cream: {
    name: 'cream',
    gradTop: '#FFFFFF',
    gradMid: '#FFF3E0',
    gradBase: '#FFE0B2',
    gradShadow: '#BCAAA4',
    subsurface: 'rgba(255, 224, 178, 0.6)',
    specular: 'rgba(255, 255, 255, 0.95)',
  },
  pink: {
    name: 'pink',
    gradTop: '#FFA8D1',
    gradMid: '#FF3B81',
    gradBase: '#D60055',
    gradShadow: '#7C0032',
    subsurface: 'rgba(255, 145, 120, 0.52)',
    specular: 'rgba(255, 255, 255, 0.88)',
  },
  yellow: {
    name: 'yellow',
    gradTop: '#FFF59D',
    gradMid: '#FFCA28',
    gradBase: '#F57F17',
    gradShadow: '#8D4004',
    subsurface: 'rgba(255, 213, 79, 0.55)',
    specular: 'rgba(255, 255, 255, 0.92)',
  },
  lilac: {
    name: 'lilac',
    gradTop: '#E1BEE7',
    gradMid: '#BA68C8',
    gradBase: '#7B1FA2',
    gradShadow: '#4A148C',
    subsurface: 'rgba(206, 147, 216, 0.52)',
    specular: 'rgba(255, 255, 255, 0.88)',
  },
  mint: {
    name: 'mint',
    gradTop: '#B2EBF2',
    gradMid: '#4DD0E1',
    gradBase: '#0097A7',
    gradShadow: '#006064',
    subsurface: 'rgba(128, 222, 234, 0.55)',
    specular: 'rgba(255, 255, 255, 0.90)',
  },
  coral: {
    name: 'coral',
    gradTop: '#FFCCBC',
    gradMid: '#FF7043',
    gradBase: '#E64A19',
    gradShadow: '#BF360C',
    subsurface: 'rgba(255, 171, 145, 0.52)',
    specular: 'rgba(255, 255, 255, 0.90)',
  },
};

const COLOR_CYCLE: (keyof typeof GUMMY_PALETTES)[] = ['pink', 'yellow', 'lilac', 'mint', 'coral'];

export class GummyGlyph {
  char: string;
  x: number;
  y: number;
  vx = 0;
  vy = 0;

  // Target slot coordinates in the assembled name layout
  targetX = 0;
  targetY = 0;
  scale = 1.0;

  // Visual dimensions
  width = 46;
  height = 62;
  fontSize = 52;
  theme: LetterColorTheme;

  // Physics & soft-body states
  isDragging = false;
  isMagnetizing = false;
  hasSnapped = false;
  dragOffset: Vec2 = { x: 0, y: 0 };
  lastDragPos: Vec2 = { x: 0, y: 0 };

  wobble = 0;
  wobbleVel = 0;
  rotation = 0;
  vRot = 0;
  idlePhase = Math.random() * 10;

  // Drift wandering properties
  driftHeading = Math.random() * Math.PI * 2;
  targetHeading = Math.random() * Math.PI * 2;
  turnTimer = 2.0 + Math.random() * 3.0;

  // Emerging state
  isEmerging = false;
  emergeProgress = 0; // 0..1

  constructor(char: string, x: number, y: number, themeKey: keyof typeof GUMMY_PALETTES = 'pink', scale = 1.0) {
    this.char = char;
    this.x = x;
    this.y = y;
    this.theme = GUMMY_PALETTES[themeKey] || GUMMY_PALETTES.pink;
    this.scale = scale;
    this.fontSize = Math.round(52 * scale);
    this.width = Math.round(44 * scale);
    this.height = Math.round(62 * scale);
  }

  setTarget(tx: number, ty: number, scale = 1.0) {
    this.targetX = tx;
    this.targetY = ty;
    this.scale = scale;
    this.fontSize = Math.round(52 * scale);
    this.width = Math.round(44 * scale);
    this.height = Math.round(62 * scale);
  }

  startDrag(p: Vec2) {
    this.isDragging = true;
    this.isMagnetizing = false;
    this.dragOffset = { x: this.x - p.x, y: this.y - p.y };
    this.lastDragPos = { x: p.x, y: p.y };
    this.vx = 0;
    this.vy = 0;
    this.wobble = -0.22;
  }

  drag(p: Vec2, dt: number) {
    if (!this.isDragging) return;
    const targetX = p.x + this.dragOffset.x;
    const targetY = p.y + this.dragOffset.y;

    if (dt > 0) {
      const instantVx = (p.x - this.lastDragPos.x) / dt;
      const instantVy = (p.y - this.lastDragPos.y) / dt;
      this.vx = lerp(this.vx, instantVx, 0.4);
      this.vy = lerp(this.vy, instantVy, 0.4);
    }
    this.lastDragPos = { x: p.x, y: p.y };

    this.x = lerp(this.x, targetX, 0.48);
    this.y = lerp(this.y, targetY, 0.48);
    this.rotation = clamp(this.vx * 0.00045, -0.25, 0.25);
  }

  endDrag() {
    this.isDragging = false;
    const maxFlick = 750;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > maxFlick) {
      this.vx = (this.vx / speed) * maxFlick;
      this.vy = (this.vy / speed) * maxFlick;
    }
    this.wobble = 0.28;
    this.wobbleVel = -3.5;
  }

  tap() {
    this.wobble = 0.35;
    this.wobbleVel = -4.5;
    this.vRot += (Math.random() - 0.5) * 3;
  }

  triggerSnap() {
    this.isMagnetizing = true;
    this.hasSnapped = false;
    this.wobble = 0.3;
  }

  contains(p: Vec2): boolean {
    const halfW = (this.width / 2) + 8;
    const halfH = (this.height / 2) + 8;
    return Math.abs(p.x - this.x) <= halfW && Math.abs(p.y - this.y) <= halfH;
  }

  update(dt: number, bounds: { left: number; top: number; right: number; bottom: number }, time: number) {
    this.idlePhase += dt;

    if (this.isEmerging && this.emergeProgress < 1.0) {
      this.emergeProgress = Math.min(1.0, this.emergeProgress + dt * 2.2);
    }

    if (this.isMagnetizing && !this.isDragging) {
      // Spring toward target slot with juicy overshoot
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const distance = Math.hypot(dx, dy);

      const kMag = 130;
      const dMag = 12;
      this.vx += (kMag * dx - dMag * this.vx) * dt;
      this.vy += (kMag * dy - dMag * this.vy) * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      this.rotation = lerp(this.rotation, 0, 0.14);

      if (distance < 3 && Math.hypot(this.vx, this.vy) < 15) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.vx = 0;
        this.vy = 0;
        this.rotation = 0;
        if (!this.hasSnapped) {
          this.hasSnapped = true;
          this.wobble = 0.22;
        }
      }
    } else if (!this.isDragging) {
      // Free wander drift
      this.turnTimer -= dt;
      if (this.turnTimer <= 0) {
        this.turnTimer = 2.5 + Math.random() * 3.0;
        this.targetHeading = Math.random() * Math.PI * 2;
      }
      this.driftHeading = lerp(this.driftHeading, this.targetHeading, dt * 1.2);

      const driftSpeed = 12;
      const desiredVx = Math.cos(this.driftHeading) * driftSpeed;
      const desiredVy = Math.sin(this.driftHeading) * driftSpeed;

      this.vx = lerp(this.vx, desiredVx, dt * 1.5);
      this.vy = lerp(this.vy, desiredVy, dt * 1.5);

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      this.rotation += this.vRot * dt;
      this.vRot *= 0.88;
      this.rotation = lerp(this.rotation, Math.sin(time * 0.0015 + this.idlePhase) * 0.1, 0.08);

      // Soft screen boundary clamp
      const margin = 24;
      if (this.x - margin < bounds.left) {
        this.x = bounds.left + margin;
        this.vx *= -0.3;
        this.targetHeading = Math.random() * Math.PI - Math.PI / 2;
      } else if (this.x + margin > bounds.right) {
        this.x = bounds.right - margin;
        this.vx *= -0.3;
        this.targetHeading = Math.random() * Math.PI + Math.PI / 2;
      }

      if (this.y - margin < bounds.top) {
        this.y = bounds.top + margin;
        this.vy *= -0.3;
        this.targetHeading = Math.random() * Math.PI;
      } else if (this.y + margin > bounds.bottom) {
        this.y = bounds.bottom - margin;
        this.vy *= -0.3;
        this.targetHeading = -Math.random() * Math.PI;
      }
    }

    // Wobble spring
    const kWobble = 110;
    const dWobble = 9;
    const fWobble = -kWobble * this.wobble - dWobble * this.wobbleVel;
    this.wobbleVel += fWobble * dt;
    this.wobble += this.wobbleVel * dt;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.isEmerging && this.emergeProgress <= 0.01) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Emerge pop scale & volume preserving squash
    const emergeScale = this.isEmerging ? Math.min(1.0, this.emergeProgress * 1.2) : 1.0;
    const sX = (1 + this.wobble * 0.45) * this.scale * emergeScale;
    const sY = (1 / Math.max(0.4, 1 + this.wobble * 0.45)) * this.scale * emergeScale;
    ctx.scale(sX, sY);

    const t = this.theme;
    const fontSize = 54;
    ctx.font = `800 ${fontSize}px "Fredoka", "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. Soft Ambient Drop Shadow underneath
    ctx.save();
    ctx.shadowColor = 'rgba(10, 2, 22, 0.65)';
    ctx.shadowBlur = 28 * this.scale;
    ctx.shadowOffsetY = 14 * this.scale;
    ctx.shadowOffsetX = 2 * this.scale;
    ctx.fillStyle = t.gradBase;
    ctx.fillText(this.char, 0, 0);
    ctx.restore();

    // 2. Thick 2.5D Rim Bevel (Outer dark rim stroke for deep volume)
    ctx.strokeStyle = t.gradShadow;
    ctx.lineWidth = 14 * this.scale;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeText(this.char, 0, 0);

    // 3. Volumetric Candy Gradient Body
    const textGrad = ctx.createLinearGradient(0, -this.height * 0.5, 0, this.height * 0.5);
    textGrad.addColorStop(0, t.gradTop);
    textGrad.addColorStop(0.28, t.gradMid);
    textGrad.addColorStop(0.75, t.gradBase);
    textGrad.addColorStop(1, t.gradShadow);

    ctx.lineWidth = 10 * this.scale;
    ctx.strokeStyle = textGrad;
    ctx.strokeText(this.char, 0, 0);
    ctx.fillStyle = textGrad;
    ctx.fillText(this.char, 0, 0);

    // 4. Subsurface & Edge Glow (Soft lighter inner stroke)
    ctx.strokeStyle = t.subsurface;
    ctx.lineWidth = 4 * this.scale;
    ctx.strokeText(this.char, 0, -1);

    // 5. Feathered Crest Highlights (Pillowy reflections on top curve)
    ctx.save();
    ctx.fillStyle = t.specular;
    ctx.globalAlpha = 0.85;

    // Soft specular gleam shifted to top-left
    ctx.font = `800 ${fontSize - 4}px "Fredoka", "Be Vietnam Pro", sans-serif`;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2.5 * this.scale;
    ctx.strokeText(this.char, -1.5 * this.scale, -3.5 * this.scale);

    ctx.restore();
    ctx.restore();
  }

  drawTargetSlot(ctx: CanvasRenderingContext2D) {
    if (!this.targetX && !this.targetY) return;
    ctx.save();
    ctx.translate(this.targetX, this.targetY);
    ctx.scale(this.scale, this.scale);

    ctx.font = `800 54px "Fredoka", "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Dotted glowing target outline
    ctx.strokeStyle = 'rgba(255, 215, 120, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    ctx.strokeText(this.char, 0, 0);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillText(this.char, 0, 0);

    ctx.restore();
  }
}

/**
 * Layout Engine: measures text, kerning, and handles responsive wrapping for arbitrary ASCII names
 */
export function buildNameLayout(
  displayName: string,
  centerX: number,
  startY: number,
  maxWidth: number
): { glyphs: GummyGlyph[]; totalHeight: number } {
  const cleanName = displayName.trim().toUpperCase() || 'LINH';

  // Determine line breaks:
  // If short name (e.g. LINH) -> Line 1: "Hi,", Line 2: "LINH!"
  // If medium/long name (e.g. MINH ANH) -> Line 1: "Hi,", Line 2: "MINH ANH!" (or multi-line if needed)
  const lines: string[] = [];
  lines.push('Hi,');

  // Check words in name
  const nameWords = cleanName.split(/\s+/).filter(Boolean);
  if (nameWords.length <= 1) {
    lines.push(`${cleanName}!`);
  } else if (cleanName.length > 12) {
    // Two lines for long names
    const mid = Math.ceil(nameWords.length / 2);
    lines.push(nameWords.slice(0, mid).join(' '));
    lines.push(`${nameWords.slice(mid).join(' ')}!`);
  } else {
    lines.push(`${cleanName}!`);
  }

  // Calculate scaling factor to guarantee safe bounds within maxWidth
  const maxLineLength = Math.max(...lines.map((l) => l.length));
  let scale = 1.0;
  if (maxLineLength > 10) {
    scale = clamp(maxWidth / (maxLineLength * 42), 0.65, 0.95);
  } else if (maxLineLength > 6) {
    scale = clamp(maxWidth / (maxLineLength * 46), 0.8, 1.0);
  }

  const glyphs: GummyGlyph[] = [];
  const lineHeight = Math.round(72 * scale);
  let currentY = startY;
  let colorIndex = 0;

  lines.forEach((line, lineIdx) => {
    const isGreetingLine = lineIdx === 0;
    const charSpacing = Math.round(38 * scale);
    const spaceSpacing = Math.round(22 * scale);

    // Calculate total line width
    let lineWidth = 0;
    for (let i = 0; i < line.length; i++) {
      lineWidth += line[i] === ' ' ? spaceSpacing : charSpacing;
    }

    let currentX = centerX - lineWidth / 2 + (charSpacing / 2);

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === ' ') {
        currentX += spaceSpacing;
        continue;
      }

      // Greeting line uses marshmallow cream, name characters cycle through candy palette
      const themeKey = isGreetingLine ? 'cream' : COLOR_CYCLE[colorIndex % COLOR_CYCLE.length];
      if (!isGreetingLine) colorIndex++;

      // Initial random floating spawn position
      const spawnX = centerX + (Math.random() - 0.5) * 180;
      const spawnY = currentY + 60 + (Math.random() - 0.5) * 140;

      const glyph = new GummyGlyph(char, spawnX, spawnY, themeKey, scale);
      glyph.setTarget(currentX, currentY, scale);
      glyphs.push(glyph);

      currentX += charSpacing;
    }

    currentY += lineHeight;
  });

  return {
    glyphs,
    totalHeight: currentY - startY,
  };
}
