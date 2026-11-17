import { Vec2, clamp, lerp } from './physics';
import { UI_TEXT } from './ui-text';

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
const HERO_FONT_SIZE = 100;
const narrowGlyphWidth = (char: string) => /[iI!]/.test(char) ? 1.5 : 1;


// During budding, the letter shares its host's material rather than
// appearing as a separately colored object on top of the body.
const SOURCE_MATERIAL: Record<string, LetterColorTheme> = {
  pink_dome: {
    name: 'pink-source', gradTop: '#FFC3E1', gradMid: '#FF65A2',
    gradBase: '#CA216C', gradShadow: '#8E154D',
    subsurface: 'rgba(255,188,221,0.52)', specular: 'rgba(255,255,255,0.9)',
  },
  yellow_star: {
    name: 'yellow-source', gradTop: '#FFF7B9', gradMid: '#FFD75D',
    gradBase: '#E9A42B', gradShadow: '#A96D1D',
    subsurface: 'rgba(255,234,153,0.52)', specular: 'rgba(255,255,255,0.9)',
  },
  mint_bean: {
    name: 'mint-source', gradTop: '#D7FFEE', gradMid: '#78E7CA',
    gradBase: '#26B8AD', gradShadow: '#138881',
    subsurface: 'rgba(188,255,226,0.52)', specular: 'rgba(255,255,255,0.9)',
  },
  lilac_flower: {
    name: 'lilac-source', gradTop: '#F9E1FF', gradMid: '#D8A5F0',
    gradBase: '#9669CC', gradShadow: '#65439B',
    subsurface: 'rgba(235,193,255,0.52)', specular: 'rgba(255,255,255,0.9)',
  },
  gold_coin: {
    name: 'rose-source', gradTop: '#FFE2EE', gradMid: '#FFA9C8',
    gradBase: '#DD76A4', gradShadow: '#A44D7A',
    subsurface: 'rgba(255,207,227,0.52)', specular: 'rgba(255,255,255,0.9)',
  },
};

function smooth01(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function mixHex(a: string, b: string, weight: number): string {
  const t = clamp(weight, 0, 1);
  const channels = [1, 3, 5].map((start) => {
    const x = parseInt(a.slice(start, start + 2), 16);
    const y = parseInt(b.slice(start, start + 2), 16);
    return Math.round(lerp(x, y, t)).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

// A lightweight read-only host reference. Compatible with LivingCharacter V3.
export interface GlyphEmitter {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  type: string;
}

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

  // LETTER ORIGIN: the glyph initially lives inside a moving blob.
  emitter: GlyphEmitter | null = null;
  emitterAngle = 0;
  emitterElapsed = 0;
  readonly emitterDuration = 1.36;

  get isAttached(): boolean {
    return this.emitter !== null && !this.isMagnetizing;
  }

  beginFromBlob(emitter: GlyphEmitter, angle: number) {
    this.emitter = emitter;
    // Upper shoulder only: never emerge from the face or mouth.
    this.emitterAngle = Math.atan2(-Math.abs(Math.sin(angle)) - 0.28, Math.cos(angle));
    this.emitterElapsed = 0;
    this.isEmerging = true;
    this.emergeProgress = 0;
    this.isDragging = false;
    this.isMagnetizing = false;
    this.hasSnapped = false;
    this.vx = 0;
    this.vy = 0;
    this.x = emitter.x + Math.cos(this.emitterAngle) * emitter.radius * 0.78;
    this.y = emitter.y + Math.sin(this.emitterAngle) * emitter.radius * 0.78;
  }

  cancelEmergence() {
    this.emitter = null;
    this.emitterElapsed = 0;
  }

  // L08 owns the shared silhouette in letter-extraction.ts.
  // No more ellipse bud or tether painted over the blob.
  drawBud(_ctx: CanvasRenderingContext2D) {}
  drawTether(_ctx: CanvasRenderingContext2D) {}


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
  this.fontSize = Math.round(HERO_FONT_SIZE * scale);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.font = `700 ${HERO_FONT_SIZE}px "DynaPuff Hero", "Be Vietnam Pro", sans-serif`;
  }

  const metrics = ctx?.measureText(this.char);
  const textWidth = (metrics?.width ?? 38) * narrowGlyphWidth(this.char);
  const textHeight = (metrics?.actualBoundingBoxAscent ?? 56) +
    (metrics?.actualBoundingBoxDescent ?? 16);

  this.width = (textWidth + 14) * scale;
  this.height = (textHeight + 18) * scale;
}


  startDrag(p: Vec2) {
    this.cancelEmergence();
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
    this.cancelEmergence();
    this.emergeProgress = 1;
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

    if (this.isAttached && this.emitter) {
      this.emitterElapsed += dt;
      const t = Math.min(1, this.emitterElapsed / this.emitterDuration);
      const host = this.emitter;
      const a = this.emitterAngle;
      // The body sculpts the glyph first; translation begins after 72%.
      // Keep the shape anchored to the shoulder until it is legible.
      const separate = smooth01((t - 0.72) / 0.28);
      const radius = host.radius * (0.68 + 0.78 * separate);
      this.x = host.x + Math.cos(a) * radius;
      this.y = host.y + Math.sin(a) * radius;
      this.emergeProgress = smooth01((t - 0.15) / 0.82);
      this.rotation = Math.sin(t * Math.PI) * 0.025;

      if (t >= 1) {
        this.vx = host.vx * 0.32 + Math.cos(a) * 14;
        this.vy = host.vy * 0.32 + Math.sin(a) * 14 - 8;
        this.emitter = null;
        this.emergeProgress = 1;
        this.wobble = 0.1;
      } else {
        return;
      }
    }

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

    // The glyph grows from a small imprinted shape into readable letterform.
    const emergeScale = this.isAttached
      ? 0.34 + 0.66 * smooth01(this.emergeProgress)
      : this.isEmerging ? Math.min(1.0, this.emergeProgress * 1.2) : 1.0;
    const sX = (1 + this.wobble * 0.45) * this.scale * emergeScale;
    const sY = (1 / Math.max(0.4, 1 + this.wobble * 0.45)) * this.scale * emergeScale;
    ctx.scale(sX, sY);
    if (this.isAttached) {
      ctx.globalAlpha *= smooth01(this.emergeProgress);
    }

    const source = this.emitter ? SOURCE_MATERIAL[this.emitter.type] : null;
    const materialMix = this.isAttached
      ? smooth01((this.emitterElapsed / this.emitterDuration - 0.60) / 0.40)
      : 1;
    const t = source ? {
      gradTop: mixHex(source.gradTop, this.theme.gradTop, materialMix),
      gradMid: mixHex(source.gradMid, this.theme.gradMid, materialMix),
      gradBase: mixHex(source.gradBase, this.theme.gradBase, materialMix),
      gradShadow: mixHex(source.gradShadow, this.theme.gradShadow, materialMix),
      subsurface: this.theme.subsurface,
      specular: this.theme.specular,
    } : this.theme;
    const fontSize = 54;
    ctx.font = `700 ${fontSize}px "DynaPuff Hero", "Be Vietnam Pro", sans-serif`;
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
    ctx.lineWidth = 14;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeText(this.char, 0, 0);

    // 3. Volumetric Candy Gradient Body
    const textGrad = ctx.createLinearGradient(0, -this.height * 0.5, 0, this.height * 0.5);
    textGrad.addColorStop(0, t.gradTop);
    textGrad.addColorStop(0.28, t.gradMid);
    textGrad.addColorStop(0.75, t.gradBase);
    textGrad.addColorStop(1, t.gradShadow);

    ctx.lineWidth = 10 ;
    ctx.strokeStyle = textGrad;
    ctx.strokeText(this.char, 0, 0);
    ctx.fillStyle = textGrad;
    ctx.fillText(this.char, 0, 0);

    // 4. Subsurface & Edge Glow (Soft lighter inner stroke)
    ctx.strokeStyle = t.subsurface;
    ctx.lineWidth = 4 ;
    ctx.strokeText(this.char, 0, -1);

    // 5. Feathered Crest Highlights (Pillowy reflections on top curve)
    ctx.save();
    ctx.fillStyle = t.specular;
    ctx.globalAlpha = 0.85;

    // Soft specular gleam shifted to top-left
    ctx.font = `700 ${fontSize - 4}px "DynaPuff Hero", "Be Vietnam Pro", sans-serif`;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2.5;
    ctx.strokeText(this.char, -1.5 * this.scale, -3.5 * this.scale);

    ctx.restore();
    ctx.restore();
  }

  drawTargetSlot(ctx: CanvasRenderingContext2D) {
    if (!this.targetX && !this.targetY) return;
    ctx.save();
    ctx.translate(this.targetX, this.targetY);
    ctx.scale(this.scale, this.scale);

    ctx.font = `700 54px "DynaPuff Hero", "Be Vietnam Pro", sans-serif`;
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
  const rawPrefix = UI_TEXT.stage.nameGreetingPrefix?.trim();
  const prefix = rawPrefix ? [rawPrefix] : [];
  const lines: string[] = [...prefix];
  const exclamation = UI_TEXT.stage.nameExclamation ?? '!';

  const words = cleanName.split(/\s+/).filter(Boolean);

  // The target uses a three-tier hero. Two-word names become
  // Hi, / KANG / GIANG!, giving the real outlines enough size.
  if (words.length === 2) {
    lines.push(words[0]);
    lines.push(`${words[1]}${exclamation}`);
  } else if (words.length === 1) {
    lines.push(`${cleanName}${exclamation}`);
  } else if (words.length > 2) {
    const middle = Math.ceil(words.length / 2);
    lines.push(words.slice(0, middle).join(' '));
    lines.push(`${words.slice(middle).join(' ')}${exclamation}`);
  } else {
    lines.push(`${cleanName}${exclamation}`);
  }

  // Measure the actual font, instead of assigning 38px
  // to every character.
  const canvas = document.createElement('canvas');
  const measureCtx = canvas.getContext('2d');

  // L10 hero: physical glyph bounds are deliberately generous; the shared
  // SDF material adds the rounded profile instead of a Canvas fake bevel.
  const baseFontSize = HERO_FONT_SIZE;
  // Advance uses real font ink, not a wide WebGL tile gutter.
  const padding = 4;
  const letterGap = -3;
  const spaceWidth = 16;

  if (measureCtx) {
    measureCtx.font =
      `700 ${baseFontSize}px "DynaPuff Hero", "Be Vietnam Pro", sans-serif`;
  }

  const measure = (char: string): number => {
    if (char === ' ') return spaceWidth;

    const measured =
      measureCtx?.measureText(char).width ??
      baseFontSize * 0.72;

    return measured * narrowGlyphWidth(char) + padding + letterGap;
  };

  const lineWidths = lines.map(line =>
    [...line].reduce((sum, char) => sum + measure(char), 0)
  );

  const longestLine = Math.max(...lineWidths, 1);

  // Scale the whole greeting until the longest line fits.
  const scale = Math.min(
    1,
    Math.max(0.25, (maxWidth - 12) / longestLine)
  );

  const lineHeight = 94 * scale;
  const glyphs: GummyGlyph[] = [];
  let colorIndex = 0;

  lines.forEach((line, lineIndex) => {
    const lineWidth = lineWidths[lineIndex] * scale;
    let cursorX = centerX - lineWidth / 2;
    const y = startY + lineIndex * lineHeight;

    for (const char of line) {
      const advance = measure(char) * scale;

      if (char === ' ') {
        cursorX += advance;
        continue;
      }

      const themeKey = lineIndex === 0
        ? 'cream'
        : COLOR_CYCLE[colorIndex++ % COLOR_CYCLE.length];

      const targetX = cursorX + advance / 2;

      const spawnX =
        centerX + (Math.random() - 0.5) * 180;
      const spawnY =
        y + 60 + (Math.random() - 0.5) * 140;

      const glyph = new GummyGlyph(
        char,
        spawnX,
        spawnY,
        themeKey,
        scale
      );

      glyph.setTarget(targetX, y, scale);

      // Visual/collision dimensions match the rendered font
      // plus its rounded gummy outline.
      const glyphMetrics = measureCtx?.measureText(char);
      const actualWidth = (glyphMetrics?.width ?? 38) * narrowGlyphWidth(char) * scale;
      const actualHeight = ((glyphMetrics?.actualBoundingBoxAscent ?? baseFontSize * 0.74) +
        (glyphMetrics?.actualBoundingBoxDescent ?? baseFontSize * 0.22)) * scale;

      glyph.width = actualWidth + padding * scale;
      glyph.height = actualHeight + padding * scale;

      glyphs.push(glyph);
      cursorX += advance;
    }
  });

  return {
    glyphs,
    totalHeight: lines.length * lineHeight,
  };
}
