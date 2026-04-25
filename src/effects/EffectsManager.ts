import { Particle } from './Particle'
import { T } from '../ui/theme'

type ZombieArchetype = 'regular' | 'fast' | 'tank' | 'armored' | 'boss'

interface LightningSegment { ax: number; ay: number; bx: number; by: number }

interface LightningEffect {
  chains: LightningSegment[][]
  life: number
  maxLife: number
}

export class EffectsManager {
  private particles: Particle[] = []
  private lightnings: LightningEffect[] = []
  private screenFlashAlpha = 0
  private screenFlashColor = '204,26,26'

  update(dt: number): void {
    for (const p of this.particles) p.update(dt)
    this.particles = this.particles.filter(p => p.alive)
    if (this.particles.length > 400) this.particles.splice(0, 40)
    for (const l of this.lightnings) l.life -= dt
    this.lightnings = this.lightnings.filter(l => l.life > 0)
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

  triggerDamageFlash(): void {
    this.screenFlashAlpha = 0.35
    this.screenFlashColor = '204,26,26'
  }

  triggerExplosionFlash(): void {
    this.screenFlashAlpha = 0.25
    this.screenFlashColor = '255,107,53'
  }
}
