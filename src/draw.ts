import type { ItemId } from './items';
import type { Material } from './materials';
import { GROUND_Y, WORLD_H, WORLD_W } from './levels';

type Ctx = CanvasRenderingContext2D;

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Deterministic pseudo-random so textures/cracks don't flicker between frames. */
export function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ---------------------------------------------------------------- background

const clouds = Array.from({ length: 6 }, (_, i) => ({
  x: (i * 317) % WORLD_W,
  y: 190 + ((i * 97) % 200),
  s: 0.7 + ((i * 37) % 10) / 15,
  v: 6 + (i % 3) * 4,
}));

function cloud(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.arc(40, -16, 42, 0, Math.PI * 2);
  ctx.arc(84, 0, 34, 0, Math.PI * 2);
  ctx.arc(42, 14, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draws sky, sun, clouds, hills and grass. `extraLeft/Right` cover letterbox margins. */
export function drawBackground(ctx: Ctx, t: number, extraLeft: number, extraRight: number, extraTop: number, extraBottom: number) {
  const x0 = -extraLeft;
  const w = WORLD_W + extraLeft + extraRight;
  const sky = ctx.createLinearGradient(0, -extraTop, 0, GROUND_Y);
  sky.addColorStop(0, '#5ec8ff');
  sky.addColorStop(1, '#c4f0ff');
  ctx.fillStyle = sky;
  ctx.fillRect(x0, -extraTop, w, GROUND_Y + extraTop);

  // Smiling sun
  ctx.save();
  ctx.translate(1440, 225);
  ctx.rotate(t * 0.2);
  ctx.fillStyle = '#ffd93b';
  for (let i = 0; i < 12; i++) {
    ctx.rotate((Math.PI * 2) / 12);
    ctx.beginPath();
    ctx.moveTo(-12, -70);
    ctx.lineTo(0, -98);
    ctx.lineTo(12, -70);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(1440, 225);
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a3d1e';
  ctx.beginPath();
  ctx.arc(-20, -10, 7, 0, Math.PI * 2);
  ctx.arc(20, -10, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5a3d1e';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 8, 24, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,120,0.5)';
  ctx.beginPath();
  ctx.arc(-36, 12, 9, 0, Math.PI * 2);
  ctx.arc(36, 12, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  for (const c of clouds) {
    const span = w + 300;
    const cx = x0 - 150 + ((((c.x + t * c.v) % span) + span) % span);
    cloud(ctx, cx, c.y, c.s);
  }

  // Rolling hills
  ctx.fillStyle = '#8be07a';
  ctx.beginPath();
  ctx.moveTo(x0, GROUND_Y);
  for (let x = x0; x <= x0 + w; x += 40) ctx.lineTo(x, GROUND_Y - 120 - Math.sin(x / 260) * 60 - Math.sin(x / 90) * 10);
  ctx.lineTo(x0 + w, GROUND_Y);
  ctx.fill();
  ctx.fillStyle = '#6fd160';
  ctx.beginPath();
  ctx.moveTo(x0, GROUND_Y);
  for (let x = x0; x <= x0 + w; x += 40) ctx.lineTo(x, GROUND_Y - 50 - Math.sin(x / 180 + 2) * 35);
  ctx.lineTo(x0 + w, GROUND_Y);
  ctx.fill();

  // Ground
  ctx.fillStyle = '#a5683a';
  ctx.fillRect(x0, GROUND_Y, w, WORLD_H - GROUND_Y + extraBottom);
  ctx.fillStyle = '#8c5530';
  for (let x = Math.floor(x0 / 60) * 60; x < x0 + w; x += 60) {
    ctx.beginPath();
    ctx.ellipse(x + 20, GROUND_Y + 50, 10, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 50, GROUND_Y + 80, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#4fc244';
  ctx.fillRect(x0, GROUND_Y - 4, w, 22);
  ctx.beginPath();
  for (let x = Math.floor(x0 / 24) * 24; x < x0 + w; x += 24) {
    ctx.moveTo(x, GROUND_Y + 18);
    ctx.quadraticCurveTo(x + 12, GROUND_Y + 34, x + 24, GROUND_Y + 18);
  }
  ctx.fill();

  // Flowers
  const flowerColors = ['#ff6fa8', '#ffd93b', '#ffffff', '#b38cff'];
  for (let i = 0; i < 14; i++) {
    const fx = 40 + i * 113;
    if (fx > 760 && fx < 1520) continue;
    const fy = GROUND_Y - 6;
    ctx.fillStyle = flowerColors[i % flowerColors.length];
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * 7, fy - 14 + Math.sin(a) * 7, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ff9f1c';
    ctx.beginPath();
    ctx.arc(fx, fy - 14, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- blocks

export function drawBlock(ctx: Ctx, m: Material, w: number, h: number, damage: number, seed: number, flash: number) {
  const x = -w / 2;
  const y = -h / 2;
  const rand = seeded(seed);
  ctx.save();
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = m.fill;
  ctx.fill();
  ctx.save();
  ctx.clip();

  switch (m.id) {
    case 'glass': {
      ctx.strokeStyle = m.light;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.2, y + h * 0.85);
      ctx.lineTo(x + w * 0.55, y + h * 0.15);
      ctx.moveTo(x + w * 0.45, y + h * 0.9);
      ctx.lineTo(x + w * 0.7, y + h * 0.4);
      ctx.stroke();
      break;
    }
    case 'ice': {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      roundRect(ctx, x + 6, y + 5, w - 12, h * 0.25, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(108,195,232,0.35)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x + rand() * w, y + h * 0.5 + rand() * h * 0.4, 4 + rand() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'sand': {
      ctx.fillStyle = m.edge;
      for (let i = 0; i < (w * h) / 180; i++) {
        ctx.beginPath();
        ctx.arc(x + rand() * w, y + rand() * h, 1.5 + rand() * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = m.light;
      ctx.fillRect(x, y, w, 6);
      break;
    }
    case 'wood': {
      ctx.strokeStyle = m.edge;
      ctx.lineWidth = 3;
      const horizontal = w >= h;
      const lines = 3;
      for (let i = 1; i <= lines; i++) {
        ctx.beginPath();
        if (horizontal) {
          const ly = y + (h * i) / (lines + 1);
          ctx.moveTo(x, ly);
          ctx.bezierCurveTo(x + w * 0.3, ly - 4, x + w * 0.6, ly + 4, x + w, ly);
        } else {
          const lx = x + (w * i) / (lines + 1);
          ctx.moveTo(lx, y);
          ctx.bezierCurveTo(lx - 4, y + h * 0.3, lx + 4, y + h * 0.6, lx, y + h);
        }
        ctx.stroke();
      }
      ctx.fillStyle = m.edge;
      ctx.beginPath();
      ctx.ellipse(x + w * (0.3 + rand() * 0.4), y + h * (0.3 + rand() * 0.4), 5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'brick': {
      ctx.strokeStyle = m.light;
      ctx.lineWidth = 3;
      const rows = Math.max(2, Math.round(h / 17));
      const rh = h / rows;
      for (let r = 0; r < rows; r++) {
        const ry = y + r * rh;
        if (r > 0) {
          ctx.beginPath();
          ctx.moveTo(x, ry);
          ctx.lineTo(x + w, ry);
          ctx.stroke();
        }
        const off = r % 2 ? 12 : 0;
        for (let bx = x + off + 25; bx < x + w; bx += 25) {
          ctx.beginPath();
          ctx.moveTo(bx, ry);
          ctx.lineTo(bx, ry + rh);
          ctx.stroke();
        }
      }
      break;
    }
    case 'stone': {
      ctx.fillStyle = m.light;
      ctx.beginPath();
      ctx.ellipse(x + w * 0.3, y + h * 0.3, w * 0.18, h * 0.12, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = m.edge;
      for (let i = 0; i < (w * h) / 900; i++) {
        ctx.beginPath();
        ctx.ellipse(x + rand() * w, y + rand() * h, 3 + rand() * 4, 2 + rand() * 3, rand() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }

  // Cracks grow as the block takes damage
  if (damage > 0.15) {
    ctx.strokeStyle = 'rgba(40,30,60,0.55)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    const cracks = Math.ceil(damage * 4);
    const cr = seeded(seed * 7 + 3);
    for (let i = 0; i < cracks; i++) {
      let cx = x + cr() * w;
      let cy = y + cr() * h;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let s = 0; s < 3; s++) {
        cx += (cr() - 0.5) * w * 0.5;
        cy += (cr() - 0.5) * h * 0.5;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  }

  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.7})`;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();

  roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 7);
  ctx.strokeStyle = m.edge;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

export function drawSteel(ctx: Ctx, w: number, h: number) {
  const x = -w / 2;
  const y = -h / 2;
  roundRect(ctx, x, y, w, h, 6);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#9aa3b5');
  g.addColorStop(1, '#5d6678');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#3f4656';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#d7dce6';
  for (let bx = x + 14; bx < x + w - 6; bx += 30) {
    ctx.beginPath();
    ctx.arc(bx, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- throwables

/** Draws an item centred at the origin with radius r. Used both in the world and for picker icons. */
export function drawItem(ctx: Ctx, id: ItemId, r: number, t = 0) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (id) {
    case 'ball': {
      const colors = ['#ff4d6d', '#ffd23f', '#3ec1ff', '#ffffff', '#5ee36b', '#ff9f1c'];
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, (i / 6) * Math.PI * 2, ((i + 1) / 6) * Math.PI * 2);
        ctx.fillStyle = colors[i];
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = '#2d2350';
      ctx.lineWidth = r * 0.12;
      ctx.stroke();
      break;
    }
    case 'bottle': {
      const s = r / 20;
      ctx.scale(s, s);
      ctx.beginPath();
      ctx.moveTo(-5, -26);
      ctx.lineTo(5, -26);
      ctx.lineTo(5, -14);
      ctx.quadraticCurveTo(13, -10, 13, 0);
      ctx.lineTo(13, 20);
      ctx.quadraticCurveTo(13, 26, 7, 26);
      ctx.lineTo(-7, 26);
      ctx.quadraticCurveTo(-13, 26, -13, 20);
      ctx.lineTo(-13, 0);
      ctx.quadraticCurveTo(-13, -10, -5, -14);
      ctx.closePath();
      ctx.fillStyle = '#4fd68a';
      ctx.fill();
      ctx.strokeStyle = '#1f7a4a';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#ff5d73';
      roundRect(ctx, -6, -31, 12, 7, 2);
      ctx.fill();
      ctx.fillStyle = '#fff4c2';
      roundRect(ctx, -10, 2, 20, 12, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8, 20);
      ctx.stroke();
      break;
    }
    case 'balloon': {
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.08, r * 0.92, r, 0, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#9fe6ff');
      g.addColorStop(1, '#2f9bff');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = '#1f6fc4';
      ctx.lineWidth = r * 0.1;
      ctx.stroke();
      ctx.fillStyle = '#2f9bff';
      ctx.beginPath();
      ctx.moveTo(-r * 0.18, r * 0.98);
      ctx.lineTo(r * 0.18, r * 0.98);
      ctx.lineTo(0, r * 0.82);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.35, -r * 0.45, r * 0.16, r * 0.26, -0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bowling': {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#c58bff');
      g.addColorStop(1, '#6a2fd1');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = '#3d1785';
      ctx.lineWidth = r * 0.1;
      ctx.stroke();
      ctx.fillStyle = '#2a0f5c';
      for (const [hx, hy, hr] of [
        [0.15, -0.35, 0.13],
        [0.42, -0.2, 0.13],
        [0.3, 0.12, 0.15],
      ]) {
        ctx.beginPath();
        ctx.arc(hx * r, hy * r, hr * r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'bomb': {
      ctx.fillStyle = '#3b3f5c';
      roundRect(ctx, -r * 0.28, -r * 1.12, r * 0.56, r * 0.34, 3);
      ctx.fill();
      ctx.strokeStyle = '#c98a3a';
      ctx.lineWidth = r * 0.12;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.1);
      ctx.quadraticCurveTo(r * 0.3, -r * 1.5, r * 0.6, -r * 1.35);
      ctx.stroke();
      const sp = 0.7 + 0.3 * Math.sin(t * 25);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rr = i % 2 ? r * 0.12 : r * 0.3 * sp;
        ctx.lineTo(r * 0.6 + Math.cos(a) * rr, -r * 1.35 + Math.sin(a) * rr);
      }
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#6b7099');
      g.addColorStop(1, '#2b2e45');
      ctx.fillStyle = g;
      ctx.fill();
      // Friendly face so the bomb reads as a cartoon character
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-r * 0.32, -r * 0.1, r * 0.2, 0, Math.PI * 2);
      ctx.arc(r * 0.32, -r * 0.1, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(-r * 0.28, -r * 0.08, r * 0.1, 0, Math.PI * 2);
      ctx.arc(r * 0.36, -r * 0.08, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = r * 0.1;
      ctx.beginPath();
      ctx.arc(0, r * 0.2, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      break;
    }
    case 'rocket': {
      const s = r / 18;
      ctx.scale(s, s);
      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.moveTo(-22, -6);
      ctx.lineTo(-34 - Math.sin(t * 40) * 5, 0);
      ctx.lineTo(-22, 6);
      ctx.fill();
      ctx.fillStyle = '#3ec1ff';
      ctx.beginPath();
      ctx.moveTo(-18, -9);
      ctx.lineTo(-26, -18);
      ctx.lineTo(-10, -9);
      ctx.moveTo(-18, 9);
      ctx.lineTo(-26, 18);
      ctx.lineTo(-10, 9);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-22, -10);
      ctx.lineTo(12, -10);
      ctx.quadraticCurveTo(28, -6, 30, 0);
      ctx.quadraticCurveTo(28, 6, 12, 10);
      ctx.lineTo(-22, 10);
      ctx.closePath();
      ctx.fillStyle = '#ff4d6d';
      ctx.fill();
      ctx.strokeStyle = '#a3123a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-12, -10, 6, 20);
      ctx.fillRect(0, -10, 6, 20);
      ctx.beginPath();
      ctx.arc(18, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe66d';
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- slingshot

export const SLING_X = 230;
export const SLING_Y = 640;

export function drawSlingshotBack(ctx: Ctx) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#8a4b1f';
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.moveTo(SLING_X, GROUND_Y + 4);
  ctx.lineTo(SLING_X, SLING_Y + 70);
  ctx.lineTo(SLING_X + 34, SLING_Y - 10);
  ctx.stroke();
  ctx.strokeStyle = '#b8692e';
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.restore();
}

export function drawSlingshotFront(ctx: Ctx) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#8a4b1f';
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.moveTo(SLING_X, SLING_Y + 70);
  ctx.lineTo(SLING_X - 34, SLING_Y - 10);
  ctx.stroke();
  ctx.strokeStyle = '#c9783a';
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.restore();
}

export function drawBand(ctx: Ctx, fromX: number, fromY: number, toX: number, toY: number) {
  ctx.save();
  ctx.strokeStyle = '#ff4f8b';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  ctx.restore();
}

export function drawStar(ctx: Ctx, x: number, y: number, r: number, fill: string, stroke = '#c47d00') {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.48 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = r * 0.12;
  ctx.lineJoin = 'round';
  ctx.stroke();
}
