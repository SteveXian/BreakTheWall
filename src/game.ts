import Matter from 'matter-js';
import { sfx } from './audio';
import {
  SLING_X,
  SLING_Y,
  drawBackground,
  drawBand,
  drawBlock,
  drawItem,
  drawSlingshotBack,
  drawSlingshotFront,
  drawStar,
  drawSteel,
} from './draw';
import { type Item, type ItemId, itemById } from './items';
import { GROUND_Y, LEVELS, VIEW, WORLD_H, WORLD_W, buildLevel } from './levels';
import { MATERIALS, type Material } from './materials';

const { Engine, Bodies, Body, Composite, Events, Sleeping } = Matter;

const STEP_MS = 1000 / 60;
const MAX_PULL = 170;
const GRAVITY_PER_TICK = 0.001 * STEP_MS * STEP_MS;
const PROJECTILE_AIR = 0.004;
const SETTLE_MS = 1200;
const THROW_COOLDOWN_MS = 450;
const IMPACT_DAMAGE = 4;
const CRASH_DAMAGE = 5;

interface Block {
  body: Matter.Body;
  material: Material;
  w: number;
  h: number;
  health: number;
  maxHealth: number;
  flash: number;
  seed: number;
  dead: boolean;
}

interface Projectile {
  body: Matter.Body;
  item: Item;
  age: number;
  stillFor: number;
  fuse: number | null;
  done: boolean;
  fade: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  shape: 'rect' | 'circle' | 'star' | 'drop';
  rot: number;
  vr: number;
  g: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  color: string;
  fill?: string;
}

interface Word {
  text: string;
  x: number;
  y: number;
  life: number;
  color: string;
}

export interface GameCallbacks {
  onCleared(throws: number): void;
  onProgress(remaining: number, total: number): void;
}

type BodyTag = { kind: 'block'; block: Block } | { kind: 'projectile'; proj: Projectile } | { kind: 'static' };

const tagOf = (b: Matter.Body): BodyTag => (b.plugin as { tag?: BodyTag }).tag ?? { kind: 'static' };

export class Game {
  private ctx: CanvasRenderingContext2D;
  private engine = Engine.create({ enableSleeping: true });
  private blocks: Block[] = [];
  private steel: { w: number; h: number; x: number; y: number }[] = [];
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private words: Word[] = [];
  private totalBlocks = 0;
  private levelTime = 0;
  private lastThrow = -Infinity;
  private shake = 0;
  private time = 0;
  private acc = 0;
  private lastFrame = 0;
  private raf = 0;
  private aim: { sx: number; sy: number; cx: number; cy: number; pointerId: number } | null = null;
  private view = { scale: 1, ox: 0, oy: 0, dpr: 1 };
  private clearedAt: number | null = null;
  private pendingRemoval: Matter.Body[] = [];
  private lastStretch = 0;

  levelIndex = 0;
  throws = 0;
  selected: ItemId = 'ball';
  available: ItemId[] = [];
  input = true;
  showHint = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private cb: GameCallbacks,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.engine.positionIterations = 10;
    this.engine.velocityIterations = 8;
    Events.on(this.engine, 'collisionStart', (e) => this.onCollisions(e.pairs));
    Events.on(this.engine, 'beforeUpdate', () => this.beforePhysics());

    canvas.addEventListener('pointerdown', (e) => this.pointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.pointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.pointerUp(e));
    canvas.addEventListener('pointercancel', () => (this.aim = null));
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  // ------------------------------------------------------------ level setup

  load(index: number) {
    const def = LEVELS[index];
    this.levelIndex = index;
    Composite.clear(this.engine.world, false);
    this.blocks = [];
    this.projectiles = [];
    this.particles = [];
    this.rings = [];
    this.words = [];
    this.pendingRemoval = [];
    this.aim = null;
    this.throws = 0;
    this.levelTime = 0;
    this.clearedAt = null;
    this.lastThrow = -Infinity;
    this.available = def.items;
    this.selected = def.items[0];

    const ground = Bodies.rectangle(WORLD_W / 2, GROUND_Y + 100, WORLD_W * 3, 200, { isStatic: true, friction: 0.9 });
    Composite.add(this.engine.world, ground);

    const { blocks, steel } = buildLevel(def);
    this.steel = steel;
    for (const s of steel) {
      Composite.add(this.engine.world, Bodies.rectangle(s.x, s.y, s.w, s.h, { isStatic: true, friction: 0.9, chamfer: { radius: 4 } }));
    }
    blocks.forEach((spec, i) => {
      const m = MATERIALS[spec.material];
      const body = Bodies.rectangle(spec.x, spec.y, spec.w - 1, spec.h - 0.5, {
        density: m.density,
        friction: m.friction,
        frictionStatic: 1,
        restitution: m.restitution,
        chamfer: { radius: 3 },
        sleepThreshold: 40,
      });
      // Long planks are sturdier so roofs don't snap from their own weight.
      const sizeBoost = Math.max(1, (spec.w * spec.h) / 2500) ** 0.5;
      const block: Block = {
        body,
        material: m,
        w: spec.w,
        h: spec.h,
        health: m.health * sizeBoost,
        maxHealth: m.health * sizeBoost,
        flash: 0,
        seed: index * 1000 + i * 37 + 11,
        dead: false,
      };
      body.plugin = { tag: { kind: 'block', block } satisfies BodyTag };
      this.blocks.push(block);
      Composite.add(this.engine.world, body);
    });
    this.totalBlocks = this.blocks.length;
    this.cb.onProgress(this.totalBlocks, this.totalBlocks);
  }

  setItem(id: ItemId) {
    if (this.available.includes(id)) this.selected = id;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
  }

  get remaining() {
    return this.blocks.length;
  }

  // ------------------------------------------------------------ input

  private toWorld(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - this.view.ox) / this.view.scale,
      y: (e.clientY - rect.top - this.view.oy) / this.view.scale,
    };
  }

  private canThrow() {
    return this.input && this.clearedAt === null && this.time - this.lastThrow > THROW_COOLDOWN_MS / 1000;
  }

  private pointerDown(e: PointerEvent) {
    sfx.unlock();
    if (this.aim || !this.canThrow()) return;
    const p = this.toWorld(e);
    this.aim = { sx: p.x, sy: p.y, cx: p.x, cy: p.y, pointerId: e.pointerId };
    this.canvas.setPointerCapture(e.pointerId);
  }

  private pointerMove(e: PointerEvent) {
    if (!this.aim || e.pointerId !== this.aim.pointerId) return;
    const p = this.toWorld(e);
    this.aim.cx = p.x;
    this.aim.cy = p.y;
    const pull = this.pullVector();
    if (Math.abs(pull.len - this.lastStretch) > 12) {
      this.lastStretch = pull.len;
      sfx.stretch(pull.len / MAX_PULL);
    }
  }

  private pointerUp(e: PointerEvent) {
    if (!this.aim || e.pointerId !== this.aim.pointerId) return;
    const pull = this.pullVector();
    this.aim = null;
    if (pull.len < 18 || !this.canThrow()) return;
    const v = this.launchVelocity(pull);
    this.launch(v.x, v.y);
  }

  /** Offset of the pouch from rest, clamped to the max stretch. */
  private pullVector() {
    if (!this.aim) return { x: 0, y: 0, len: 0 };
    let dx = this.aim.cx - this.aim.sx;
    let dy = this.aim.cy - this.aim.sy;
    const len = Math.hypot(dx, dy);
    if (len > MAX_PULL) {
      dx = (dx / len) * MAX_PULL;
      dy = (dy / len) * MAX_PULL;
    }
    dy = Math.min(dy, GROUND_Y - 30 - SLING_Y);
    return { x: dx, y: dy, len: Math.min(len, MAX_PULL) };
  }

  private launchVelocity(pull: { x: number; y: number }) {
    const item = itemById(this.selected);
    const k = item.speed / MAX_PULL;
    return { x: -pull.x * k, y: -pull.y * k };
  }

  /** Throws the selected item from the slingshot with the given velocity (px per tick). */
  launch(vx: number, vy: number) {
    const item = itemById(this.selected);
    const speed = Math.hypot(vx, vy) || 1;
    const back = Math.min(MAX_PULL, (speed / item.speed) * MAX_PULL);
    const x = SLING_X - (vx / speed) * back;
    const y = Math.min(GROUND_Y - item.radius - 2, SLING_Y - (vy / speed) * back);
    const body = Bodies.circle(x, y, item.radius, {
      density: item.density,
      restitution: item.restitution,
      friction: item.friction,
      frictionAir: PROJECTILE_AIR,
    });
    if (item.ignoresGravity) Body.setInertia(body, Infinity);
    const proj: Projectile = { body, item, age: 0, stillFor: 0, fuse: null, done: false, fade: 1 };
    body.plugin = { tag: { kind: 'projectile', proj } satisfies BodyTag };
    Composite.add(this.engine.world, body);
    Body.setVelocity(body, { x: vx, y: vy });
    if (!item.ignoresGravity) Body.setAngularVelocity(body, vx * 0.01);
    this.projectiles.push(proj);
    this.throws++;
    this.lastThrow = this.time;
    this.showHint = false;
    sfx.throw();
    for (let i = 0; i < 10; i++) this.spawnParticle(x, y, '#ffffff', 'circle', 2 + Math.random() * 3, 0.4, 3);
  }

  // ------------------------------------------------------------ physics hooks

  private beforePhysics() {
    for (const p of this.projectiles) {
      if (p.item.ignoresGravity && !p.done) {
        const g = this.engine.gravity;
        Body.applyForce(p.body, p.body.position, { x: 0, y: -p.body.mass * g.y * g.scale });
        const v = p.body.velocity;
        Body.setAngle(p.body, Math.atan2(v.y, v.x));
      }
    }
  }

  private onCollisions(pairs: Matter.Pair[]) {
    for (const pair of pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      const ta = tagOf(a);
      const tb = tagOf(b);
      const n = pair.collision.normal;
      const rel = Math.abs((a.velocity.x - b.velocity.x) * n.x + (a.velocity.y - b.velocity.y) * n.y);
      const contact = pair.collision.supports[0] ?? a.position;

      if (ta.kind === 'projectile' || tb.kind === 'projectile') {
        const proj = ta.kind === 'projectile' ? ta.proj : (tb as { proj: Projectile }).proj;
        const other = ta.kind === 'projectile' ? tb : ta;
        if (other.kind === 'projectile') continue;
        this.projectileHit(proj, other, rel, contact);
      } else if (ta.kind === 'block' || tb.kind === 'block') {
        if (this.levelTime < SETTLE_MS) continue;
        const dmg = Math.max(0, rel - 2.5) * CRASH_DAMAGE;
        if (dmg <= 0) continue;
        if (ta.kind === 'block') this.damage(ta.block, dmg, rel);
        if (tb.kind === 'block') this.damage(tb.block, dmg, rel);
      }
    }
  }

  private projectileHit(proj: Projectile, other: BodyTag, rel: number, contact: Matter.Vector) {
    if (proj.done) return;
    const item = proj.item;
    if (other.kind === 'block') {
      const dmg = Math.max(0, rel - 1.5) * IMPACT_DAMAGE * item.impactPower * item.vs[other.block.material.id];
      this.damage(other.block, dmg, rel);
    }
    if (item.effect.kind === 'burst') {
      if (item.fuseMs) {
        if (proj.fuse === null) proj.fuse = item.fuseMs;
      } else {
        this.burst(proj, contact.x, contact.y);
      }
    } else if (item.id === 'ball' && rel > 3) {
      sfx.boing();
      this.addRing(contact.x, contact.y, 30, '#ffffff');
    } else if (rel > 3 && other.kind === 'block') {
      this.words.push({ text: 'POW!', x: contact.x, y: contact.y - 30, life: 0.8, color: '#ffde3b' });
      this.shake = Math.max(this.shake, 6);
    }
  }

  private damage(block: Block, amount: number, strength: number) {
    if (block.dead || amount <= 0) return;
    block.health -= amount;
    block.flash = 1;
    if (block.body.isSleeping) Sleeping.set(block.body, false);
    if (block.health <= 0) this.breakBlock(block);
    else if (amount > 4) sfx.hit(block.material, strength);
  }

  private breakBlock(block: Block, quiet = false) {
    if (block.dead) return;
    block.dead = true;
    this.pendingRemoval.push(block.body);
    const { x, y } = block.body.position;
    if (!quiet) {
      sfx.break(block.material);
      const count = Math.round((block.w * block.h) / 120) + 8;
      for (let i = 0; i < count; i++) {
        const c = block.material.debris[i % block.material.debris.length];
        this.spawnParticle(
          x + (Math.random() - 0.5) * block.w,
          y + (Math.random() - 0.5) * block.h,
          c,
          Math.random() < 0.7 ? 'rect' : 'circle',
          4 + Math.random() * 8,
          0.9 + Math.random() * 0.5,
          7,
        );
      }
      for (let i = 0; i < 4; i++) this.spawnParticle(x, y, '#fff6a8', 'star', 8 + Math.random() * 6, 0.8, 5, 0.1);
      this.addRing(x, y, Math.max(block.w, block.h) * 0.9, '#ffffff');
    }
  }

  private burst(proj: Projectile, x: number, y: number) {
    if (proj.done || proj.item.effect.kind !== 'burst') return;
    proj.done = true;
    proj.fade = 0;
    this.pendingRemoval.push(proj.body);
    const fx = proj.item.effect;
    const item = proj.item;

    for (const block of this.blocks) {
      if (block.dead) continue;
      const bb = block.body.bounds;
      const nx = Math.max(bb.min.x, Math.min(x, bb.max.x));
      const ny = Math.max(bb.min.y, Math.min(y, bb.max.y));
      const d = Math.hypot(nx - x, ny - y);
      if (d > fx.radius) continue;
      const falloff = 1 - (0.5 * d) / fx.radius;
      const dir = { x: block.body.position.x - x, y: block.body.position.y - y };
      const len = Math.hypot(dir.x, dir.y) || 1;
      const push = fx.push * (1 - d / fx.radius);
      Sleeping.set(block.body, false);
      Body.setVelocity(block.body, {
        x: block.body.velocity.x + (dir.x / len) * push,
        y: block.body.velocity.y + (dir.y / len) * push - push * 0.3,
      });
      this.damage(block, fx.damage * falloff * item.vs[block.material.id], 10);
    }

    switch (fx.style) {
      case 'boom':
        sfx.boom();
        this.shake = 22;
        this.rings.push({ x, y, r: 10, maxR: fx.radius, life: 1, color: '#ff9f1c', fill: 'rgba(255,214,59,0.55)' });
        this.addRing(x, y, fx.radius * 1.2, '#ffffff');
        for (let i = 0; i < 40; i++) {
          const c = ['#ffd23f', '#ff9f1c', '#ff4d6d', '#ffffff'][i % 4];
          this.spawnParticle(x, y, c, i % 3 ? 'circle' : 'star', 8 + Math.random() * 14, 0.6 + Math.random() * 0.5, 14, 0.15);
        }
        this.words.push({ text: 'BOOM!', x, y: y - 60, life: 1.2, color: '#ff9f1c' });
        break;
      case 'splash':
        sfx.splash();
        this.rings.push({ x, y, r: 10, maxR: fx.radius, life: 1, color: '#2f9bff', fill: 'rgba(120,200,255,0.45)' });
        for (let i = 0; i < 36; i++) {
          this.spawnParticle(x, y, i % 3 ? '#4fb6ff' : '#bff0ff', 'drop', 6 + Math.random() * 8, 0.8 + Math.random() * 0.4, 11);
        }
        this.words.push({ text: 'SPLASH!', x, y: y - 50, life: 1, color: '#2f9bff' });
        break;
      case 'shards':
        sfx.shatter();
        this.addRing(x, y, fx.radius, '#4fd68a');
        for (let i = 0; i < 26; i++) {
          this.spawnParticle(x, y, i % 2 ? '#4fd68a' : '#c8ffe0', 'rect', 4 + Math.random() * 7, 0.7 + Math.random() * 0.4, 12);
        }
        this.words.push({ text: 'CRASH!', x, y: y - 50, life: 0.9, color: '#3ccf7a' });
        break;
      case 'sparkle':
        sfx.sparkle();
        this.rings.push({ x, y, r: 10, maxR: fx.radius, life: 1, color: '#ff4d6d', fill: 'rgba(255,180,80,0.4)' });
        for (let i = 0; i < 40; i++) {
          const c = ['#ff4d6d', '#ffd23f', '#3ec1ff', '#5ee36b', '#b38cff'][i % 5];
          this.spawnParticle(x, y, c, 'star', 7 + Math.random() * 9, 0.9 + Math.random() * 0.5, 12, 0.08);
        }
        this.words.push({ text: 'ZOOM!', x, y: y - 50, life: 1, color: '#ff4d6d' });
        break;
    }
  }

  // ------------------------------------------------------------ update

  private update(dtMs: number) {
    this.time += dtMs / 1000;
    this.levelTime += dtMs;
    Engine.update(this.engine, dtMs);

    for (const body of this.pendingRemoval) Composite.remove(this.engine.world, body);
    this.pendingRemoval = [];
    this.blocks = this.blocks.filter((b) => !b.dead);

    for (const b of this.blocks) {
      b.flash = Math.max(0, b.flash - dtMs / 150);
      const p = b.body.position;
      if (p.y > WORLD_H + 150 || p.x < VIEW.x - 20 || p.x > VIEW.x + VIEW.w + 20) this.breakBlock(b, true);
    }

    for (const p of this.projectiles) {
      if (p.done) continue;
      p.age += dtMs;
      const pos = p.body.position;
      const speed = Math.hypot(p.body.velocity.x, p.body.velocity.y);
      if (p.item.ignoresGravity && this.time * 60 % 2 < 1) {
        this.spawnParticle(pos.x, pos.y, Math.random() < 0.5 ? '#ffd23f' : '#ff9f1c', 'circle', 4 + Math.random() * 5, 0.4, 1.5);
      }
      if (p.fuse !== null) {
        p.fuse -= dtMs;
        if (p.fuse <= 0) this.burst(p, pos.x, pos.y);
        continue;
      }
      if (p.item.fuseMs && p.age > 2500) {
        this.burst(p, pos.x, pos.y);
        continue;
      }
      const offWorld = pos.x > WORLD_W + 200 || pos.x < -200 || pos.y > WORLD_H + 200 || pos.y < -1500;
      p.stillFor = speed < 0.5 ? p.stillFor + dtMs : 0;
      if (p.item.ignoresGravity && p.age > 4000) this.burst(p, pos.x, pos.y);
      else if (offWorld || p.stillFor > 700 || p.age > 7000) {
        p.done = true;
        this.pendingRemoval.push(p.body);
      }
    }
    for (const p of this.projectiles) if (p.done) p.fade = Math.max(0, p.fade - dtMs / 300);
    this.projectiles = this.projectiles.filter((p) => !p.done || p.fade > 0);

    const dt = dtMs / 1000;
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.g * dt * 60 * 0.3;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vx *= 0.98;
      p.rot += p.vr * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const r of this.rings) {
      r.life -= dt * 2.5;
      r.r += (r.maxR - r.r) * Math.min(1, dt * 12);
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const w of this.words) {
      w.life -= dt;
      w.y -= dt * 40;
    }
    this.words = this.words.filter((w) => w.life > 0);
    this.shake *= 0.88;

    this.cb.onProgress(this.blocks.length, this.totalBlocks);
    if (this.blocks.length === 0 && this.clearedAt === null && this.totalBlocks > 0) {
      this.clearedAt = this.time;
      this.aim = null;
    }
    if (this.clearedAt !== null && this.time - this.clearedAt > 0.9 && this.clearedAt > 0) {
      this.clearedAt = -1;
      this.celebrate();
      this.cb.onCleared(this.throws);
    }
  }

  private celebrate() {
    sfx.win();
    const colors = ['#ff4d6d', '#ffd23f', '#3ec1ff', '#5ee36b', '#b38cff', '#ff9f1c'];
    for (let i = 0; i < 120; i++) {
      const p = this.spawnParticle(Math.random() * WORLD_W, -20 - Math.random() * 200, colors[i % colors.length], 'rect', 8 + Math.random() * 8, 3 + Math.random() * 2, 2);
      p.vy = 2 + Math.random() * 3;
      p.g = 0.15;
    }
  }

  // ------------------------------------------------------------ effects helpers

  private spawnParticle(x: number, y: number, color: string, shape: Particle['shape'], size: number, life: number, speed: number, g = 0.6) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    const p: Particle = {
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - speed * 0.3,
      life,
      max: life,
      size,
      color,
      shape,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 12,
      g,
    };
    this.particles.push(p);
    return p;
  }

  private addRing(x: number, y: number, maxR: number, color: string) {
    this.rings.push({ x, y, r: maxR * 0.3, maxR, life: 1, color });
  }

  // ------------------------------------------------------------ rendering

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    const scale = Math.min(w / VIEW.w, h / VIEW.h);
    this.view = {
      scale,
      ox: (w - VIEW.w * scale) / 2 - VIEW.x * scale,
      oy: (h - VIEW.h * scale) / 2 - VIEW.y * scale,
      dpr,
    };
  }

  private frame(t: number) {
    this.raf = requestAnimationFrame((tt) => this.frame(tt));
    const dt = this.lastFrame ? Math.min(100, t - this.lastFrame) : STEP_MS;
    this.lastFrame = t;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP_MS && steps < 4) {
      this.update(STEP_MS);
      this.acc -= STEP_MS;
      steps++;
    }
    if (steps === 4) this.acc = 0;
    this.render();
  }

  private render() {
    const { ctx } = this;
    const { scale, ox, oy, dpr } = this.view;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const sx = this.shake > 0.5 ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake > 0.5 ? (Math.random() - 0.5) * this.shake : 0;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (ox + sx), dpr * (oy + sy));
    const cw = this.canvas.width / dpr;
    const ch = this.canvas.height / dpr;
    const pad = 40;
    drawBackground(
      ctx,
      this.time,
      Math.max(0, ox / scale) + pad,
      Math.max(0, (cw - ox) / scale - WORLD_W) + pad,
      Math.max(0, oy / scale) + pad,
      Math.max(0, (ch - oy) / scale - WORLD_H) + pad,
    );

    for (const s of this.steel) {
      ctx.save();
      ctx.translate(s.x, s.y);
      drawSteel(ctx, s.w, s.h);
      ctx.restore();
    }

    const sel = itemById(this.selected);
    for (const b of this.blocks) {
      ctx.save();
      ctx.translate(b.body.position.x, b.body.position.y);
      ctx.rotate(b.body.angle);
      drawBlock(ctx, b.material, b.w, b.h, 1 - b.health / b.maxHealth, b.seed, b.flash);
      if (sel.vs[b.material.id] >= 2 && this.clearedAt === null) this.drawSuperHint(b);
      ctx.restore();
    }

    drawSlingshotBack(ctx);
    const pull = this.pullVector();
    const pouch = { x: SLING_X + pull.x, y: SLING_Y + pull.y };
    const ready = this.canThrow();
    if (this.aim) {
      drawBand(ctx, SLING_X + 34, SLING_Y - 10, pouch.x, pouch.y);
      this.drawTrajectory(pouch, this.launchVelocity(pull), sel);
    }
    if (ready || this.aim) {
      ctx.save();
      ctx.translate(pouch.x, pouch.y);
      if (!this.aim) ctx.translate(0, Math.sin(this.time * 4) * 3);
      drawItem(ctx, sel.id, sel.radius, this.time);
      ctx.restore();
    }
    if (this.aim) drawBand(ctx, SLING_X - 34, SLING_Y - 10, pouch.x, pouch.y);
    else {
      drawBand(ctx, SLING_X + 34, SLING_Y - 10, SLING_X, SLING_Y + 8);
      drawBand(ctx, SLING_X - 34, SLING_Y - 10, SLING_X, SLING_Y + 8);
    }
    drawSlingshotFront(ctx);

    for (const p of this.projectiles) {
      ctx.save();
      ctx.globalAlpha = p.fade;
      ctx.translate(p.body.position.x, p.body.position.y);
      ctx.rotate(p.body.angle);
      if (p.fuse !== null) ctx.scale(1 + Math.sin(this.time * 40) * 0.08, 1 + Math.sin(this.time * 40) * 0.08);
      drawItem(ctx, p.item.id, p.item.radius, this.time);
      ctx.restore();
    }

    for (const r of this.rings) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, r.life);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      if (r.fill) {
        ctx.fillStyle = r.fill;
        ctx.fill();
      }
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / p.max / 0.3);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 3, p.size, (p.size * 2) / 3);
      else if (p.shape === 'star') drawStar(ctx, 0, 0, p.size, p.color, 'rgba(0,0,0,0)');
      else if (p.shape === 'drop') {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.5, p.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const w of this.words) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, w.life * 2);
      ctx.translate(w.x, w.y);
      const pop = 1 + Math.max(0, w.life - 0.7) * 1.5;
      ctx.scale(pop, pop);
      ctx.rotate(-0.08);
      ctx.font = '900 54px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 10;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#2d2350';
      ctx.strokeText(w.text, 0, 0);
      ctx.fillStyle = w.color;
      ctx.fillText(w.text, 0, 0);
      ctx.restore();
    }

    if (this.showHint && !this.aim && ready) this.drawDragHint();
  }

  /** Twinkling stars on blocks the selected item is extra good against (a no-reading hint). */
  private drawSuperHint(b: Block) {
    const { ctx } = this;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 5 + b.seed);
    ctx.save();
    ctx.globalAlpha = 0.35 + pulse * 0.5;
    ctx.strokeStyle = '#fff36b';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -this.time * 30;
    ctx.strokeRect(-b.w / 2 + 3, -b.h / 2 + 3, b.w - 6, b.h - 6);
    ctx.setLineDash([]);
    ctx.globalAlpha = pulse;
    drawStar(ctx, b.w / 2 - 10, -b.h / 2 + 10, 7 + pulse * 3, '#fff36b', '#ffb703');
    ctx.restore();
  }

  private drawTrajectory(start: { x: number; y: number }, v: { x: number; y: number }, item: Item) {
    const { ctx } = this;
    const pts = this.predict(start, v, item, 75);
    ctx.save();
    pts.forEach((p, i) => {
      if (i % 3 !== 0) return;
      const k = 1 - i / pts.length;
      ctx.globalAlpha = 0.35 + 0.6 * k;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 + 5 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2d2350';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    ctx.restore();
  }

  /** Same integration as Matter (velocity Verlet with air friction) so the dotted preview is honest. */
  predict(start: { x: number; y: number }, v: { x: number; y: number }, item: Item, steps: number) {
    const pts: { x: number; y: number }[] = [];
    let { x, y } = start;
    let vx = v.x;
    let vy = v.y;
    for (let i = 0; i < steps; i++) {
      vx *= 1 - PROJECTILE_AIR;
      vy = vy * (1 - PROJECTILE_AIR) + (item.ignoresGravity ? 0 : GRAVITY_PER_TICK);
      x += vx;
      y += vy;
      if (y > GROUND_Y - item.radius) break;
      pts.push({ x, y });
    }
    return pts;
  }

  private drawDragHint() {
    const { ctx } = this;
    const cycle = (this.time % 2.2) / 2.2;
    const k = Math.min(1, Math.max(0, (cycle - 0.15) / 0.55));
    const ease = k * k * (3 - 2 * k);
    const hx = SLING_X + 10 - ease * 120;
    const hy = SLING_Y + 10 + ease * 70;
    ctx.save();
    ctx.globalAlpha = cycle > 0.85 ? (1 - cycle) / 0.15 : 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.setLineDash([12, 10]);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(SLING_X + 10, SLING_Y + 10);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.setLineDash([]);
    // Fingertip
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = '#2d2350';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(hx, hy, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx, hy, 36 + Math.sin(this.time * 8) * 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------ test hooks

  /** Debug-only: snapshot of remaining walls, used by the automated play-through. */
  debugBlocks() {
    return this.blocks.map((b) => ({ x: b.body.position.x, y: b.body.position.y, w: b.w, h: b.h, m: b.material.id }));
  }

  /**
   * Debug-only: find a slingshot pull (in world units) whose predicted path passes through
   * the given point. Returns null if no angle/power combination reaches it.
   */
  solveAim(tx: number, ty: number) {
    const item = itemById(this.selected);
    const r = item.radius - 4;
    const inside = (p: { x: number; y: number }, o: { x: number; y: number; w: number; h: number }, pad: number) =>
      Math.abs(p.x - o.x) < o.w / 2 + pad && Math.abs(p.y - o.y) < o.h / 2 + pad;
    const target = { x: tx, y: ty };
    const obstacles = [
      ...this.steel,
      ...this.blocks.map((b) => ({ x: b.body.position.x, y: b.body.position.y, w: b.w, h: b.h })),
    ].filter((o) => !inside(target, o, 0));
    let best: { pull: { x: number; y: number }; err: number } | null = null;
    for (let power = 1; power >= 0.3; power -= 0.05) {
      for (let deg = -80; deg <= 60; deg += 1) {
        const a = (deg * Math.PI) / 180;
        const pull = { x: -Math.cos(a) * MAX_PULL * power, y: Math.sin(a) * MAX_PULL * power };
        const v = this.launchVelocity(pull);
        const raw = this.predict({ x: SLING_X + pull.x, y: SLING_Y + pull.y }, v, item, 240);
        const pts = raw.flatMap((p, i) => {
          const q = raw[i - 1] ?? p;
          return [0.25, 0.5, 0.75, 1].map((k) => ({ x: q.x + (p.x - q.x) * k, y: q.y + (p.y - q.y) * k }));
        });
        for (const p of pts) {
          const err = Math.hypot(p.x - tx, p.y - ty);
          if (err < 14) {
            if (!best || err < best.err) best = { pull, err };
            break;
          }
          if (p.x > tx + 30 || obstacles.some((o) => inside(p, o, r))) break;
        }
      }
      if (best) return best.pull;
    }
    return null;
  }

  /** Debug-only: world -> CSS pixel coordinates (for driving real pointer drags in tests). */
  worldToScreen(x: number, y: number) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + this.view.ox + x * this.view.scale, y: rect.top + this.view.oy + y * this.view.scale };
  }
}
