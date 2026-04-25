import { TowerProfile } from './TowerTypes'
import { Zombie } from '../entities/Zombie'
import { Bullet } from '../entities/Bullet'
import { dist, angleTo } from '../utils/math'

interface BaseRef { x: number; y: number; hp: number; maxHp: number; takeDamage(n: number): void }
interface EffectsRef { spawnLightningChain(points: { x: number; y: number }[]): void }

export class Tower {
  x: number
  y: number
  hp: number
  level = 1
  alive = true
  private fireCooldown = 0

  constructor(
    x: number,
    y: number,
    public profile: TowerProfile,
  ) {
    this.x = x
    this.y = y
    this.hp = profile.hp
  }

  update(dt: number, zombies: Zombie[], _base: BaseRef, bullets: Bullet[], effects?: EffectsRef): void {
    if (!this.alive) return
    if (this.fireCooldown > 0) this.fireCooldown -= dt

    switch (this.profile.type) {
      case 'fireTower':       this.updateFireTower(zombies, bullets); break
      case 'electricTower':   this.updateElectricTower(zombies, effects); break
      case 'machineGunTower': this.updateMachineGun(zombies, bullets); break
      case 'repairTower':     break   // handled by WorkerEntity
      case 'barricade':       break
    }
  }

  private updateFireTower(zombies: Zombie[], bullets: Bullet[]): void {
    if (this.fireCooldown > 0) return
    const target = this.findNearest(zombies, this.profile.range)
    if (!target) return
    const angle = angleTo(this.x, this.y, target.x, target.y)
    const fireball = new Bullet(this.x, this.y, angle, 180, this.profile.damage * this.level, 'tower')
    fireball.isFireball = true
    fireball.isBurning = true
    fireball.burnDps = (this.profile.burnDps ?? 8) * this.level
    fireball.radius = 16
    bullets.push(fireball)
    this.fireCooldown = 1 / this.profile.fireRate
  }

  private updateElectricTower(zombies: Zombie[], effects?: EffectsRef): void {
    if (this.fireCooldown > 0) return
    const inRange = zombies.filter(z => z.alive && dist(this.x, this.y, z.x, z.y) < this.profile.range)
    if (inRange.length === 0) return
    inRange.sort((a, b) => dist(this.x, this.y, a.x, a.y) - dist(this.x, this.y, b.x, b.y))
    const chainCount = Math.min(inRange.length, this.profile.chainCount ?? 4)
    const scaledDamage = Math.min(
      this.profile.damage * this.level * (1 + inRange.length * 0.08),
      this.profile.damage * this.level * 2.5,
    )
    const chainPoints: { x: number; y: number }[] = [{ x: this.x, y: this.y }]
    for (let i = 0; i < chainCount; i++) {
      inRange[i].takeDamage(scaledDamage)
      chainPoints.push({ x: inRange[i].x, y: inRange[i].y })
    }
    effects?.spawnLightningChain(chainPoints)
    this.fireCooldown = 1 / this.profile.fireRate
  }

  private updateMachineGun(zombies: Zombie[], bullets: Bullet[]): void {
    if (this.fireCooldown > 0) return
    const target = this.findNearest(zombies, this.profile.range)
    if (!target) return
    const angle = angleTo(this.x, this.y, target.x, target.y)
    bullets.push(new Bullet(this.x, this.y, angle, 700, this.profile.damage * this.level, 'tower'))
    this.fireCooldown = 1 / this.profile.fireRate
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
