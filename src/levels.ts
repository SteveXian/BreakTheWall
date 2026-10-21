import type { ItemId } from './items';
import type { MaterialId } from './materials';

/**
 * Levels are plain data. Each structure is a little ASCII picture drawn bottom-up
 * onto the world, one character per square cell:
 *
 *   G glass   I ice   S sand   W wood   B brick   R stone (rock)
 *   # steel (static, unbreakable, does not count as a wall)
 *   . empty
 *
 * A lowercase letter run (e.g. "wwww") becomes one long plank of that material.
 * A run of "#" becomes one steel girder. The bottom row rests on `y`
 * (defaults to the ground), and `x` is the horizontal centre of the grid.
 */
export interface StructureDef {
  x: number;
  y?: number;
  cell?: number;
  grid: string[];
}

export interface LevelDef {
  /** Throwables available in this level; the first one is pre-selected. */
  items: ItemId[];
  /** If set, the level opens with a "new item!" card for this item. */
  introduces?: ItemId;
  /** Throws needed for 3 stars (2 stars at par + 2; 1 star always). */
  par: number;
  structures: StructureDef[];
}

export const WORLD_W = 1600;
export const WORLD_H = 960;
export const GROUND_Y = 800;
export const DEFAULT_CELL = 50;
/** Part of the world the camera frames (16:9); keeps blocks big on small screens. */
export const VIEW = { x: 140, y: 150, w: 1440, h: 810 };

export const MATERIAL_CODES: Record<string, MaterialId> = {
  g: 'glass',
  i: 'ice',
  s: 'sand',
  w: 'wood',
  b: 'brick',
  r: 'stone',
};

const ALL_BEFORE_BOMB: ItemId[] = ['ball', 'bottle', 'balloon', 'bowling', 'rocket'];
const ALL: ItemId[] = ['bomb', 'ball', 'bottle', 'balloon', 'bowling', 'rocket'];

export const LEVELS: LevelDef[] = [
  // ---- Bouncy ball: great against glass ----
  {
    items: ['ball'],
    introduces: 'ball',
    par: 2,
    structures: [
      { x: 1050, grid: ['G', 'G', 'G'] },
      { x: 1250, grid: ['G', 'G'] },
    ],
  },
  {
    items: ['ball'],
    par: 4,
    structures: [{ x: 1150, grid: ['GGG', 'GGG', 'GGG'] }],
  },
  {
    items: ['ball'],
    par: 3,
    structures: [{ x: 1150, grid: ['ggggg', 'G...G', 'G...G', 'G...G'] }],
  },

  // ---- Bottle: shatters and showers glass and ice ----
  {
    items: ['bottle'],
    introduces: 'bottle',
    par: 2,
    structures: [{ x: 1150, grid: ['..G..', '.GGG.', 'GGGGG'] }],
  },
  {
    items: ['bottle'],
    par: 3,
    structures: [
      { x: 1000, grid: ['II', 'II'] },
      { x: 1300, y: 600, grid: ['GG', 'II', '####'] },
    ],
  },
  {
    items: ['bottle'],
    par: 4,
    structures: [{ x: 1150, grid: ['G..G', 'IIII', 'IGGI', 'IIII'] }],
  },

  // ---- Mix: ball + bottle ----
  {
    items: ['ball', 'bottle'],
    par: 4,
    structures: [
      { x: 1000, grid: ['G', 'W', 'G', 'W'] },
      { x: 1250, grid: ['II', 'GG', 'II'] },
    ],
  },
  {
    items: ['bottle', 'ball'],
    par: 5,
    structures: [
      { x: 950, grid: ['GG', 'WW'] },
      { x: 1150, y: 560, grid: ['II', '###'] },
      { x: 1350, grid: ['G', 'I', 'G', 'I', 'G'] },
    ],
  },

  // ---- Water balloon: melts sandcastles ----
  {
    items: ['balloon'],
    introduces: 'balloon',
    par: 2,
    structures: [{ x: 1150, grid: ['S.S.S', 'SSSSS', 'SSSSS'] }],
  },
  {
    items: ['balloon'],
    par: 3,
    structures: [
      { x: 1000, grid: ['S.S', 'SSS', 'SSS', 'SSS'] },
      { x: 1300, grid: ['S.S', 'SSS', 'SSS', 'SSS'] },
    ],
  },
  {
    items: ['balloon'],
    par: 4,
    structures: [{ x: 1150, grid: ['S...S', 'SS.SS', 'SSSSS', 'SWWWS', 'SW.WS'] }],
  },

  // ---- Mix: ball + bottle + balloon ----
  {
    items: ['balloon', 'bottle', 'ball'],
    par: 4,
    structures: [{ x: 1150, grid: ['S.S.S', 'SGSGS', 'SSSSS', 'SGSGS'] }],
  },
  {
    items: ['balloon', 'bottle', 'ball'],
    par: 4,
    structures: [
      { x: 950, grid: ['SS', 'SS', 'SS'] },
      { x: 1180, y: 600, grid: ['II', 'II', '####'] },
      { x: 1400, grid: ['GG', 'SS', 'GG'] },
    ],
  },

  // ---- Bowling ball: heavy, smashes wood and brick ----
  {
    items: ['bowling'],
    introduces: 'bowling',
    par: 2,
    structures: [{ x: 1100, grid: ['WW', 'WW', 'WW', 'WW'] }],
  },
  {
    items: ['bowling'],
    par: 3,
    structures: [{ x: 1150, grid: ['BBB', 'BBB', 'BBB'] }],
  },
  {
    items: ['bowling'],
    par: 3,
    structures: [{ x: 1150, grid: ['..W..', '.WWW.', 'wwwww', 'B...B', 'BB.BB'] }],
  },

  // ---- Mix ----
  {
    items: ['bowling', 'balloon', 'bottle', 'ball'],
    par: 5,
    structures: [
      { x: 980, grid: ['GG', 'BB', 'BB'] },
      { x: 1300, grid: ['S.S', 'SSS', 'WWW', 'WWW'] },
    ],
  },
  {
    items: ['bowling', 'balloon', 'bottle', 'ball'],
    par: 6,
    structures: [
      { x: 1000, y: 620, grid: ['GGG', '#####'] },
      { x: 1250, grid: ['wwwww', 'B.S.B', 'B.S.B', 'BBSBB'] },
    ],
  },

  // ---- Rocket: flies straight, melts ice, lights up wood ----
  {
    items: ['rocket'],
    introduces: 'rocket',
    par: 2,
    structures: [{ x: 1250, y: 450, grid: ['II', 'II', '####'] }],
  },
  {
    items: ['rocket'],
    par: 3,
    structures: [
      { x: 1050, grid: ['.I.', 'III', 'III'] },
      { x: 1350, y: 500, grid: ['I', 'I', '###'] },
    ],
  },
  {
    items: ['rocket'],
    par: 3,
    structures: [
      { x: 1000, y: 380, grid: ['WW', '###'] },
      { x: 1200, y: 560, grid: ['II', '###'] },
      { x: 1400, grid: ['W', 'I', 'W', 'I'] },
    ],
  },

  // ---- Mix ----
  {
    items: ['rocket', 'bowling', 'balloon', 'bottle', 'ball'],
    par: 4,
    structures: [
      { x: 1000, grid: ['SS', 'SS', 'BB'] },
      { x: 1300, y: 450, grid: ['III', 'WWW', '#####'] },
    ],
  },
  {
    items: ALL_BEFORE_BOMB,
    par: 6,
    structures: [
      { x: 950, grid: ['G', 'G', 'G'] },
      { x: 1150, grid: ['iii', 'S.S', 'S.S'] },
      { x: 1380, grid: ['WW', 'BB', 'WW', 'BB'] },
    ],
  },

  // ---- Bomb: big cartoon boom, best against stone ----
  {
    items: ['bomb'],
    introduces: 'bomb',
    par: 2,
    structures: [{ x: 1150, grid: ['RRR', 'RRR', 'RRR'] }],
  },
  {
    items: ['bomb'],
    par: 3,
    structures: [{ x: 1150, grid: ['R...R', 'RRRRR', 'RBBBR', 'RB.BR'] }],
  },
  {
    items: ['bomb'],
    par: 4,
    structures: [
      { x: 1000, grid: ['RR', 'RR', 'RR', 'RR'] },
      { x: 1300, grid: ['RR', 'BB', 'RR', 'BB'] },
    ],
  },

  // ---- Mix ----
  {
    items: ALL,
    par: 5,
    structures: [
      { x: 1000, grid: ['GG', 'RR', 'RR'] },
      { x: 1300, grid: ['S.S', 'SSS', 'III'] },
    ],
  },
  {
    items: ALL,
    par: 5,
    structures: [
      { x: 950, y: 560, grid: ['II', '###'] },
      { x: 1250, grid: ['rrrrr', 'W.B.W', 'W.B.W', 'WSBSW'] },
    ],
  },

  // ---- Grand finale ----
  {
    items: ALL,
    par: 6,
    structures: [
      { x: 950, grid: ['G.G', 'GGG', 'SSS'] },
      { x: 1200, y: 520, grid: ['I', 'I', '###'] },
      { x: 1400, grid: ['W', 'W', 'B', 'B', 'R'] },
    ],
  },
  {
    items: ALL,
    par: 6,
    structures: [{ x: 1180, grid: ['R.....R', 'RR.G.RR', 'ggggggg', 'S.I.I.S', 'SWWWWWS', 'SW...WS'] }],
  },
  {
    items: ALL,
    par: 6,
    structures: [
      { x: 900, grid: ['B', 'B', 'B', 'B'] },
      { x: 1100, y: 450, grid: ['GG', 'II', '####'] },
      { x: 1350, grid: ['.R.', 'RRR', 'SSS', 'WWW'] },
    ],
  },
  {
    items: ALL,
    par: 7,
    structures: [
      { x: 1180, grid: ['G...I...G', 'R...W...R', 'rrrrrrrrr', 'S.B.S.B.S', 'S.B.S.B.S', 'SWBWSWBWS'] },
    ],
  },
];

export interface BlockSpec {
  material: MaterialId;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SteelSpec {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Expand a level's ASCII structures into concrete rectangles (centre x/y, width, height). */
export function buildLevel(level: LevelDef): { blocks: BlockSpec[]; steel: SteelSpec[] } {
  const blocks: BlockSpec[] = [];
  const steel: SteelSpec[] = [];
  for (const s of level.structures) {
    const cell = s.cell ?? DEFAULT_CELL;
    const baseY = s.y ?? GROUND_Y;
    const cols = Math.max(...s.grid.map((r) => r.length));
    const left = s.x - (cols * cell) / 2;
    const rows = s.grid.length;
    s.grid.forEach((row, ri) => {
      const top = baseY - (rows - ri) * cell;
      let c = 0;
      while (c < row.length) {
        const ch = row[c];
        if (ch === '.' || ch === ' ') {
          c++;
          continue;
        }
        const isRun = ch === '#' || ch === ch.toLowerCase();
        let len = 1;
        if (isRun) while (row[c + len] === ch) len++;
        const rect = { x: left + (c + len / 2) * cell, y: top + cell / 2, w: len * cell, h: cell };
        if (ch === '#') {
          steel.push({ ...rect, h: cell * 0.5, y: top + cell * 0.25 });
        } else {
          const material = MATERIAL_CODES[ch.toLowerCase()];
          if (!material) throw new Error(`Unknown level code "${ch}"`);
          blocks.push({ material, ...rect });
        }
        c += len;
      }
    });
  }
  return { blocks, steel };
}
