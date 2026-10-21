// Automated play-through: drives real mouse drags against the dev server and
// reports throws + seconds needed per level.
//   npm run dev   (in another terminal)
//   node scripts/playtest.mjs [firstLevel] [lastLevel]
// Env: URL (default http://127.0.0.1:5173/), CHROME (path to Chrome), HEADED=1, VIDEO=dir, SHOTS=dir
import { chromium } from 'playwright-core';

const URL = process.env.URL ?? 'http://127.0.0.1:5173/';
const first = Number(process.argv[2] ?? 1) - 1;
const last = Number(process.argv[3] ?? 99) - 1;

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/local/bin/google-chrome',
  headless: !process.env.HEADED,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  ...(process.env.VIDEO ? { recordVideo: { dir: process.env.VIDEO, size: { width: 1280, height: 720 } } } : {}),
});
const page = await context.newPage();
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('CONSOLE', m.text()));
await page.goto(URL);
await page.waitForFunction(() => window.__btw);

const levelCount = await page.evaluate(() => window.__btw.LEVELS.length);
const results = [];

async function throwOnce() {
  const plan = await page.evaluate(() => {
    const { game, ITEMS } = window.__btw;
    const blocks = game.debugBlocks().sort((a, b) => a.x - b.x || a.y - b.y);
    const vsOf = (id, m) => ITEMS.find((i) => i.id === id).vs[m];
    for (const b of blocks) {
      for (const best of [...game.available].sort((x, y) => vsOf(y, b.m) - vsOf(x, b.m))) {
        game.setItem(best);
        for (const [tx, ty] of [
          [b.x - b.w / 2 + 8, b.y],
          [b.x, b.y - b.h / 2 + 8],
          [b.x, b.y],
        ]) {
          const pull = game.solveAim(tx, ty);
          if (pull) return { item: best, pull, start: game.worldToScreen(420, 450), end: game.worldToScreen(420 + pull.x, 450 + pull.y) };
        }
      }
    }
    return null;
  });
  if (!plan) return false;
  await page.click(`#picker button[data-item="${plan.item}"]`);
  await page.mouse.move(plan.start.x, plan.start.y);
  await page.mouse.down();
  await page.mouse.move(plan.end.x, plan.end.y, { steps: 12 });
  await page.waitForTimeout(250);
  await page.mouse.up();
  return true;
}

for (let i = Math.max(0, first); i <= Math.min(last, levelCount - 1); i++) {
  await page.evaluate((n) => window.__btw.startLevel(n), i);
  await page.waitForTimeout(300);
  if (await page.isVisible('#overlay-intro')) {
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/intro-${i + 1}.png` });
    await page.click('#btn-intro-go');
  }
  const t0 = Date.now();
  let throws = 0;
  let cleared = false;
  while (throws < 20 && Date.now() - t0 < 120000) {
    if (await page.isVisible('#overlay-clear')) {
      cleared = true;
      break;
    }
    const ok = await throwOnce();
    if (!ok) {
      await page.waitForTimeout(500);
      continue;
    }
    throws++;
    if (process.env.SHOTS && throws === 1) {
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${process.env.SHOTS}/level-${i + 1}.png` });
    }
    await page.waitForTimeout(1800);
  }
  if (!cleared) {
    try {
      await page.waitForSelector('#overlay-clear:not(.hidden)', { timeout: 4000 });
      cleared = true;
    } catch {}
  }
  const remaining = await page.evaluate(() => window.__btw.game.remaining);
  const secs = Math.round((Date.now() - t0) / 1000);
  const par = await page.evaluate((n) => window.__btw.LEVELS[n].par, i);
  results.push({ level: i + 1, cleared, throws, par, secs, remaining });
  console.log(`level ${i + 1}: ${cleared ? 'CLEARED' : 'STUCK  '} throws=${throws} par=${par} secs=${secs} remaining=${remaining}`);
  if (process.env.SHOTS) {
    if (cleared) await page.waitForTimeout(1500);
    await page.screenshot({ path: `${process.env.SHOTS}/${cleared ? 'clear' : 'stuck'}-${i + 1}.png` });
  }
  if (!cleared) console.log('  remaining walls:', JSON.stringify(await page.evaluate(() => window.__btw.game.debugBlocks().map((b) => [b.m, Math.round(b.x), Math.round(b.y)]))));
}

const stuck = results.filter((r) => !r.cleared);
console.log(`\n${results.length - stuck.length}/${results.length} cleared` + (stuck.length ? `; stuck on ${stuck.map((r) => r.level).join(', ')}` : ''));
await context.close();
await browser.close();
