import type { MaterialId } from './materials';

export type ItemId = 'ball' | 'bottle' | 'balloon' | 'bowling' | 'bomb' | 'rocket';

export type ItemEffect =
  /** Plain physical hit; damage comes only from impact speed. */
  | { kind: 'impact' }
  /** Breaks on first impact and damages everything nearby. */
  | {
      kind: 'burst';
      radius: number;
      damage: number;
      /** Outward speed (px per tick) given to blocks at the centre of the burst. */
      push: number;
      style: 'shards' | 'splash' | 'boom' | 'sparkle';
    };

export interface Item {
  id: ItemId;
  radius: number;
  density: number;
  restitution: number;
  friction: number;
  /** Launch speed (px per 60Hz tick) at full slingshot stretch. */
  speed: number;
  /** Multiplier applied to impact damage on top of material effectiveness. */
  impactPower: number;
  ignoresGravity?: boolean;
  /** Bombs wait a moment after first contact before going off. */
  fuseMs?: number;
  effect: ItemEffect;
  /** Damage multiplier against each material. >= 2 means "super effective" and is hinted in-game. */
  vs: Record<MaterialId, number>;
}

export const ITEMS: Item[] = [
  {
    id: 'ball',
    radius: 22,
    density: 0.004,
    restitution: 0.85,
    friction: 0.2,
    speed: 27,
    impactPower: 1.1,
    effect: { kind: 'impact' },
    vs: { glass: 2, ice: 1.4, sand: 1, wood: 1, brick: 0.6, stone: 0.4 },
  },
  {
    id: 'bottle',
    radius: 20,
    density: 0.004,
    restitution: 0.2,
    friction: 0.3,
    speed: 27,
    impactPower: 1,
    effect: { kind: 'burst', radius: 95, damage: 40, push: 3, style: 'shards' },
    vs: { glass: 2.5, ice: 1.6, sand: 0.8, wood: 0.8, brick: 0.4, stone: 0.3 },
  },
  {
    id: 'balloon',
    radius: 24,
    density: 0.003,
    restitution: 0.3,
    friction: 0.3,
    speed: 25,
    impactPower: 0.5,
    effect: { kind: 'burst', radius: 130, damage: 45, push: 4, style: 'splash' },
    vs: { glass: 0.5, ice: 0.4, sand: 3, wood: 1.2, brick: 0.6, stone: 0.3 },
  },
  {
    id: 'bowling',
    radius: 26,
    density: 0.02,
    restitution: 0.15,
    friction: 0.05,
    speed: 23,
    impactPower: 1.6,
    effect: { kind: 'impact' },
    vs: { glass: 1.4, ice: 1.4, sand: 1, wood: 2, brick: 2, stone: 1 },
  },
  {
    id: 'bomb',
    radius: 24,
    density: 0.006,
    restitution: 0.3,
    friction: 0.4,
    speed: 25,
    impactPower: 0.6,
    fuseMs: 350,
    effect: { kind: 'burst', radius: 170, damage: 110, push: 14, style: 'boom' },
    vs: { glass: 1, ice: 1, sand: 1, wood: 1.2, brick: 1.6, stone: 2.2 },
  },
  {
    id: 'rocket',
    radius: 18,
    density: 0.004,
    restitution: 0.1,
    friction: 0.1,
    speed: 22,
    impactPower: 0.6,
    ignoresGravity: true,
    effect: { kind: 'burst', radius: 100, damage: 65, push: 5, style: 'sparkle' },
    vs: { glass: 1, ice: 3, sand: 0.8, wood: 1.6, brick: 0.8, stone: 0.6 },
  },
];

export const itemById = (id: ItemId): Item => ITEMS.find((i) => i.id === id)!;
