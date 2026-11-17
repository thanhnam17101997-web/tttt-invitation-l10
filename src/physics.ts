export interface Vec2 {
  x: number;
  y: number;
}

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 1D Damped Harmonic Oscillator with viscous damping
 */
export class Spring1D {
  value: number;
  target: number;
  velocity = 0;
  stiffness: number; // spring constant k
  damping: number;   // damping coefficient c

  constructor(initial: number, stiffness = 120, damping = 12) {
    this.value = initial;
    this.target = initial;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  update(dt: number) {
    const force = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
    this.velocity += force * dt;
    this.value += this.velocity * dt;

    if (!isFinite(this.value) || isNaN(this.value)) {
      this.value = this.target;
      this.velocity = 0;
    }
  }

  impulse(force: number) {
    this.velocity += force;
  }

  setTarget(target: number) {
    this.target = target;
  }
}
