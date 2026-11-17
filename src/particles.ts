import { Vec2 } from './physics';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  rotation: number;
  vRot: number;
  shape: 'spark' | 'circle' | 'pill' | 'star';
}

const PALETTE = [
  '#FFD700', // Gold
  '#FF3377', // Hot pink
  '#58D7D4', // Aqua
  '#FFFFFF', // Sparkle white
  '#FFAAA6', // Peach
  '#B388FF', // Soft lilac
];

export class ParticleSystem {
  particles: Particle[] = [];

  burst(pos: Vec2, count = 12, speedRange = [80, 260], shapes: Particle['shape'][] = ['spark', 'pill', 'circle']) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
      const maxLife = 0.4 + Math.random() * 0.4;
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];

      this.particles.push({
        x: pos.x + (Math.random() - 0.5) * 20,
        y: pos.y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40, // slight upward pop
        size: 3 + Math.random() * 5,
        color,
        alpha: 1,
        life: 0,
        maxLife,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 8,
        shape,
      });
    }
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      // physics
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt; // gentle gravity
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.rotation += p.vRot * dt;

      // fade out
      const progress = p.life / p.maxLife;
      p.alpha = 1 - Math.pow(progress, 1.8);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'pill') {
        ctx.beginPath();
        const w = p.size * 2.2;
        const h = p.size * 0.9;
        ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
        ctx.fill();
      } else {
        // 4-pointed sparkle
        ctx.beginPath();
        const r = p.size * 1.5;
        ctx.moveTo(0, -r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.quadraticCurveTo(0, 0, 0, r);
        ctx.quadraticCurveTo(0, 0, -r, 0);
        ctx.quadraticCurveTo(0, 0, 0, -r);
        ctx.fill();
      }

      ctx.restore();
    }
    ctx.restore();
  }
}

