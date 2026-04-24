import { Tower } from '../towers/Tower'
import { dist, angleTo } from '../utils/math'

export class WorkerEntity {
  x: number
  y: number
  readonly homeNode: Tower
  private target: Tower | null = null
  private state: 'idle' | 'movingOut' | 'repairing' | 'returning' = 'idle'
  private readonly speed = 60
  private readonly repairRate = 8   // HP/s while repairing
  private idleTimer = 0.5           // small delay before looking for a new target

  constructor(homeNode: Tower) {
    this.homeNode = homeNode
    this.x = homeNode.x
    this.y = homeNode.y
  }

  update(dt: number, towers: Tower[]): void {
    if (!this.homeNode.alive) return

    switch (this.state) {
      case 'idle': {
        this.idleTimer -= dt
        if (this.idleTimer > 0) break
        this.target = this.findMostDamaged(towers)
        if (this.target) this.state = 'movingOut'
        else this.idleTimer = 0.5
        break
      }
      case 'movingOut': {
        if (!this.target?.alive) { this.returnHome(); break }
        const d = dist(this.x, this.y, this.target.x, this.target.y)
        if (d < 8) {
          this.state = 'repairing'
        } else {
          const a = angleTo(this.x, this.y, this.target.x, this.target.y)
          this.x += Math.cos(a) * this.speed * dt
          this.y += Math.sin(a) * this.speed * dt
        }
        break
      }
      case 'repairing': {
        if (!this.target?.alive) { this.returnHome(); break }
        this.target.hp = Math.min(this.target.maxHp, this.target.hp + this.repairRate * dt)
        if (this.target.hp >= this.target.maxHp) this.returnHome()
        break
      }
      case 'returning': {
        const d = dist(this.x, this.y, this.homeNode.x, this.homeNode.y)
        if (d < 8) {
          this.x = this.homeNode.x
          this.y = this.homeNode.y
          this.target = null
          this.state = 'idle'
          this.idleTimer = 0.5
        } else {
          const a = angleTo(this.x, this.y, this.homeNode.x, this.homeNode.y)
          this.x += Math.cos(a) * this.speed * dt
          this.y += Math.sin(a) * this.speed * dt
        }
        break
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.homeNode.alive) return
    ctx.save()
    ctx.translate(this.x, this.y)

    // Draw line back to home when moving/repairing
    if (this.state !== 'idle') {
      ctx.strokeStyle = 'rgba(76,175,80,0.3)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(this.homeNode.x - this.x, this.homeNode.y - this.y)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Worker body — small green circle
    ctx.fillStyle = this.state === 'repairing' ? '#88ff88' : '#4CAF50'
    ctx.strokeStyle = '#1a3a1a'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(0, 0, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Wrench icon cross
    ctx.strokeStyle = '#1a3a1a'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(-3, 0); ctx.lineTo(3, 0)
    ctx.moveTo(0, -3); ctx.lineTo(0, 3)
    ctx.stroke()

    ctx.restore()
  }

  private returnHome(): void {
    this.state = 'returning'
    this.target = null
  }

  private findMostDamaged(towers: Tower[]): Tower | null {
    const range = this.homeNode.profile.range
    let best: Tower | null = null
    let bestRatio = 1.0   // only target towers that are actually damaged
    for (const t of towers) {
      if (!t.alive || t === this.homeNode) continue
      if (dist(this.homeNode.x, this.homeNode.y, t.x, t.y) > range) continue
      const ratio = t.hp / t.maxHp
      if (ratio < bestRatio) { bestRatio = ratio; best = t }
    }
    return best
  }
}
