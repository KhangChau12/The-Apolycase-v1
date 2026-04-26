import { Tower } from '../towers/Tower'
import { dist, angleTo } from '../utils/math'
import type { HomeBase } from './HomeBase'
import type { Zombie } from './Zombie'

export class WorkerEntity {
  x: number
  y: number
  readonly homeNode: Tower
  private target: Tower | null = null
  private attackTarget: Zombie | null = null
  private state: 'idle' | 'movingOut' | 'repairing' | 'returning' | 'patrolAttack' = 'idle'
  private readonly baseSpeed = 90
  private readonly baseRepairRate = 15
  private idleTimer = 0.5
  private attackCooldown = 0
  private walkCycle = Math.random() * Math.PI * 2

  constructor(homeNode: Tower) {
    this.homeNode = homeNode
    this.x = homeNode.x
    this.y = homeNode.y
  }

  update(dt: number, towers: Tower[], base: HomeBase, zombies?: Zombie[]): void {
    if (!this.homeNode.alive) return

    const speed = base.repairDroneUpgradeEnabled ? this.baseSpeed * 1.4 : this.baseSpeed
    const repairRate = base.repairDroneUpgradeEnabled ? this.baseRepairRate * 1.5 : this.baseRepairRate

    if (this.state !== 'idle') this.walkCycle += dt * 8
    if (this.attackCooldown > 0) this.attackCooldown -= dt

    // Fortress Protocol: workers become attack drones
    if (base.fortressProtocolEnabled && zombies) {
      this.updateAttackDrone(dt, speed, zombies)
      return
    }

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
          this.x += Math.cos(a) * speed * dt
          this.y += Math.sin(a) * speed * dt
        }
        break
      }
      case 'repairing': {
        if (!this.target?.alive) { this.returnHome(); break }
        this.target.hp = Math.min(this.target.maxHp, this.target.hp + repairRate * dt)
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
          this.x += Math.cos(a) * speed * dt
          this.y += Math.sin(a) * speed * dt
        }
        break
      }
      case 'patrolAttack': {
        // only reached if fortressProtocol was just toggled off mid-state, fall back
        this.state = 'idle'
        break
      }
    }
  }

  private updateAttackDrone(dt: number, speed: number, zombies: Zombie[]): void {
    this.state = 'patrolAttack'

    // Validate current attack target
    if (this.attackTarget && (!this.attackTarget.alive || dist(this.x, this.y, this.attackTarget.x, this.attackTarget.y) > 120)) {
      this.attackTarget = null
    }

    // Find nearest zombie within 80px
    if (!this.attackTarget) {
      let best: Zombie | null = null
      let bestDist = 80
      for (const z of zombies) {
        if (!z.alive) continue
        const d = dist(this.x, this.y, z.x, z.y)
        if (d < bestDist) { bestDist = d; best = z }
      }
      this.attackTarget = best
    }

    if (this.attackTarget) {
      const d = dist(this.x, this.y, this.attackTarget.x, this.attackTarget.y)
      const a = angleTo(this.x, this.y, this.attackTarget.x, this.attackTarget.y)
      if (d > 55) {
        this.x += Math.cos(a) * speed * dt
        this.y += Math.sin(a) * speed * dt
      } else if (this.attackCooldown <= 0) {
        this.attackTarget.takeDamage(5 * dt * 20)  // 5 DPS → ~5 per 0.05s tick equiv
        this.attackCooldown = 0.2
      }
    } else {
      // Patrol: orbit homeNode
      const angle = Math.atan2(this.y - this.homeNode.y, this.x - this.homeNode.x) + dt * 0.8
      const orbitR = 45
      const tx = this.homeNode.x + Math.cos(angle) * orbitR
      const ty = this.homeNode.y + Math.sin(angle) * orbitR
      const a = angleTo(this.x, this.y, tx, ty)
      this.x += Math.cos(a) * speed * dt
      this.y += Math.sin(a) * speed * dt
    }

    this.walkCycle += dt * 8
  }

  render(ctx: CanvasRenderingContext2D, isAttackDrone = false): void {
    if (!this.homeNode.alive) return
    ctx.save()

    // Tether line back to home when active (not in attack drone mode)
    if (this.state !== 'idle' && !isAttackDrone) {
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

    const isMoving = this.state === 'movingOut' || this.state === 'returning' || this.state === 'patrolAttack'
    const isRepairing = this.state === 'repairing'
    const bob = isMoving ? Math.sin(this.walkCycle) * 1.8 : 0

    if (isAttackDrone) {
      // Attack drone: reddish tint diamond shape
      ctx.shadowColor = '#FF4400'
      ctx.shadowBlur = 5
      ctx.fillStyle = '#CC3300'
      ctx.strokeStyle = '#FF6644'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, -6 + bob)
      ctx.lineTo(5, bob)
      ctx.lineTo(0, 6 + bob)
      ctx.lineTo(-5, bob)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.restore()
      return
    }

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

    // Repair tool icon
    if (isRepairing) {
      ctx.strokeStyle = '#FFCC44'
      ctx.lineWidth = 1.2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-2.5, -2 + bob); ctx.lineTo(2.5, 3 + bob)
      ctx.moveTo(2.5, -2 + bob);  ctx.lineTo(-2.5, 3 + bob)
      ctx.stroke()
    } else {
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
