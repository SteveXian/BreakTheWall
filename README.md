# Break the Wall!

A bright, cartoony browser game for kids (ages 5–7). Pull back the slingshot, let go,
and smash walls made of glass, ice, sand, wood, brick and stone with silly throwables.
A level is cleared when every wall is gone.

Designed for little hands: drag anywhere to aim, big buttons, icons instead of words,
unlimited throws, and no way to lose. Stars (1–3) are a bonus for using fewer throws.
Every level clear gives at least one star.

## Run it

Requires Node 18+.

```bash
npm install
npm run dev        # open the printed URL (http://localhost:5173)
```

Other scripts:

```bash
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm run typecheck
```

Works with mouse and touch (phones/tablets in landscape).

## How to play

1. Tap the big green play button, then pick a level.
2. Drag anywhere on the screen to pull the slingshot back; the dotted line shows where
   it will fly. Let go to throw.
3. Tap an item at the bottom to switch throwables. Walls with a twinkling star outline
   are the ones your current item is extra strong against.

## Throwables

| Item | Behaviour | Super strong vs. |
| --- | --- | --- |
| Bouncy ball | Bounces around, hitting several blocks | Glass |
| Bottle | Shatters on impact, damaging everything close by | Glass, ice |
| Water balloon | Big splash that washes blocks away | Sand |
| Bowling ball | Very heavy and rolls through things | Wood, brick |
| Rocket | Flies in a straight line (no gravity), sparkly pop | Ice |
| Bomb | Friendly cartoon bomb: short fuse, then a big BOOM | Stone, brick |

## Walls

Glass (weakest) → ice → sand → wood → brick → stone (toughest). Grey steel girders are
unbreakable platforms and don't need to be destroyed. Falling blocks also take damage,
so knocking towers over helps.

## Levels

There are 32 levels. Each new throwable gets 3 introduction levels built around what
it's good at (with a "NEW!" card showing the item and the materials it smashes),
followed by 2 mixed levels using everything unlocked so far:

| Levels | Content |
| --- | --- |
| 1–3 | Bouncy ball intro (glass) |
| 4–6 | Bottle intro (glass, ice) |
| 7–8 | Mixed |
| 9–11 | Water balloon intro (sandcastles) |
| 12–13 | Mixed |
| 14–16 | Bowling ball intro (wood, brick) |
| 17–18 | Mixed |
| 19–21 | Rocket intro (ice and wood up high) |
| 22–23 | Mixed |
| 24–26 | Bomb intro (stone) |
| 27–28 | Mixed |
| 29–32 | Grand finale |

Progress (unlocked levels and best stars) is saved in `localStorage`.

### Adding a level

Levels live in [`src/levels.ts`](src/levels.ts) as plain data. Each structure is a small
ASCII picture, drawn bottom-up with one letter per square cell:

```ts
{
  items: ['ball', 'bottle'],     // throwables offered (first is pre-selected)
  par: 3,                        // throws for 3 stars
  structures: [
    { x: 1150, grid: ['ggggg',   // lowercase run = one long plank
                      'G...G',   // G glass, I ice, S sand, W wood, B brick, R stone
                      'G...G'] },// . empty
    { x: 1350, y: 560, grid: ['II', '###'] }, // # steel; y lifts the structure off the ground
  ],
}
```

Add `introduces: 'itemId'` to show the "NEW!" card for an item on that level.

## Project layout

- `src/game.ts` – physics (Matter.js), slingshot input, damage rules, effects and rendering
- `src/items.ts` – throwables and their per-material effectiveness
- `src/materials.ts` – wall materials (health, density, colours)
- `src/levels.ts` – level data and the ASCII level builder
- `src/draw.ts` – all cartoon drawing (canvas 2D, no image assets)
- `src/audio.ts` – synthesized sound effects (Web Audio, no audio files)
- `src/main.ts` – screens, HUD, item picker, level select, saving
- `scripts/playtest.mjs` – automated play-through that drives real mouse drags through
  every level and reports throws/time (`npm run dev`, then `node scripts/playtest.mjs`)

Tech: Vite + TypeScript + [Matter.js](https://brm.io/matter-js/).
