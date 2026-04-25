// Pre-rendered SVG icons for Canvas 2D drawing.
// Each icon is a 24×24 SVG baked into an HTMLImageElement via blob URL.
// Call loadCanvasIcons() once at startup; then use drawCanvasIcon() each frame.

const ICON_SVGS: Record<string, (color: string) => string> = {
  // Flame — fire tower
  flame: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6
             .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0
             c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  </svg>`,

  // Zap — electric tower
  zap: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>`,

  // Wrench — repair tower
  wrench: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77
             a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91
             a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>`,

  // Crosshair — machine gun tower
  crosshair: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="22" y1="12" x2="18" y2="12"/>
    <line x1="6"  y1="12" x2="2"  y2="12"/>
    <line x1="12" y1="6"  x2="12" y2="2"/>
    <line x1="12" y1="22" x2="12" y2="18"/>
  </svg>`,

  // Layers / shield — barricade
  shield: (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>`,
}

// icon key → color → HTMLImageElement
const cache = new Map<string, HTMLImageElement>()

function cacheKey(icon: string, color: string): string { return `${icon}|${color}` }

function makeImage(svgStr: string): HTMLImageElement {
  const blob = new Blob([svgStr], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.src = url
  return img
}

export function loadCanvasIcons(iconDefs: Array<{ icon: string; color: string }>): void {
  for (const { icon, color } of iconDefs) {
    const key = cacheKey(icon, color)
    if (cache.has(key)) continue
    const svgFn = ICON_SVGS[icon]
    if (!svgFn) continue
    cache.set(key, makeImage(svgFn(color)))
  }
}

export function drawCanvasIcon(
  ctx: CanvasRenderingContext2D,
  icon: string,
  color: string,
  cx: number,
  cy: number,
  size: number,
): void {
  const img = cache.get(cacheKey(icon, color))
  if (!img?.complete || img.naturalWidth === 0) return
  const half = size / 2
  ctx.drawImage(img, cx - half, cy - half, size, size)
}
