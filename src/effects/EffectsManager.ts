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
}

interface SlashEffect {
  strokes: SlashStroke[]
  life: number
  maxLife: number
  glowColor: string
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

    // Slash marks — static arc strokes that fade out
    for (const slash of this.slashes) {
      const t = slash.life / slash.maxLife          // 1→0 as it fades
      const alpha = t * t                           // quadratic fade (sharp start, quick fade)

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.lineCap = 'round'

      for (const stroke of slash.strokes) {
        // Glow pass
        ctx.beginPath()
        ctx.arc(stroke.cx, stroke.cy, stroke.r, stroke.startAngle, stroke.endAngle)
        ctx.strokeStyle = slash.glowColor
        ctx.lineWidth = stroke.lineWidth * 3.5
        ctx.shadowColor = slash.glowColor
        ctx.shadowBlur = 10
        ctx.stroke()

        // Core pass
        ctx.beginPath()
        ctx.arc(stroke.cx, stroke.cy, stroke.r, stroke.startAngle, stroke.endAngle)
        ctx.strokeStyle = stroke.color
        ctx.lineWidth = stroke.lineWidth
        ctx.shadowBlur = 0
        ctx.stroke()
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

  // Zombie melee slash at target position — arc-based scratch marks
  spawnZombieSlash(x: number, y: number, fromAngle: number, archetype: ZombieArchetype): void {
    // Direction the slash faces: perpendicular to attack angle, so claw marks sweep sideways
    const sweepDir = fromAngle + Math.PI / 2

    type Cfg = { count: number; color: string; glowColor: string; arcR: number; arcSpan: number; lineWidth: number; spacing: number; life: number }
    const configs: Record<ZombieArchetype, Cfg> = {
      regular: { count: 3, color: '#FF5533', glowColor: '#FF2200', arcR: 18, arcSpan: 1.1, lineWidth: 2.5, spacing: 5,  life: 0.22 },
      fast:    { count: 4, color: '#FF7722', glowColor: '#FF4400', arcR: 14, arcSpan: 1.4, lineWidth: 2.0, spacing: 4,  life: 0.18 },
      tank:    { count: 2, color: '#CC1100', glowColor: '#880000', arcR: 28, arcSpan: 0.8, lineWidth: 4.5, spacing: 8,  life: 0.28 },
      armored: { count: 3, color: '#88CCFF', glowColor: '#4488FF', arcR: 20, arcSpan: 1.0, lineWidth: 2.5, spacing: 6,  life: 0.22 },
      boss:    { count: 5, color: '#FF2200', glowColor: '#CC0000', arcR: 34, arcSpan: 1.3, lineWidth: 3.5, spacing: 7,  life: 0.32 },
    }
    const cfg = configs[archetype]

    // Each scratch is an arc centered slightly away from hit point,
    // so the arc sweeps across the target surface like a claw drag.
    // Arc center is offset perpendicular to fromAngle, strokes stacked along fromAngle direction.
    const strokes: SlashStroke[] = []
    for (let i = 0; i < cfg.count; i++) {
      // Offset each claw line perpendicular to attack direction
      const perpOffset = (i - (cfg.count - 1) / 2) * cfg.spacing
      const cx = x + Math.cos(sweepDir) * perpOffset
      const cy = y + Math.sin(sweepDir) * perpOffset

      // Arc center is pulled back so the arc curves nicely across the target
      const pullBack = cfg.arcR * 0.6
      const arcCx = cx - Math.cos(fromAngle) * pullBack
      const arcCy = cy - Math.sin(fromAngle) * pullBack

      // Arc spans centered around the attack direction
      const midAngle = fromAngle
      strokes.push({
        cx: arcCx,
        cy: arcCy,
        r: cfg.arcR,
        startAngle: midAngle - cfg.arcSpan / 2,
        endAngle:   midAngle + cfg.arcSpan / 2,
        lineWidth:  cfg.lineWidth - i * 0.15,   // taper outer strokes slightly
        color: cfg.color,
      })
    }

    this.slashes.push({ strokes, life: cfg.life, maxLife: cfg.life, glowColor: cfg.glowColor })

    // Small impact sparks at center (kept, but fewer)
    for (let i = 0; i < 4; i++) {
      this.particles.push(new Particle(x, y, cfg.color, 2, 50 + Math.random() * 50, {
        dirAngle: fromAngle + Math.PI + (Math.random() - 0.5) * 1.2,
        spread: 0.2,
        sizeDecay: 18,
        life: 0.10 + Math.random() * 0.06,
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
