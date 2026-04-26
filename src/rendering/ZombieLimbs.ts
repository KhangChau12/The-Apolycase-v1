import type { ZombieArchetype } from '../entities/Zombie'
import type { AnimationFrame } from '../data/zombieAnimationData'

export interface LimbSegment {
  id: string
  type: 'circle' | 'rect' | 'triangle' | 'line' | 'polygon'
  x: number          // relative to parent center
  y: number
  w: number          // width, or radius for circle
  h: number          // height (unused for circle)
  rotation: number   // base rotation in radians
  color: string
  strokeColor?: string
  strokeWidth?: number
  glow?: string
  glowBlur?: number
  alpha?: number
  // polygon-only: array of [x,y] pairs relative to segment origin
  points?: [number, number][]
  children?: LimbSegment[]
}

export interface ZombieRenderParams {
  radius: number
  animFrame: AnimationFrame
  hitRecoilTimer: number
  windupActive: boolean
  windupPct: number    // 0→1 progress through wind-up
  glowColor: string
  glowBlur: number
  wobble: number       // for time-based effects that need world time
}

// ── Draw helpers ──────────────────────────────────────────────────────────────

function drawSegment(ctx: CanvasRenderingContext2D, seg: LimbSegment, params: ZombieRenderParams): void {
  ctx.save()
  ctx.translate(seg.x, seg.y)
  ctx.rotate(seg.rotation)

  if (seg.alpha !== undefined) ctx.globalAlpha = seg.alpha

  if (seg.glow) {
    ctx.shadowColor = seg.glow
    ctx.shadowBlur = seg.glowBlur ?? 8
  }

  ctx.fillStyle = seg.color
  if (seg.strokeColor) {
    ctx.strokeStyle = seg.strokeColor
    ctx.lineWidth = seg.strokeWidth ?? 1.5
  }

  switch (seg.type) {
    case 'circle': {
      ctx.beginPath()
      ctx.arc(0, 0, seg.w, 0, Math.PI * 2)
      ctx.fill()
      if (seg.strokeColor) ctx.stroke()
      break
    }
    case 'rect': {
      ctx.fillRect(-seg.w / 2, -seg.h / 2, seg.w, seg.h)
      if (seg.strokeColor) ctx.strokeRect(-seg.w / 2, -seg.h / 2, seg.w, seg.h)
      break
    }
    case 'triangle': {
      ctx.beginPath()
      ctx.moveTo(0, -seg.h / 2)
      ctx.lineTo(-seg.w / 2, seg.h / 2)
      ctx.lineTo( seg.w / 2, seg.h / 2)
      ctx.closePath()
      ctx.fill()
      if (seg.strokeColor) ctx.stroke()
      break
    }
    case 'line': {
      ctx.beginPath()
      ctx.moveTo(0, -seg.h / 2)
      ctx.lineTo(0,  seg.h / 2)
      if (seg.strokeColor) {
        ctx.strokeStyle = seg.strokeColor
        ctx.lineWidth = seg.strokeWidth ?? 2
        ctx.stroke()
      }
      break
    }
    case 'polygon': {
      if (!seg.points || seg.points.length < 3) break
      ctx.beginPath()
      ctx.moveTo(seg.points[0][0], seg.points[0][1])
      for (let i = 1; i < seg.points.length; i++) ctx.lineTo(seg.points[i][0], seg.points[i][1])
      ctx.closePath()
      ctx.fill()
      if (seg.strokeColor) ctx.stroke()
      break
    }
  }

  if (seg.glow) ctx.shadowBlur = 0
  if (seg.alpha !== undefined) ctx.globalAlpha = 1

  if (seg.children) {
    for (const child of seg.children) drawSegment(ctx, child, params)
  }

  ctx.restore()
}

// ── Main composite draw entry point ──────────────────────────────────────────

export function drawZombieComposite(
  ctx: CanvasRenderingContext2D,
  skeleton: LimbSegment[],
  params: ZombieRenderParams,
): void {
  const { animFrame, hitRecoilTimer, windupActive, windupPct } = params

  ctx.save()

  // Apply body scale from animation frame + hit recoil
  let bsx = animFrame.bodyScaleX
  let bsy = animFrame.bodyScaleY
  if (hitRecoilTimer > 0) {
    bsx *= 0.88
    bsy *= 0.88
  }
  // Wind-up: compress before strike
  if (windupActive) {
    bsx *= (1 - 0.15 * windupPct)
    bsy *= (1 + 0.10 * windupPct)
  }
  if (bsx !== 1 || bsy !== 1) ctx.scale(bsx, bsy)

  for (const seg of skeleton) drawSegment(ctx, seg, params)

  ctx.restore()
}

// ── Skeleton factory helpers ──────────────────────────────────────────────────

function seg(id: string, type: LimbSegment['type'], x: number, y: number, w: number, h: number,
  color: string, rot = 0, opts: Partial<LimbSegment> = {}): LimbSegment {
  return { id, type, x, y, w, h, color, rotation: rot, ...opts }
}

function polyHex(r: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 6
    return [Math.cos(a) * r, Math.sin(a) * r] as [number, number]
  })
}

function polyPent(r: number): [number, number][] {
  return Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2
    return [Math.cos(a) * r, Math.sin(a) * r] as [number, number]
  })
}

// rounded rect via polygon approximation (8 pts)
function polyRoundRect(w: number, h: number, cr: number): [number, number][] {
  const hw = w / 2, hh = h / 2
  return [
    [-hw + cr, -hh], [hw - cr, -hh],
    [hw, -hh + cr],  [hw, hh - cr],
    [hw - cr, hh],   [-hw + cr, hh],
    [-hw, hh - cr],  [-hw, -hh + cr],
  ]
}

// ── REGULAR skeletons ─────────────────────────────────────────────────────────

function regularSkel(r: number, tier: number): LimbSegment[] {
  const gc = ['', '#4a8a20', '#88FF44', '#BBFF66'][Math.min(tier, 3)]
  const gbl = [0, 6, 10, 14][Math.min(tier, 3)]
  const eyeC = tier >= 2 ? '#CCFF44' : '#88FF44'
  const stroke = tier >= 2 ? '#88FF44' : '#5C2A1A'

  const eyes: LimbSegment[] = [
    seg('eye_l', 'circle', -r * 0.26, -r * 0.85, r * 0.14, 0, eyeC, 0, tier >= 1 ? { glow: eyeC, glowBlur: 5 } : {}),
    seg('eye_r', 'circle',  r * 0.26, -r * 0.85, r * 0.14, 0, eyeC, 0, tier >= 1 ? { glow: eyeC, glowBlur: 5 } : {}),
  ]

  const arms: LimbSegment[] = [
    seg('arm_l', 'line', -r * 0.55, -r * 0.1, 0, r * 0.7, '#4a2a14', 0.5,  { strokeColor: '#4a2a14', strokeWidth: 2 }),
    seg('arm_r', 'line',  r * 0.55, -r * 0.1, 0, r * 0.7, '#4a2a14', -0.5, { strokeColor: '#4a2a14', strokeWidth: 2 }),
  ]

  if (tier >= 1) {
    arms.push(
      seg('arm_l2', 'line', -r * 0.6, r * 0.1, 0, r * 0.6, '#3a2a10', 0.7,  { strokeColor: '#3a2a10', strokeWidth: 1.5 }),
      seg('arm_r2', 'line',  r * 0.6, r * 0.1, 0, r * 0.6, '#3a2a10', -0.7, { strokeColor: '#3a2a10', strokeWidth: 1.5 }),
    )
  }

  const spikes: LimbSegment[] = []
  if (tier >= 2) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      spikes.push(seg(`spike_${i}`, 'line',
        Math.cos(a) * (r + 3), Math.sin(a) * (r + 3),
        0, 6, '#BBFF66', a, { strokeColor: '#BBFF66', strokeWidth: 1.2, alpha: 0.7 }
      ))
    }
  }

  const body = seg('body', 'circle', 0, 0, r, 0, '#2a1a0a', 0, {
    strokeColor: stroke,
    strokeWidth: tier >= 3 ? 2 : 1.5,
    glow: tier > 0 ? gc : undefined,
    glowBlur: gbl,
  })

  const head = seg('head', 'circle', 0, -r * 0.85, r * 0.34, 0, '#3a2010')

  return [...spikes, body, head, ...arms, ...eyes]
}

// ── FAST skeletons ────────────────────────────────────────────────────────────

function fastSkel(r: number, tier: number): LimbSegment[] {
  const gc = ['', '#44CC44', '#AAFF44', '#FFFF44'][Math.min(tier, 3)]
  const gbl = [0, 8, 12, 16][Math.min(tier, 3)]
  const finCount = tier >= 3 ? 4 : tier >= 2 ? 3 : tier >= 1 ? 2 : 1
  const bodyStretch = 1 + tier * 0.08
  const bodyH = r * 2.4 * bodyStretch
  const bodyW = r * 1.1 * (1 - tier * 0.04)
  const stroke = tier >= 2 ? '#AAFF44' : '#4CAF50'

  const fins: LimbSegment[] = []
  for (let f = 0; f < finCount; f++) {
    const offset = (f + 1) * r * 0.22
    fins.push(
      seg(`fin_l_${f}`, 'line', -r * 0.45, -r * 0.2 + offset, 0, r * 0.9, '#4CAF50',
        0.4, { strokeColor: tier >= 3 ? '#FFFF44' : '#4CAF50', strokeWidth: 1.2, alpha: 0.65 }),
      seg(`fin_r_${f}`, 'line',  r * 0.45, -r * 0.2 + offset, 0, r * 0.9, '#4CAF50',
        -0.4, { strokeColor: tier >= 3 ? '#FFFF44' : '#4CAF50', strokeWidth: 1.2, alpha: 0.65 }),
    )
  }

  // Tier 3: tail extension
  const tail: LimbSegment[] = []
  if (tier >= 3) {
    tail.push(seg('tail', 'triangle', 0, r * 1.1, r * 0.3, r * 0.5, '#0a1a08', 0, {
      strokeColor: '#FFFF44', strokeWidth: 1,
    }))
  }

  const body = seg('body', 'triangle', 0, 0, bodyW, bodyH, '#0a1a08', 0, {
    strokeColor: stroke, strokeWidth: tier >= 3 ? 2 : 1.5,
    glow: tier > 0 ? gc : undefined, glowBlur: gbl,
  })

  // Ghost trail (3 faint ovals behind)
  const trail: LimbSegment[] = [
    seg('trail_0', 'circle', 0, r * 1.2, r * 0.85, 0, '#4CAF50', 0, { alpha: 0.13 }),
    seg('trail_1', 'circle', 0, r * 2.2, r * 0.70, 0, '#4CAF50', 0, { alpha: 0.07 }),
    seg('trail_2', 'circle', 0, r * 3.2, r * 0.55, 0, '#4CAF50', 0, { alpha: 0.03 }),
  ]

  const eyeC = tier >= 2 ? '#FFFF44' : '#CCFF44'
  const eyeSlash = seg('eye_slash', 'line', 0, -r * 0.62, 0, r * 0.65, '#88FF44', -0.1, {
    strokeColor: eyeC, strokeWidth: 1.8, glow: '#88FF44', glowBlur: 5,
  })

  return [...trail, ...fins, ...tail, body, eyeSlash]
}

// ── TANK skeletons ────────────────────────────────────────────────────────────

function tankSkel(r: number, tier: number): LimbSegment[] {
  const gc = ['', '#991010', '#CC3030', '#FF2200'][Math.min(tier, 3)]
  const gbl = [0, 8, 12, 16][Math.min(tier, 3)]
  const padW = tier >= 3 ? r * 0.58 : r * 0.48
  const stroke = tier >= 2 ? '#CC3030' : '#8B1A1A'

  const corona: LimbSegment[] = []
  if (tier >= 3) {
    corona.push(seg('corona', 'circle', 0, 0, r + 7, 0, 'transparent', 0, {
      strokeColor: 'rgba(255,34,0,0.4)', strokeWidth: 3,
    }))
  }

  const armorRing: LimbSegment[] = []
  if (tier >= 2) {
    armorRing.push(seg('armor_ring', 'circle', 0, 0, r + 4, 0, 'transparent', 0, {
      strokeColor: '#CC3030', strokeWidth: 1.5, alpha: 0.5,
    }))
  }

  const padL = seg('pad_l', 'rect', -r - padW / 2, 0, padW, r * 0.6, '#2a0a0a', 0, {
    strokeColor: stroke, strokeWidth: 1.2,
  })
  const padR = seg('pad_r', 'rect',  r + padW / 2, 0, padW, r * 0.6, '#2a0a0a', 0, {
    strokeColor: stroke, strokeWidth: 1.2,
  })

  const bodyPts = polyRoundRect(r * 2, r * 2, 4)
  const body = seg('body', 'polygon', 0, 0, r, r, '#1a0808', 0, {
    points: bodyPts, strokeColor: stroke,
    strokeWidth: tier >= 3 ? 2.5 : 2,
    glow: tier > 0 ? gc : undefined, glowBlur: gbl,
  })

  const spine = seg('spine', 'line', 0, 0, 0, r * 1.5, '#5a1010', 0, {
    strokeColor: '#5a1010', strokeWidth: 2.5,
  })

  const bolts: LimbSegment[] = []
  if (tier >= 1) {
    for (const [bx, by] of [[-r*0.6, -r*0.6], [r*0.6, -r*0.6], [-r*0.6, r*0.6], [r*0.6, r*0.6]] as [number,number][]) {
      bolts.push(seg(`bolt_${bx}`, 'circle', bx, by, 2.5, 0, '#8B1A1A'))
    }
  }

  const mouthPts: [number, number][] = [
    [-r * 0.5, r * 0.6], [-r * 0.25, r * 0.35], [0, r * 0.6],
    [r * 0.25, r * 0.35], [r * 0.5, r * 0.6],
  ]
  const mouth = seg('mouth', 'polygon', 0, 0, 0, 0, 'transparent', 0, {
    points: mouthPts, strokeColor: '#8B1A1A', strokeWidth: 1.5,
  })

  return [...corona, ...armorRing, padL, padR, body, spine, ...bolts, mouth]
}

// ── ARMORED skeletons ─────────────────────────────────────────────────────────

function armoredSkel(r: number, tier: number): LimbSegment[] {
  const gc = ['', '#3A5A80', '#5A88CC', '#88EEFF'][Math.min(tier, 3)]
  const gbl = [0, 8, 12, 16][Math.min(tier, 3)]
  const bodyFill = tier >= 3 ? '#1a2030' : '#0a0a1a'
  const stroke = tier >= 2 ? '#5A88CC' : '#5A6A80'

  const outerPent: LimbSegment[] = []
  if (tier >= 2) {
    outerPent.push(seg('outer_pent', 'polygon', 0, 0, 0, 0, 'transparent', 0, {
      points: polyPent(r + 5),
      strokeColor: tier >= 3 ? '#88EEFF' : '#5A6A80',
      strokeWidth: 1.2, alpha: 0.5,
    }))
  }

  const body = seg('body', 'polygon', 0, 0, 0, 0, bodyFill, 0, {
    points: polyPent(r),
    strokeColor: stroke, strokeWidth: tier >= 3 ? 2.5 : 2,
    glow: tier > 0 ? gc : undefined, glowBlur: gbl,
  })

  // Plate lines (3 horizontal)
  const plates: LimbSegment[] = []
  for (let i = -1; i <= 1; i++) {
    const py = i * r * 0.3
    const hw = Math.sqrt(Math.max(0, r * r - py * py)) * 0.85
    plates.push(seg(`plate_${i}`, 'line', 0, py, 0, hw * 2, tier >= 3 ? '#7788AA' : '#3A4A60', 0, {
      strokeColor: tier >= 3 ? '#7788AA' : '#3A4A60', strokeWidth: 1.2,
    }))
  }

  const visorAlpha = tier >= 3 ? 0.9 : 0.45
  const visor = seg('visor', 'rect', 0, -r * 0.72, r * 0.7, r * 0.18, `rgba(136,238,255,${visorAlpha})`, 0,
    tier >= 2 ? { glow: '#88EEFF', glowBlur: 6 } : {}
  )

  const shoulderRidges: LimbSegment[] = []
  if (tier >= 1) {
    shoulderRidges.push(
      seg('ridge_l', 'line', -r * 0.775, -r * 0.425, 0, r * 0.4, '#5A88CC', 0.5, {
        strokeColor: '#5A88CC', strokeWidth: 1.5,
      }),
      seg('ridge_r', 'line',  r * 0.775, -r * 0.425, 0, r * 0.4, '#5A88CC', -0.5, {
        strokeColor: '#5A88CC', strokeWidth: 1.5,
      }),
    )
  }

  const arcDeco: LimbSegment[] = []
  if (tier >= 3) {
    arcDeco.push(
      seg('arc_l', 'polygon', 0, 0, 0, 0, 'transparent', 0, {
        points: [[-r*0.4, r*0.2], [-r*0.1, r*0.45], [-r*0.3, r*0.6]],
        strokeColor: '#88EEFF', strokeWidth: 1, alpha: 0.6,
      }),
      seg('arc_r', 'polygon', 0, 0, 0, 0, 'transparent', 0, {
        points: [[r*0.4, r*0.2], [r*0.1, r*0.45], [r*0.3, r*0.6]],
        strokeColor: '#88EEFF', strokeWidth: 1, alpha: 0.6,
      }),
    )
  }

  return [...outerPent, body, ...plates, visor, ...shoulderRidges, ...arcDeco]
}

// ── BOSS visual-tier skeletons ────────────────────────────────────────────────

function bossSkel(r: number, vTier: number): LimbSegment[] {
  // Outer fin spikes (6)
  const fins: LimbSegment[] = []
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    fins.push(seg(`fin_${i}`, 'line',
      Math.cos(a) * (r + 8), Math.sin(a) * (r + 8),
      0, 10, '#FF3300', a, { strokeColor: '#FF3300', strokeWidth: 2 }
    ))
  }

  // vTier 1+: outer blade ring (12 extra spikes)
  const bladeRing: LimbSegment[] = []
  if (vTier >= 1) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      bladeRing.push(seg(`blade_${i}`, 'line',
        Math.cos(a) * (r + 18), Math.sin(a) * (r + 18),
        0, 7, '#CC1A1A', a, { strokeColor: '#CC1A1A', strokeWidth: 1.5, alpha: 0.75 }
      ))
    }
  }

  // Body: hexagon
  const hexFill = vTier >= 2 ? '#1f0000' : '#1a0000'
  const hexStroke = vTier >= 1 ? '#FF2200' : '#CC1A1A'
  const body = seg('body', 'polygon', 0, 0, 0, 0, hexFill, 0, {
    points: polyHex(r),
    strokeColor: hexStroke, strokeWidth: 3.5,
    glow: '#CC1A1A', glowBlur: 14,
  })

  // 3 nested hexagons
  const nested: LimbSegment[] = [
    seg('hex_mid',   'polygon', 0, 0, 0, 0, 'transparent', 0, { points: polyHex(r * 0.7), strokeColor: '#8B1A1A', strokeWidth: 1.5 }),
    seg('hex_inner', 'polygon', 0, 0, 0, 0, '#330000',     0, { points: polyHex(r * 0.4), strokeColor: '#CC1A1A', strokeWidth: 1 }),
    seg('hex_core',  'polygon', 0, 0, 0, 0, '#660000',     0, { points: polyHex(r * 0.2), strokeColor: '#FF4444', strokeWidth: 1 }),
  ]

  // 3 red eye cluster
  const eyes: LimbSegment[] = [
    seg('eye_c', 'circle',  0,        -r * 0.28, r * 0.09, 0, '#FF4444', 0, { glow: '#FF2200', glowBlur: 5 }),
    seg('eye_l', 'circle', -r * 0.18, -r * 0.15, r * 0.07, 0, '#FF4444', 0, { glow: '#FF2200', glowBlur: 4 }),
    seg('eye_r', 'circle',  r * 0.18, -r * 0.15, r * 0.07, 0, '#FF4444', 0, { glow: '#FF2200', glowBlur: 4 }),
  ]

  // vTier 2+: extra eye cluster
  const eyesExtra: LimbSegment[] = []
  if (vTier >= 2) {
    eyesExtra.push(
      seg('eye_el', 'circle', -r * 0.30, r * 0.10, r * 0.065, 0, '#FF2200', 0, { glow: '#FF0000', glowBlur: 5 }),
      seg('eye_er', 'circle',  r * 0.30, r * 0.10, r * 0.065, 0, '#FF2200', 0, { glow: '#FF0000', glowBlur: 5 }),
    )
  }

  // vTier 1+: extra nested hexagon layer
  const extraHex: LimbSegment[] = []
  if (vTier >= 1) {
    extraHex.push(seg('hex_out2', 'polygon', 0, 0, 0, 0, 'transparent', 0, {
      points: polyHex(r * 0.85), strokeColor: '#CC2200', strokeWidth: 1,
    }))
  }

  // vTier 2+: corona pulse ring (rendered with alpha — pulsing handled by wobble in drawBossExtras)
  const coronaRing: LimbSegment[] = []
  if (vTier >= 2) {
    coronaRing.push(seg('corona', 'circle', 0, 0, r + 14, 0, 'transparent', 0, {
      strokeColor: 'rgba(255,34,0,0.35)', strokeWidth: 4,
    }))
  }

  return [...coronaRing, ...bladeRing, ...fins, body, ...extraHex, ...nested, ...eyes, ...eyesExtra]
}

// ── LIMB_SKELETONS export ─────────────────────────────────────────────────────
// For regular/fast/tank/armored: index = tier (0-3)
// For boss: index = visual tier (0-2)
// The actual radius is computed at render time and passed in.
// We store skeleton factories keyed by archetype; the renderer calls them with live radius.

export type SkeletonFactory = (r: number, tier: number) => LimbSegment[]

export const SKELETON_FACTORIES: Record<ZombieArchetype, SkeletonFactory> = {
  regular: regularSkel,
  fast:    fastSkel,
  tank:    tankSkel,
  armored: armoredSkel,
  boss:    bossSkel,
}
