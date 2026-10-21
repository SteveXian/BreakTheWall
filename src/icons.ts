const svg = (body: string) =>
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  play: svg('<path d="M16 10 L38 24 L16 38 Z" fill="currentColor"/>'),
  home: svg('<path d="M8 24 L24 9 L40 24"/><path d="M13 21 V39 H35 V21" /><path d="M21 39 V29 H27 V39" fill="currentColor"/>'),
  restart: svg('<path d="M38 24 A14 14 0 1 1 33 13"/><path d="M34 5 V14 H25" />'),
  next: svg('<path d="M10 24 H36"/><path d="M26 13 L37 24 L26 35"/>'),
  grid: svg(
    '<rect x="8" y="8" width="12" height="12" rx="3" fill="currentColor"/><rect x="28" y="8" width="12" height="12" rx="3" fill="currentColor"/><rect x="8" y="28" width="12" height="12" rx="3" fill="currentColor"/><rect x="28" y="28" width="12" height="12" rx="3" fill="currentColor"/>',
  ),
  soundOn: svg('<path d="M8 19 H15 L25 10 V38 L15 29 H8 Z" fill="currentColor"/><path d="M31 17 A9 9 0 0 1 31 31"/><path d="M36 11 A17 17 0 0 1 36 37"/>'),
  soundOff: svg('<path d="M8 19 H15 L25 10 V38 L15 29 H8 Z" fill="currentColor"/><path d="M32 18 L42 30"/><path d="M42 18 L32 30"/>'),
  lock: svg('<rect x="11" y="21" width="26" height="20" rx="4" fill="currentColor"/><path d="M16 21 V15 A8 8 0 0 1 32 15 V21"/>'),
  trophy: svg(
    '<path d="M15 8 H33 V20 A9 9 0 0 1 15 20 Z" fill="currentColor"/><path d="M15 12 H8 A7 7 0 0 0 15 22"/><path d="M33 12 H40 A7 7 0 0 1 33 22"/><path d="M24 29 V36"/><path d="M16 40 H32"/>',
  ),
};
