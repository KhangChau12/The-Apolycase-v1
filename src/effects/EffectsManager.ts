import { Particle } from './Particle'
import { T } from '../ui/theme'

type ZombieArchetype = 'regular' | 'fast' | 'tank' | 'armored' | 'boss'

interface LightningSegment { ax: number; ay: number; bx: number; by: number }

interface LightningEffect {
  chains: LightningSegment[][]
  life: number
  maxLife: number
}

// One arc stroke of a slash mark
interface SlashStroke {
  cx: number; cy: number   // arc center
  r: number                // arc radius
  startAngle: number
  endAngle: number
  lineWidth: number
  color: string
  delay: number            // 0.0–0.25: fraction of maxLife before this stroke starts fading
  isCrack?: true           // boss only: render as straight line instead of arc
  crackX1?: number; crackY1?: number
  crackX2?: number; crackY2?: number
}

interface SlashEffect {
  strokes: SlashStroke[]
  life: number
  maxLife: number
  glowColor: string
  flashRadius: number      // > 0 = draw impact flash circle; 0 = no flash
  flashColor: string       // mid color of radial gradient flash
  impactX: number          // world position of hit point
  impactY: number
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export class EffectsManager {
  private particles: Particle[] = []
  private lightnings: LightningEffect[] = []
  private slashes: SlashEffect[] = []
  private screenFlashAlpha = 0
  private screenFlashColor = '204,26,26'

  update(dt: number): void {
    for (const p of this.particles) p.update(dt)
    this.particles = this.particles.filter(p => p.alive)
    if (this.particles.length > 400) this.particles.splice(0, 40)
    for (const l of this.lightnings) l.life -= dt
    this.lightnings = this.lightnings.filter(l => l.life > 0)
    for (const s of this.slashes) s.life -= dt
    this.slashes = this.slashes.filter(s => s.life > 0)
    if (this.screenFlashAlpha > 0) this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - dt * 1.8)
  }

  renderWorld(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.save()
      ctx.globalAlpha = p.alpha
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // Persistent lightning chains
    for (const l of this.lightnings) {
      const alpha = l.life / l.maxLife
      for (const chain of l.chains) {
        // Glow pass
        ctx.save()
        ctx.globalAlpha = alpha * 0.5
        ctx.strokeStyle = '#88eeff'
        ctx.lineWidth = 4
        ctx.shadowColor = '#88eeff'
        ctx.shadowBlur = 12
        ctx.lineCap = 'round'
        ctx.beginPath()
        for (const seg of chain) {
          ctx.moveTo(seg.ax, seg.ay)
          ctx.lineTo(seg.bx, seg.by)
        }
        ctx.stroke()
        ctx.restore()

        // Core pass
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.strokeStyle = '#ccf8ff'
        ctx.lineWidth = 1.5
        ctx.shadowColor = '#88eeff'
        ctx.shadowBlur = 6
        ctx.lineCap = 'round'
        ctx.beginPath()
        for (const seg of chain) {
          ctx.moveTo(seg.ax, seg.ay)
          ctx.lineTo(seg.bx, seg.by)
        }
        ctx.stroke()
        ctx.restore()

        // White hot center
        ctx.save()
        ctx.globalAlpha = alpha * 0.7
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 0.6
        ctx.lineCap = 'round'
        ctx.beginPath()
        for (const seg of chain) {
          ctx.moveTo(seg.ax, seg.ay)
          ctx.lineTo(seg.bx, seg.by)
        }
        ctx.stroke()
        ctx.restore()
      }
    }

    // Slash marks — animated arc strokes with sweep-in and staggered fade
    for (const slash of this.slashes) {
      const lifeRatio = slash.life / slash.maxLife   // 1→0 as it fades
      const elapsed = 1 - lifeRatio

      // Phase 1 — Impact flash: only in first 12% of lifetime
      if (slash.flashRadius > 0 && lifeRatio > 0.88) {
        const flashT = (lifeRatio - 0.88) / 0.12
        ctx.save()
        ctx.globalAlpha = flashT * 0.85
        const flashGrad = ctx.createRadialGradient(
          slash.impactX, slash.impactY, 0,
          slash.impactX, slash.impactY, slash.flashRadius
        )
        flashGrad.addColorStop(0, '#FFFFFF')
        flashGrad.addColorStop(0.4, slash.flashColor)
        flashGrad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = flashGrad
        ctx.beginPath()
        ctx.arc(slash.impactX, slash.impactY, slash.flashRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      ctx.save()
      ctx.lineCap = 'round'

      for (const stroke of slash.strokes) {
        // Phase 2 — Sweep-in: reveal arc over first 30% of lifetime
        const sweepProgress = elapsed < 0.30
          ? smoothstep(0, 0.30, elapsed)
          : 1.0

        // Phase 3 — Staggered fade: each stroke has a delay offset
        const fadeStart = 1 - stroke.delay
        const strokeT = lifeRatio < fadeStart
          ? lifeRatio / fadeStart
          : 1.0
        const alpha = strokeT * strokeT   // quadratic fade

        if (alpha <= 0) continue

        ctx.globalAlpha = alpha

        if (stroke.isCrack) {
          // Boss crack: straight line revealed from start toward end
          const x1 = stroke.crackX1!
          const y1 = stroke.crackY1!
          const x2 = x1 + (stroke.crackX2! - x1) * sweepProgress
          const y2 = y1 + (stroke.crackY2! - y1) * sweepProgress

          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.strokeStyle = stroke.color
          ctx.lineWidth = stroke.lineWidth
          ctx.shadowColor = slash.glowColor
          ctx.shadowBlur = 6
          ctx.stroke()

          // Bright centerline
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.strokeStyle = '#FFFFFF'
          ctx.lineWidth = 0.7
          ctx.shadowBlur = 0
          ctx.globalAlpha = alpha * 0.4
          ctx.stroke()

        } else {
          // Arc stroke revealed from startAngle toward endAngle
          const span = stroke.endAngle - stroke.startAngle
          const visibleEnd = stroke.startAngle + span * sweepProgress

          // Glow pass
          ctx.beginPath()
          ctx.arc(stroke.cx, stroke.cy, stroke.r, stroke.startAngle, visibleEnd)
          ctx.strokeStyle = slash.glowColor
          ctx.lineWidth = stroke.lineWidth * 3.5
          ctx.shadowColor = slash.glowColor
          ctx.shadowBlur = 12
          ctx.stroke()

          // Core pass
          ctx.beginPath()
          ctx.arc(stroke.cx, stroke.cy, stroke.r, stroke.startAngle, visibleEnd)
          ctx.strokeStyle = stroke.color
          ctx.lineWidth = stroke.lineWidth
          ctx.shadowBlur = 0
          ctx.stroke()
        }
      }

      ctx.restore()
    }
  }

  renderScreen(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.screenFlashAlpha <= 0) return
    ctx.save()
    ctx.globalAlpha = this.screenFlashAlpha
    ctx.fillStyle = `rgb(${this.screenFlashColor})`
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  spawnHitSpark(x: number, y: number, hitAngle: number): void {
    const count = 6
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, T.ember, 2 + Math.random() * 2, 80 + Math.random() * 80, {
        dirAngle: hitAngle,
        spread:   0.7,
        sizeDecay: 8,
        life:     0.15 + Math.random() * 0.1,
      }))
    }
  }

  spawnBloodSplatter(x: number, y: number, killAngle: number, archetype: ZombieArchetype): void {
    const counts: Record<ZombieArchetype, number> = {
      regular: 12, fast: 8, tank: 20, armored: 14, boss: 40,
    }
    const count = counts[archetype] ?? 12
    for (let i = 0; i < count; i++) {
      const backward = Math.random() < 0.2
      const angle = backward ? killAngle + Math.PI : killAngle
      this.particles.push(new Particle(x, y, T.blood, 2 + Math.random() * 4, 60 + Math.random() * 120, {
        dirAngle: angle,
        spread:   backward ? Math.PI : 1.05,
        gravity:  30,
        sizeDecay: 4,
        life:     0.3 + Math.random() * 0.3,
      }))
    }
    if (archetype === 'boss') {
      // Extra rust-colored particles
      for (let i = 0; i < 10; i++) {
        this.particles.push(new Particle(x, y, T.rust, 3 + Math.random() * 4, 80 + Math.random() * 100, {
          dirAngle: killAngle,
          spread:   Math.PI,
          gravity:  20,
          life:     0.5 + Math.random() * 0.3,
        }))
      }
      this.spawnRadialBurst(x, y)
    }
  }

  spawnRadialBurst(x: number, y: number): void {
    const count = 20
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      this.particles.push(new Particle(x, y, T.amber, 3, 150, {
        dirAngle: angle,
        spread:   0.05,
        life:     0.5,
      }))
    }
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2
      this.particles.push(new Particle(x, y, T.ember, 2, 220, {
        dirAngle: angle,
        spread:   0.05,
        life:     0.4,
      }))
    }
  }

  spawnFireTrail(x: number, y: number, angle: number): void {
    const backAngle = angle + Math.PI
    for (let i = 0; i < 3; i++) {
      const spread = (Math.random() - 0.5) * 0.6
      const spd = 20 + Math.random() * 40
      const color = Math.random() < 0.5 ? '#FF6820' : '#FF4400'
      this.particles.push(new Particle(x, y, color, 2 + Math.random() * 3, spd, {
        dirAngle: backAngle + spread,
        spread: 0,
        sizeDecay: 14,
        life: 0.1 + Math.random() * 0.08,
      }))
    }
  }

  spawnLightningChain(points: { x: number; y: number }[]): void {
    const chains: LightningSegment[][] = []

    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i], b = points[i + 1]
      const dx = b.x - a.x, dy = b.y - a.y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < 1) continue

      // Perpendicular direction for random offsets
      const px = -dy / len, py = dx / len

      const steps = 8 + Math.floor(Math.random() * 5)
      const chain: LightningSegment[] = []

      // Build zigzag midpoints
      const midpoints: { x: number; y: number }[] = [{ x: a.x, y: a.y }]
      for (let s = 1; s < steps; s++) {
        const t = s / steps
        const mx = a.x + dx * t
        const my = a.y + dy * t
        const offset = (Math.random() - 0.5) * Math.min(len * 0.35, 28)
        midpoints.push({ x: mx + px * offset, y: my + py * offset })
      }
      midpoints.push({ x: b.x, y: b.y })

      for (let s = 0; s + 1 < midpoints.length; s++) {
        chain.push({
          ax: midpoints[s].x, ay: midpoints[s].y,
          bx: midpoints[s + 1].x, by: midpoints[s + 1].y,
        })
      }
      chains.push(chain)

      // Small spark particles at hit point
      for (let k = 0; k < 4; k++) {
        this.particles.push(new Particle(b.x, b.y, '#88eeff', 2 + Math.random() * 2, 60 + Math.random() * 80, {
          dirAngle: Math.random() * Math.PI * 2,
          spread: Math.PI,
          sizeDecay: 20,
          life: 0.08 + Math.random() * 0.08,
        }))
      }
    }

    if (chains.length > 0) {
      this.lightnings.push({ chains, life: 0.18, maxLife: 0.18 })
    }
  }

  // Zombie melee slash at target position
  spawnZombieSlash(x: number, y: number, fromAngle: number, archetype: ZombieArchetype): void {
    const perp = fromAngle + Math.PI / 2  // perpendicular to attack direction

    // Helper: push a crack line stroke
    const crack = (
      x1: number, y1: number, x2: number, y2: number,
      color: string, lw: number, delay: number
    ): SlashStroke => ({
      cx: 0, cy: 0, r: 0, startAngle: 0, endAngle: 0,
      lineWidth: lw, color, delay,
      isCrack: true, crackX1: x1, crackY1: y1, crackX2: x2, crackY2: y2,
    })

    // Helper: offset a point along a direction
    const offset = (ox: number, oy: number, angle: number, dist: number) =>
      [ox + Math.cos(angle) * dist, oy + Math.sin(angle) * dist] as [number, number]

    const strokes: SlashStroke[] = []

    if (archetype === 'regular') {
      // 3 claw marks running along perp (perpendicular to attack direction),
      // spaced 8px apart along fromAngle. Like 3 parallel horizontal scratches
      // when viewed from the zombie's perspective.
      const lineLen = 26
      const fwdOffsets = [-8, 0, 8]
      const widths     = [2.2, 2.8, 2.2]
      for (let i = 0; i < 3; i++) {
        const ox = Math.cos(fromAngle) * fwdOffsets[i]
        const oy = Math.sin(fromAngle) * fwdOffsets[i]
        const [sx, sy] = offset(x + ox, y + oy, perp, -lineLen / 2)
        const [ex, ey] = offset(x + ox, y + oy, perp,  lineLen / 2)
        strokes.push(crack(sx, sy, ex, ey, '#FF5533', widths[i], i * 0.07))
      }

    } else if (archetype === 'fast') {
      // 4 thin claw marks along perp, spaced 8px along fromAngle.
      // Slightly longer and thinner than regular.
      const lineLen    = 28
      const fwdOffsets = [-12, -4, 4, 12]
      const widths     = [1.4, 1.8, 1.8, 1.4]
      for (let i = 0; i < 4; i++) {
        const ox = Math.cos(fromAngle) * fwdOffsets[i]
        const oy = Math.sin(fromAngle) * fwdOffsets[i]
        const [sx, sy] = offset(x + ox, y + oy, perp, -lineLen / 2)
        const [ex, ey] = offset(x + ox, y + oy, perp,  lineLen / 2)
        strokes.push(crack(sx, sy, ex, ey, '#FF8833', widths[i], i * 0.05))
      }

    } else if (archetype === 'tank') {
      // 2 thick claw marks along perp, spaced 8px, plus X cross for brutality.
      const lineLen    = 32
      const fwdOffsets = [-8, 8]
      const widths     = [5.5, 5.0]
      for (let i = 0; i < 2; i++) {
        const ox = Math.cos(fromAngle) * fwdOffsets[i]
        const oy = Math.sin(fromAngle) * fwdOffsets[i]
        const [sx, sy] = offset(x + ox, y + oy, perp, -lineLen / 2)
        const [ex, ey] = offset(x + ox, y + oy, perp,  lineLen / 2)
        strokes.push(crack(sx, sy, ex, ey, i === 0 ? '#BB1100' : '#AA1100', widths[i], i * 0.06))
      }
      // X cross overlay
      const xLen = 36
      for (const [sign, delay] of [[-1, 0.05], [1, 0.09]] as const) {
        const a = fromAngle + sign * 0.62
        const [sx, sy] = offset(x, y, a + Math.PI, xLen * 0.4)
        const [ex, ey] = offset(x, y, a,           xLen * 0.6)
        strokes.push(crack(sx, sy, ex, ey, '#880000', 3.5, delay))
      }

    } else if (archetype === 'armored') {
      // 3 short rigid marks along perp, spaced 8px, plus perpendicular groove.
      const lineLen    = 22
      const fwdOffsets = [-8, 0, 8]
      const widths     = [1.8, 2.4, 1.8]
      for (let i = 0; i < 3; i++) {
        const ox = Math.cos(fromAngle) * fwdOffsets[i]
        const oy = Math.sin(fromAngle) * fwdOffsets[i]
        const [sx, sy] = offset(x + ox, y + oy, perp, -lineLen / 2)
        const [ex, ey] = offset(x + ox, y + oy, perp,  lineLen / 2)
        strokes.push(crack(sx, sy, ex, ey, '#AADDFF', widths[i], i * 0.07))
      }
      // Diagonal ricochet line at ±45°
      const [rx1, ry1] = offset(x, y, fromAngle - 0.78, -20)
      const [rx2, ry2] = offset(x, y, fromAngle - 0.78,  20)
      strokes.push(crack(rx1, ry1, rx2, ry2, '#88BBFF', 1.4, 0.06))

    } else {
      // boss: 5 wide marks along perp, spaced 8px, plus X cross
      const lineLen    = 46
      const fwdOffsets = [-16, -8, 0, 8, 16]
      const widths     = [3.5, 4.5, 5.5, 4.5, 3.5]
      for (let i = 0; i < 5; i++) {
        const ox = Math.cos(fromAngle) * fwdOffsets[i]
        const oy = Math.sin(fromAngle) * fwdOffsets[i]
        const [sx, sy] = offset(x + ox, y + oy, perp, -lineLen / 2)
        const [ex, ey] = offset(x + ox, y + oy, perp,  lineLen / 2)
        strokes.push(crack(sx, sy, ex, ey, '#CC1166', widths[i], i * 0.05))
      }
      // X crack lines
      const xLen = 56
      for (const [sign, delay] of [[-1, 0.12], [1, 0.16]] as const) {
        const a = fromAngle + sign * 0.62
        const [x1, y1] = offset(x, y, a + Math.PI, xLen * 0.42)
        const [x2, y2] = offset(x, y, a,           xLen * 0.58)
        strokes.push(crack(x1, y1, x2, y2, '#3A0018', 3.2, delay))
      }
    }

    // Config per archetype for flash + sparks
    type SparkCfg = { flashR: number; flashC: string; sparkN: number; sparkC: string; spd: [number,number]; slife: [number,number]; glowC: string; life: number }
    const scfg: Record<ZombieArchetype, SparkCfg> = {
      regular: { flashR: 14, flashC: '#FFAA88', sparkN: 6,  sparkC: '#FF6644', spd: [55,130],  slife: [0.10,0.16], glowC: '#FF2200', life: 0.22 },
      fast:    { flashR: 10, flashC: '#FFCC88', sparkN: 8,  sparkC: '#FFAA44', spd: [70,180],  slife: [0.07,0.12], glowC: '#FF5500', life: 0.16 },
      tank:    { flashR: 22, flashC: '#FF8866', sparkN: 5,  sparkC: '#CC3300', spd: [40,90],   slife: [0.16,0.26], glowC: '#660000', life: 0.32 },
      armored: { flashR: 16, flashC: '#DDEEFF', sparkN: 10, sparkC: '#88CCFF', spd: [80,200],  slife: [0.08,0.14], glowC: '#5599FF', life: 0.20 },
      boss:    { flashR: 36, flashC: '#FFAADD', sparkN: 14, sparkC: '#FF88CC', spd: [60,160],  slife: [0.14,0.22], glowC: '#880044', life: 0.38 },
    }
    const sc = scfg[archetype]

    this.slashes.push({
      strokes, life: sc.life, maxLife: sc.life, glowColor: sc.glowC,
      flashRadius: sc.flashR, flashColor: sc.flashC,
      impactX: x, impactY: y,
    })

    // Directional fan sparks spreading away from zombie
    const sparkDir = fromAngle + Math.PI
    for (let i = 0; i < sc.sparkN; i++) {
      const t = sc.sparkN > 1 ? i / (sc.sparkN - 1) : 0.5
      const spreadAngle = (t - 0.5) * (Math.PI * 0.9)
      const speed = sc.spd[0] + Math.random() * (sc.spd[1] - sc.spd[0])
      const life  = sc.slife[0] + Math.random() * (sc.slife[1] - sc.slife[0])
      this.particles.push(new Particle(x, y, sc.sparkC, 1.5 + Math.random() * 1.5, speed, {
        dirAngle: sparkDir + spreadAngle,
        spread: 0.12,
        sizeDecay: 14,
        life,
      }))
    }
    // 3 bright white core sparks
    for (let i = 0; i < 3; i++) {
      this.particles.push(new Particle(x, y, '#FFFFFF', 1.5, 80 + Math.random() * 60, {
        dirAngle: sparkDir + (Math.random() - 0.5) * 0.8,
        spread: 0.0,
        sizeDecay: 20,
        life: 0.06 + Math.random() * 0.04,
      }))
    }
  }

  triggerDamageFlash(): void {
    this.screenFlashAlpha = 0.35
    this.screenFlashColor = '204,26,26'
  }

  triggerExplosionFlash(): void {
    this.screenFlashAlpha = 0.25
    this.screenFlashColor = '255,107,53'
  }

  // Garrison stomp/shockwave debris — colored shards flying outward
  spawnShockwaveDebris(x: number, y: number, color: string): void {
    const count = 10
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
      const spd = 60 + Math.random() * 100
      this.particles.push(new Particle(x, y, color, 2 + Math.random() * 3, spd, {
        dirAngle: angle,
        spread: 0.2,
        gravity: 25,
        sizeDecay: 6,
        life: 0.35 + Math.random() * 0.2,
      }))
    }
    // Small bright core sparks
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2
      this.particles.push(new Particle(x, y, '#FFFFFF', 1.5, 120 + Math.random() * 80, {
        dirAngle: angle,
        spread: Math.PI,
        sizeDecay: 18,
        life: 0.12 + Math.random() * 0.08,
      }))
    }
  }

  // Garrison medic heal — green cross particles rising from target
  spawnHealParticles(x: number, y: number): void {
    const count = 4
    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * 16
      this.particles.push(new Particle(x + offsetX, y, '#44FF88', 3 + Math.random() * 3, 18 + Math.random() * 14, {
        dirAngle: -Math.PI / 2,
        spread: 0.35,
        gravity: -8,
        sizeDecay: 5,
        life: 0.5 + Math.random() * 0.3,
      }))
    }
  }
}
