import { Particle } from './Particle'
import { T } from '../ui/theme'

type ZombieArchetype = 'regular' | 'fast' | 'tank' | 'armored' | 'boss'

export class EffectsManager {
  private particles: Particle[] = []
  private screenFlashAlpha = 0
  private screenFlashColor = '204,26,26'

  update(dt: number): void {
    for (const p of this.particles) p.update(dt)
    this.particles = this.particles.filter(p => p.alive)
    // Safety cap
    if (this.particles.length > 400) this.particles.splice(0, 40)
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

  spawnLightningChain(points: { x: number; y: number }[]): void {
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i], b = points[i + 1]
      const steps = 6
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const cx = a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 20
        const cy = a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 20
        this.particles.push(new Particle(cx, cy, '#88eeff', 2 + Math.random() * 2, 0, {
          dirAngle: 0,
          spread: Math.PI * 2,
          sizeDecay: 12,
          life: 0.1 + Math.random() * 0.1,
        }))
      }
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
