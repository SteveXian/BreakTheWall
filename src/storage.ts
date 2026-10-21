const KEY = 'btw.progress.v1';

export interface Progress {
  /** Index of the highest level the player may start (0-based). */
  unlocked: number;
  /** Best star count per level index (0 = not cleared yet). */
  stars: number[];
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>;
      return { unlocked: Math.max(0, p.unlocked ?? 0), stars: Array.isArray(p.stars) ? p.stars : [] };
    }
  } catch {
    // Corrupt or blocked storage: start fresh rather than crash.
  }
  return { unlocked: 0, stars: [] };
}

export function saveLevelResult(p: Progress, levelIndex: number, stars: number, levelCount: number): Progress {
  const next: Progress = {
    unlocked: Math.min(levelCount - 1, Math.max(p.unlocked, levelIndex + 1)),
    stars: [...p.stars],
  };
  next.stars[levelIndex] = Math.max(next.stars[levelIndex] ?? 0, stars);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode etc. — progress just won't persist.
  }
  return next;
}
