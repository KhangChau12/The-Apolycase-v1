// SVG icon strings sourced from Lucide (lucide.dev) — MIT License
// Each function returns a complete <svg> HTML string for use in innerHTML.

function svg(size: number, color: string, paths: string, extra = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${paths}</svg>`
}

export const ICONS: Record<string, (size?: number, color?: string) => string> = {
  heart: (s = 20, c = 'currentColor') => svg(s, c,
    `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>`),

  zap: (s = 20, c = 'currentColor') => svg(s, c,
    `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`),

  crosshair: (s = 20, c = 'currentColor') => svg(s, c,
    `<circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/>`),

  split: (s = 20, c = 'currentColor') => svg(s, c,
    `<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/>`),

  'circle-dot': (s = 20, c = 'currentColor') => svg(s, c,
    `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/>`),

  bomb: (s = 20, c = 'currentColor') => svg(s, c,
    `<circle cx="11" cy="13" r="9"/><path d="M14.35 4.65 16.3 2.7a2.41 2.41 0 0 1 3.41 3.41l-1.81 1.81"/><path d="m22 2-1.5 1.5"/>`),

  'arrow-right': (s = 20, c = 'currentColor') => svg(s, c,
    `<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>`),

  shield: (s = 20, c = 'currentColor') => svg(s, c,
    `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`),

  eye: (s = 20, c = 'currentColor') => svg(s, c,
    `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`),

  activity: (s = 20, c = 'currentColor') => svg(s, c,
    `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`),

  expand: (s = 20, c = 'currentColor') => svg(s, c,
    `<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>`),

  flame: (s = 20, c = 'currentColor') => svg(s, c,
    `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>`),

  'plus-circle': (s = 20, c = 'currentColor') => svg(s, c,
    `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>`),

  'refresh-cw': (s = 20, c = 'currentColor') => svg(s, c,
    `<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>`),

  layers: (s = 20, c = 'currentColor') => svg(s, c,
    `<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>`),

  sword: (s = 20, c = 'currentColor') => svg(s, c,
    `<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/>`),

  star: (s = 20, c = 'currentColor') => svg(s, c,
    `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`),

  // Resource icons
  coins: (s = 20, c = 'currentColor') => svg(s, c,
    `<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><line x1="9.69" y1="9.69" x2="10.5" y2="10.5"/>`),

  hexagon: (s = 20, c = 'currentColor') => svg(s, c,
    `<polygon points="21 16 21 8 12 3 3 8 3 16 12 21 21 16"/>`),

  cpu: (s = 20, c = 'currentColor') => svg(s, c,
    `<rect x="9" y="9" width="6" height="6"/><rect x="2" y="2" width="20" height="20" rx="2" ry="2"/><line x1="9" y1="2" x2="9" y2="4"/><line x1="15" y1="2" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="22"/><line x1="15" y1="20" x2="15" y2="22"/><line x1="2" y1="9" x2="4" y2="9"/><line x1="2" y1="15" x2="4" y2="15"/><line x1="20" y1="9" x2="22" y2="9"/><line x1="20" y1="15" x2="22" y2="15"/>`),

  gem: (s = 20, c = 'currentColor') => svg(s, c,
    `<polygon points="6 3 18 3 22 9 12 22 2 9 6 3"/><polyline points="22 9 12 22 2 9"/><line x1="6" y1="3" x2="2" y2="9"/><line x1="18" y1="3" x2="22" y2="9"/>`),

  x: (s = 20, c = 'currentColor') => svg(s, c,
    `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`),

  'chevron-right': (s = 20, c = 'currentColor') => svg(s, c,
    `<polyline points="9 18 15 12 9 6"/>`),

  check: (s = 20, c = 'currentColor') => svg(s, c,
    `<polyline points="20 6 9 17 4 12"/>`),

  user: (s = 20, c = 'currentColor') => svg(s, c,
    `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`),

  package: (s = 20, c = 'currentColor') => svg(s, c,
    `<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>`),

  map: (s = 20, c = 'currentColor') => svg(s, c,
    `<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>`),
}

export function getIcon(key: string, size = 20, color = 'currentColor'): string {
  const fn = ICONS[key]
  if (!fn) return `<span style="font-size:${size * 0.8}px;line-height:1">${key}</span>`
  return fn(size, color)
}
