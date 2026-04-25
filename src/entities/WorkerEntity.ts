import { Tower } from '../towers/Tower'
import { dist, angleTo } from '../utils/math'

export class WorkerEntity {
  x: number
  y: number
  readonly homeNode: Tower
  private target: Tower | null = null
  private state: 'idle' | 'movingOut' | 'repairing' | 'returning' = 'idle'
  private readonly speed = 90
  private readonly repairRate = 15  // HP/s while repairing
  private idleTimer = 0.5
  private walkCycle = Math.random() * Math.PI * 2  // staggered start

  constructor(homeNode: Tower) {
    this.homeNode = homeNode
    this.x = homeNode.x
    this.y = homeNode.y
  }

  update(dt: number, towers: Tower[]): void {
    if (!this.homeNode.alive) return

    if (this.state !== 'idle') this.walkCycle += dt * 8

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

    // Draw tether line back to home when active
    if (this.state !== 'idle') {
      ctx.strokeStyle = 'rgba(192,192,192,0.2)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 5])
      ctx.beginPath()
      ctx.moveTo(this.x, this.y)
      ctx.lineTo(this.homeNode.x, this.homeNode.y)
      ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.translate(this.x, this.y)

    const isMoving = this.state === 'movingOut' || this.state === 'returning'
    const isRepairing = this.state === 'repairing'
    const bob = isMoving ? Math.sin(this.walkCycle) * 1.8 : 0

    // Leg animation when moving
    if (isMoving) {
      const legSwing = Math.sin(this.walkCycle) * 3
      ctx.strokeStyle = '#909090'
      ctx.lineWidth = 1.2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-2, 3 + bob); ctx.lineTo(-3, 7 + legSwing)
      ctx.moveTo(2, 3 + bob);  ctx.lineTo(3, 7 - legSwing)
      ctx.stroke()
    }

    // Body — silver/steel circle
    const bodyColor = isRepairing ? '#E8E8E8' : '#C0C0C0'
    ctx.shadowColor = isRepairing ? '#aaffaa' : '#aaaacc'
    ctx.shadowBlur = isRepairing ? 6 : 3
    ctx.fillStyle = bodyColor
    ctx.strokeStyle = '#707070'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(0, bob, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.shadowBlur = 0

    // Head — small circle on top
    ctx.fillStyle = '#D8D8D8'
    ctx.strokeStyle = '#606060'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(0, -4 + bob, 2.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Repair tool icon — wrench shape (X cross when repairing, small diagonal lines)
    if (isRepairing) {
      ctx.strokeStyle = '#FFCC44'
      ctx.lineWidth = 1.2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-2.5, -2 + bob); ctx.lineTo(2.5, 3 + bob)
      ctx.moveTo(2.5, -2 + bob);  ctx.lineTo(-2.5, 3 + bob)
      ctx.stroke()
    } else {
      // Tool held on side
      ctx.strokeStyle = '#909090'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(-3, 0 + bob); ctx.lineTo(3, 0 + bob)
      ctx.stroke()
    }

    ctx.restore()
  }

  private returnHome(): void {
    this.state = 'returning'
    this.target = null
  }

  private findMostDamaged(towers: Tower[]): Tower | null {
    const range = this.homeNode.profile.range
    let best: Tower | null = null
    let bestRatio = 1.0
    for (const t of towers) {
      if (!t.alive || t === this.homeNode) continue
      if (dist(this.homeNode.x, this.homeNode.y, t.x, t.y) > range) continue
      const ratio = t.hp / t.maxHp
      if (ratio < bestRatio) { bestRatio = ratio; best = t }
    }
    return best
  }
}
