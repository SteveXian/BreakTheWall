import './style.css';
import { sfx } from './audio';
import { drawBlock, drawItem, drawStar } from './draw';
import { Game } from './game';
import { ICONS } from './icons';
import { ITEMS, type ItemId, itemById } from './items';
import { LEVELS } from './levels';
import { MATERIALS } from './materials';
import { loadProgress, saveLevelResult } from './storage';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let progress = loadProgress();
const TUTORIAL_KEY = 'btw.tutorialDone';

const hud = $('hud');
const titleScreen = $('screen-title');
const levelsScreen = $('screen-levels');
const introOverlay = $('overlay-intro');
const clearOverlay = $('overlay-clear');
const progressFill = $('progress-fill');
const progressLevel = $('progress-level');
const picker = $('picker');

const game = new Game($<HTMLCanvasElement>('game'), {
  onProgress(remaining, total) {
    progressFill.style.width = `${total ? ((total - remaining) / total) * 100 : 0}%`;
  },
  onCleared(throws) {
    const par = LEVELS[game.levelIndex].par;
    const stars = throws <= par ? 3 : throws <= par + 2 ? 2 : 1;
    progress = saveLevelResult(progress, game.levelIndex, stars, LEVELS.length);
    localStorage.setItem(TUTORIAL_KEY, '1');
    setTimeout(() => showClear(stars), 500);
  },
});

// ------------------------------------------------------------ small canvas renderers

function itemCanvas(id: ItemId, size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.translate(size / 2, size / 2 + (id === 'bomb' ? size * 0.08 : 0));
  const item = itemById(id);
  const r = size * 0.36;
  ctx.scale(r / item.radius, r / item.radius);
  if (id === 'rocket') ctx.rotate(-Math.PI / 4);
  drawItem(ctx, id, item.radius);
  return c;
}

function starCanvas(filled: boolean, size = 160) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  drawStar(ctx, size / 2, size / 2 + 4, size * 0.44, filled ? '#ffd23f' : '#e3e4ef', filled ? '#2d2350' : '#b3b5cc');
  return c;
}

const miniStar = (filled: boolean) =>
  `<svg viewBox="0 0 24 24"><path d="M12 2 L14.9 8.6 L22 9.3 L16.6 14 L18.2 21 L12 17.3 L5.8 21 L7.4 14 L2 9.3 L9.1 8.6 Z" fill="${filled ? '#ffd23f' : '#d6d7e4'}" stroke="#2d2350" stroke-width="2" stroke-linejoin="round"/></svg>`;

// ------------------------------------------------------------ screens

type Screen = 'title' | 'levels' | 'play';

function show(screen: Screen) {
  titleScreen.classList.toggle('hidden', screen !== 'title');
  levelsScreen.classList.toggle('hidden', screen !== 'levels');
  hud.classList.toggle('hidden', screen !== 'play');
  introOverlay.classList.add('hidden');
  clearOverlay.classList.add('hidden');
  game.input = screen === 'play';
  if (screen === 'levels') renderLevelGrid();
}

function renderLevelGrid() {
  const grid = $('level-grid');
  grid.innerHTML = '';
  LEVELS.forEach((level, i) => {
    const b = document.createElement('button');
    b.className = 'level-btn';
    const locked = i > progress.unlocked;
    const stars = progress.stars[i] ?? 0;
    b.setAttribute('aria-label', locked ? `Level ${i + 1}, locked` : `Level ${i + 1}`);
    if (locked) {
      b.classList.add('locked');
      b.innerHTML = ICONS.lock;
    } else {
      if (stars > 0) b.classList.add('done');
      if (i === progress.unlocked && stars === 0) b.classList.add('current');
      b.innerHTML = `<span>${i + 1}</span><span class="mini-stars">${[0, 1, 2].map((s) => miniStar(s < stars)).join('')}</span>`;
      b.addEventListener('click', () => {
        sfx.unlock();
        sfx.click();
        startLevel(i);
      });
    }
    if (level.introduces) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.appendChild(itemCanvas(level.introduces, 80));
      b.appendChild(badge);
    }
    grid.appendChild(b);
  });
  grid.querySelector('.current')?.scrollIntoView({ block: 'center' });
}

function renderPicker() {
  picker.innerHTML = '';
  for (const id of game.available) {
    const b = document.createElement('button');
    b.setAttribute('aria-label', id);
    b.dataset.item = id;
    b.appendChild(itemCanvas(id, 120));
    b.classList.toggle('selected', id === game.selected);
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      sfx.unlock();
      if (game.selected !== id) sfx.select();
      game.setItem(id);
      picker.querySelectorAll('button').forEach((x) => x.classList.toggle('selected', x.dataset.item === id));
    });
    picker.appendChild(b);
  }
  picker.classList.toggle('hidden', game.available.length === 0);
}

function startLevel(i: number) {
  game.load(i);
  show('play');
  progressLevel.textContent = String(i + 1);
  renderPicker();
  game.showHint = i === 0 || localStorage.getItem(TUTORIAL_KEY) !== '1';
  const intro = LEVELS[i].introduces;
  if (intro) showIntro(intro);
}

function showIntro(id: ItemId) {
  game.input = false;
  const c = $<HTMLCanvasElement>('intro-item');
  const ctx = c.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  const item = itemById(id);
  ctx.translate(c.width / 2, c.height / 2 + (id === 'bomb' ? 20 : 0));
  const r = c.width * 0.32;
  ctx.scale(r / item.radius, r / item.radius);
  if (id === 'rocket') ctx.rotate(-Math.PI / 4);
  drawItem(ctx, id, item.radius);

  // "Good against" row: zap icon followed by the materials this item is super effective on.
  const good = $('intro-good');
  good.innerHTML = `<div class="zap">${zapIcon}</div>`;
  const best = (Object.keys(MATERIALS) as (keyof typeof MATERIALS)[]).filter((m) => item.vs[m] >= 2);
  for (const m of best) {
    const bc = document.createElement('canvas');
    bc.width = bc.height = 120;
    const bctx = bc.getContext('2d')!;
    bctx.translate(60, 60);
    drawBlock(bctx, MATERIALS[m], 96, 96, 0, 7, 0);
    drawStar(bctx, 36, -36, 18, '#fff36b', '#ffb703');
    good.appendChild(bc);
  }
  introOverlay.classList.remove('hidden');
  sfx.newItem();
}

const zapIcon = `<svg viewBox="0 0 48 48"><path d="M27 4 L10 28 H23 L19 44 L38 18 H25 Z" fill="currentColor" stroke="#2d2350" stroke-width="3.5" stroke-linejoin="round"/></svg>`;

function showClear(stars: number) {
  const box = $('clear-stars');
  box.innerHTML = '';
  const canvases = [0, 1, 2].map((i) => {
    const c = starCanvas(i < stars);
    box.appendChild(c);
    return c;
  });
  canvases.forEach((c, i) =>
    setTimeout(() => {
      c.classList.add('show');
      if (i < stars) sfx.star(i);
    }, 250 + i * 300),
  );
  const isLast = game.levelIndex >= LEVELS.length - 1;
  const next = $('btn-clear-next');
  next.innerHTML = isLast ? ICONS.trophy : ICONS.next;
  next.classList.toggle('trophy-btn', isLast);
  next.setAttribute('aria-label', isLast ? 'All done!' : 'Next level');
  clearOverlay.classList.remove('hidden');
  game.input = false;
}

// ------------------------------------------------------------ wiring

function setIcon(id: string, icon: string) {
  $(id).innerHTML = icon;
}

setIcon('btn-play', ICONS.play);
setIcon('btn-home', ICONS.grid);
setIcon('btn-restart', ICONS.restart);
setIcon('btn-levels-back', ICONS.home);
setIcon('btn-intro-go', ICONS.play);
setIcon('btn-clear-levels', ICONS.grid);
setIcon('btn-clear-replay', ICONS.restart);

const soundBtn = $('btn-sound');
const updateSoundIcon = () => (soundBtn.innerHTML = sfx.muted ? ICONS.soundOff : ICONS.soundOn);
updateSoundIcon();

const tap = (id: string, fn: () => void) =>
  $(id).addEventListener('click', () => {
    sfx.unlock();
    sfx.click();
    fn();
  });

tap('btn-play', () => show('levels'));
tap('btn-levels-back', () => show('title'));
tap('btn-home', () => show('levels'));
tap('btn-restart', () => startLevel(game.levelIndex));
tap('btn-sound', () => {
  sfx.setMuted(!sfx.muted);
  updateSoundIcon();
});
tap('btn-intro-go', () => {
  introOverlay.classList.add('hidden');
  game.input = true;
});
tap('btn-clear-levels', () => show('levels'));
tap('btn-clear-replay', () => startLevel(game.levelIndex));
tap('btn-clear-next', () => {
  if (game.levelIndex >= LEVELS.length - 1) show('levels');
  else startLevel(game.levelIndex + 1);
});

// Tapping anywhere on the intro card also starts, so non-readers can't get stuck.
introOverlay.addEventListener('click', (e) => {
  if (e.target === introOverlay) $('btn-intro-go').click();
});

game.load(Math.min(progress.unlocked, LEVELS.length - 1));
show('title');

if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __btw: unknown }).__btw = { game, startLevel, show, LEVELS, ITEMS };
}
