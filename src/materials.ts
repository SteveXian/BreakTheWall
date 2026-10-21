export type MaterialId = 'glass' | 'ice' | 'sand' | 'wood' | 'brick' | 'stone';

export interface Material {
  id: MaterialId;
  health: number;
  density: number;
  friction: number;
  restitution: number;
  /** Main fill, darker edge/detail colour, light highlight colour. */
  fill: string;
  edge: string;
  light: string;
  /** Colours used for the confetti-like debris when the block breaks. */
  debris: string[];
  sound: 'glass' | 'ice' | 'sand' | 'wood' | 'brick' | 'stone';
}

export const MATERIALS: Record<MaterialId, Material> = {
  glass: {
    id: 'glass',
    health: 30,
    density: 0.0015,
    friction: 0.4,
    restitution: 0.1,
    fill: 'rgba(140, 220, 255, 0.75)',
    edge: '#3a9fd6',
    light: 'rgba(255,255,255,0.85)',
    debris: ['#bdf0ff', '#7fd4ff', '#ffffff'],
    sound: 'glass',
  },
  ice: {
    id: 'ice',
    health: 50,
    density: 0.0015,
    friction: 0.05,
    restitution: 0.05,
    fill: '#c9f3ff',
    edge: '#6cc3e8',
    light: '#ffffff',
    debris: ['#e6fbff', '#a8e8ff', '#ffffff'],
    sound: 'ice',
  },
  sand: {
    id: 'sand',
    health: 55,
    density: 0.002,
    friction: 0.9,
    restitution: 0,
    fill: '#ffd774',
    edge: '#d9a23a',
    light: '#fff0b8',
    debris: ['#ffd774', '#f2c055', '#fff0b8'],
    sound: 'sand',
  },
  wood: {
    id: 'wood',
    health: 75,
    density: 0.0018,
    friction: 0.7,
    restitution: 0.05,
    fill: '#e3a35a',
    edge: '#a8662a',
    light: '#f5c98a',
    debris: ['#e3a35a', '#c98440', '#f5c98a'],
    sound: 'wood',
  },
  brick: {
    id: 'brick',
    health: 120,
    density: 0.0028,
    friction: 0.8,
    restitution: 0,
    fill: '#f2715a',
    edge: '#b8402e',
    light: '#ffd2c4',
    debris: ['#f2715a', '#d4523d', '#ffb3a3'],
    sound: 'brick',
  },
  stone: {
    id: 'stone',
    health: 180,
    density: 0.0035,
    friction: 0.9,
    restitution: 0,
    fill: '#b7b9d6',
    edge: '#7476a3',
    light: '#e4e5f5',
    debris: ['#b7b9d6', '#9597bf', '#e4e5f5'],
    sound: 'stone',
  },
};
