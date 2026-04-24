import { TowerProfile } from './TowerTypes'
import { Zombie } from '../entities/Zombie'
import { Bullet } from '../entities/Bullet'
import { SkillManager } from '../systems/SkillManager'
import { dist, angleTo } from '../utils/math'

interface BaseRef { x: number; y: number; hp: number; maxHp: number; takeDamage(n: number): void }

export class Tower {
  x: number
  y: number
  hp: number
  level = 1
  alive = true
  private fireCooldown = 0
  private repairTimer = 0

  constructor(
    x: number,
    y: number,
    public profile: TowerProfile,
  ) {
    this.x = x
    this.y = y
    this.hp = profile.hp
  }

  update(dt: number, zombies: Zombie[], base: BaseRef, bullets: Bullet[], skills: SkillManager): void {
    if (!this.alive) return

    const fireRateBonus = skills.has('towerLink') ? 1.15 : 1.0
    if (this.fireCooldown > 0) this.fireCooldown -= dt

    switch (this.profile.type) {
      case 'guard':      this.updateGuard(zombies, bullets, fireRateBonus); break
      case 'shockPylon': this.updateShockPylon(zombies, fireRateBonus); break
      case 'sniperPost': this.updateSniper(zombies, bullets, fireRateBonus); break
      case 'repairNode': this.updateRepair(dt, base); break
      case 'barricade':  break
    }
  }

  private updateGuard(zombies: Zombie[], bullets: Bullet[], fireRateBonus: number): void {
    if (this.fireCooldown > 0) return
    const target = this.findNearest(zombies, this.profile.range)
    if (!target) return
    const angle = angleTo(this.x, this.y, target.x, target.y)
    bullets.push(new Bullet(this.x, this.y, angle, 500, this.profile.damage * this.level, 'tower'))
    this.fireCooldown = 1 / (this.profile.fireRate * fireRateBonus)
  }

  private updateShockPylon(zombies: Zombie[], fireRateBonus: number): void {
    if (this.fireCooldown > 0) return
    for (const z of zombies) {
      if (!z.alive) continue
      if (dist(this.x, this.y, z.x, z.y) < this.profile.range) {
        z.takeDamage(this.profile.damage * this.level)
        z.speed = Math.max(20, z.speed * 0.7)
      }
    }
    this.fireCooldown = 1 / (this.profile.fireRate * fireRateBonus)
  }

  private updateSniper(zombies: Zombie[], bullets: Bullet[], fireRateBonus: number): void {
    if (this.fireCooldown > 0) return
    const target = this.findNearest(zombies, this.profile.range)
    if (!target) return
    const angle = angleTo(this.x, this.y, target.x, target.y)
    bullets.push(new Bullet(this.x, this.y, angle, 900, this.profile.damage * this.level, 'tower'))
    this.fireCooldown = 1 / (this.profile.fireRate * fireRateBonus)
  }

  private updateRepair(dt: number, base: BaseRef): void {
    this.repairTimer += dt
    if (this.repairTimer < 1) return
    this.repairTimer = 0
    base.hp = Math.min(base.maxHp, base.hp + 3 * this.level)
  }

  private findNearest(zombies: Zombie[], range: number): Zombie | null {
    let best: Zombie | null = null
    let bestDist = range
    for (const z of zombies) {
      if (!z.alive) continue
      const d = dist(this.x, this.y, z.x, z.y)
      if (d < bestDist) { bestDist = d; best = z }
    }
    return best
  }

  takeDamage(amount: number): void {
    this.hp -= amount
    if (this.hp <= 0) this.alive = false
  }

  upgrade(): boolean {
    if (this.level >= 3) return false
    this.level++
    this.hp = Math.min(this.hp + this.profile.hp * 0.5, this.profile.hp * this.level)
    return true
  }

  get maxHp(): number {
    return this.profile.hp * this.level
  }
}
