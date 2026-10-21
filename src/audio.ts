import type { Material } from './materials';

/** Tiny Web Audio synth: every sound is generated, so there are no audio files to load. */
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = localStorage.getItem('btw.muted') === '1';
  private lastPlay = new Map<string, number>();

  /** Must be called from a user gesture (browsers block audio until then). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    localStorage.setItem('btw.muted', m ? '1' : '0');
    if (this.master) this.master.gain.value = m ? 0 : 0.6;
  }

  /** Avoids a wall of noise when many blocks collide in the same instant. */
  private throttle(key: string, ms: number) {
    const now = performance.now();
    if ((this.lastPlay.get(key) ?? 0) + ms > now) return false;
    this.lastPlay.set(key, now);
    return true;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filter: BiquadFilterType, freq: number, freqTo?: number, delay = 0) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  stretch(amount: number) {
    if (!this.throttle('stretch', 70)) return;
    this.tone(200 + amount * 300, 0.06, 'triangle', 0.08);
  }

  throw() {
    this.noise(0.25, 0.4, 'bandpass', 600, 2400);
    this.tone(300, 0.18, 'sine', 0.15, 700);
  }

  select() {
    this.tone(660, 0.08, 'triangle', 0.25);
    this.tone(990, 0.12, 'triangle', 0.2, undefined, 0.06);
  }

  click() {
    this.tone(520, 0.08, 'square', 0.12);
  }

  hit(m: Material, strength: number) {
    if (!this.throttle('hit-' + m.sound, 60)) return;
    const v = Math.min(0.35, 0.08 + strength * 0.01);
    switch (m.sound) {
      case 'glass':
      case 'ice':
        this.tone(1800 + Math.random() * 600, 0.15, 'sine', v * 0.6);
        break;
      case 'wood':
        this.tone(320, 0.1, 'triangle', v, 180);
        break;
      case 'sand':
        this.noise(0.12, v, 'lowpass', 900);
        break;
      default:
        this.tone(140, 0.12, 'sine', v, 70);
        this.noise(0.08, v * 0.6, 'lowpass', 600);
    }
  }

  break(m: Material) {
    if (!this.throttle('break-' + m.sound, 50)) return;
    switch (m.sound) {
      case 'glass':
      case 'ice':
        for (let i = 0; i < 4; i++) this.tone(2000 + Math.random() * 2000, 0.2, 'sine', 0.12, undefined, i * 0.03);
        this.noise(0.25, 0.25, 'highpass', 3000);
        break;
      case 'wood':
        this.noise(0.2, 0.35, 'bandpass', 700, 300);
        this.tone(220, 0.15, 'triangle', 0.2, 110);
        break;
      case 'sand':
        this.noise(0.35, 0.35, 'lowpass', 1200, 300);
        break;
      default:
        this.noise(0.3, 0.45, 'lowpass', 900, 150);
        this.tone(110, 0.25, 'sine', 0.3, 50);
    }
    this.pop();
  }

  /** Cheerful little "bloop" that plays on every break so smashing feels rewarding. */
  private pop() {
    const notes = [523, 659, 784, 1047];
    this.tone(notes[Math.floor(Math.random() * notes.length)], 0.12, 'triangle', 0.12, undefined, 0.05);
  }

  boom() {
    this.noise(0.8, 0.9, 'lowpass', 1200, 60);
    this.tone(90, 0.6, 'sine', 0.6, 35);
  }

  splash() {
    this.noise(0.45, 0.5, 'bandpass', 1500, 400);
    for (let i = 0; i < 3; i++) this.tone(500 + i * 250, 0.12, 'sine', 0.15, 1200 + i * 200, i * 0.07);
  }

  shatter() {
    for (let i = 0; i < 6; i++) this.tone(2500 + Math.random() * 2500, 0.18, 'sine', 0.1, undefined, i * 0.025);
    this.noise(0.3, 0.3, 'highpass', 2500);
  }

  sparkle() {
    this.noise(0.3, 0.35, 'bandpass', 2500, 800);
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.15, undefined, i * 0.05));
  }

  boing() {
    if (!this.throttle('boing', 120)) return;
    this.tone(220, 0.25, 'sine', 0.25, 660);
  }

  win() {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.25, undefined, i * 0.11));
    [262, 330, 392].forEach((f) => this.tone(f, 0.9, 'sine', 0.1, undefined, 0.55));
  }

  star(i: number) {
    this.tone(880 + i * 220, 0.25, 'triangle', 0.25);
    this.tone(1320 + i * 330, 0.3, 'sine', 0.12, undefined, 0.05);
  }

  newItem() {
    [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, 'square', 0.08, undefined, i * 0.08));
  }
}

export const sfx = new Sfx();
