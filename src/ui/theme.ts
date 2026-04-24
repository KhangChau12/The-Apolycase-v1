export const T = {
  // Palette
  bg:          '#D4C5B0',
  text:        '#2C2416',
  rust:        '#8B3A2A',
  orange:      '#C4622D',
  amber:       '#E8A030',
  blood:       '#CC1A1A',
  iron:        '#7A7060',
  ember:       '#FF6B35',

  // Semantic
  hpHigh:      '#4CAF50',
  hpMid:       '#E8A030',
  hpLow:       '#CC1A1A',
  gold:        '#E8C84A',
  ironGrey:    '#A89880',
  coreBlue:    '#7788FF',
  crystalCyan: '#88EEFF',

  font:        "'Russo One', sans-serif",

  hpColor(pct: number): string {
    return pct > 0.5 ? '#4CAF50' : pct > 0.25 ? '#E8A030' : '#CC1A1A'
  },

  panelBg(alpha = 0.93): string {
    return `rgba(20,12,8,${alpha})`
  },
}
