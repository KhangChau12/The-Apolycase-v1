import { TowerProfile } from './TowerTypes'
import { Zombie } from '../entities/Zombie'
import { Bullet } from '../entities/Bullet'
import { dist, angleTo } from '../utils/math'

interface BaseRef { x: number; y: number; hp: number; maxHp: number; takeDamage(n: number): void }
interface EffectsRef {
  spawnLightningChain(points: { x: number; y: number }[]): void
  spawnRadialBurst(x: number, y: number): void
}

export class Tower {
  x: number
  y: number
  hp: number
  level = 1
  alive = true
  spawnTime = 0

  // Aura bonuses — set each frame by HomeBase.applyAura()
  auraDamageBonus = 0
  auraRangeBonus = 0
  auraFireRateBonus = 0

  // Tech upgrade flags — set each frame by HomeBase.applyAura()
  fireTowerOverdriveActive = false
  electricOverloadActive = false
  machineGunOverdriveActive = false
  fireTowerInfernoActive = false
  electricEMPActive = false
  machineGunAPActive = false
  neuralNetworkActive = false

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
      case 'fireTower':       this.updateFireTower(zombies, bullets, effects); break
      case 'electricTower':   this.updateElectricTower(zombies, effects); break
      case 'machineGunTower': this.updateMachineGun(zombies, bullets); break
      case 'repairTower':     break
      case 'barricade':       break
    }
  }

  private effectiveDamage(base: number): number {
    return base * (1 + this.auraDamageBonus)
  }

  private effectiveRange(base: number): number {
    return base * (1 + this.auraRangeBonus)
  }

  private effectiveFireRate(base: number): number {
    return base * (1 + this.auraFireRateBonus)
  }

  private updateFireTower(zombies: Zombie[], bullets: Bullet[], _effects?: EffectsRef): void {
    if (this.fireCooldown > 0) return
    const target = this.findNearest(zombies, this.effectiveRange(this.profile.range))
    if (!target) return
    const angle = angleTo(this.x, this.y, target.x, target.y)

    // Overdrive: fire rate 1.5 → 2.0/s
    const fireRate = this.fireTowerOverdriveActive
      ? 2.0 * (1 + this.auraFireRateBonus)
      : this.effectiveFireRate(this.profile.fireRate)

    const dmg = this.effectiveDamage(this.profile.damage * this.level)
    const burnDps = (this.profile.burnDps ?? 8) * this.level * (this.fireTowerOverdriveActive ? 1.5 : 1)

    const fireball = new Bullet(this.x, this.y, angle, 180, dmg, 'tower')
    fireball.isFireball = true
    fireball.isBurning = true
    fireball.burnDps = burnDps
    fireball.radius = 16

    // Inferno: explosion on impact
    if (this.fireTowerInfernoActive) {
      fireball.isExplosive = true
      fireball.splashFraction = 0.3
      fireball.splashRadius = 40
    }

    bullets.push(fireball)
    this.fireCooldown = 1 / fireRate
  }

  private updateElectricTower(zombies: Zombie[], effects?: EffectsRef): void {
    if (this.fireCooldown > 0) return
    const range = this.effectiveRange(this.profile.range)
    const inRange = zombies.filter(z => z.alive && dist(this.x, this.y, z.x, z.y) < range)
    if (inRange.length === 0) return
    inRange.sort((a, b) => dist(this.x, this.y, a.x, a.y) - dist(this.x, this.y, b.x, b.y))

    // Overload: +2 chain targets
    const baseChain = this.profile.chainCount ?? 4
    const chainCount = Math.min(inRange.length, this.electricOverloadActive ? baseChain + 2 : baseChain)

    // Overload: +20% damage
    const dmgMult = this.electricOverloadActive ? 1.2 : 1.0
    const baseDmg = this.effectiveDamage(this.profile.damage * this.level) * dmgMult
    const scaledDamage = Math.min(
      baseDmg * (1 + inRange.length * 0.08),
      baseDmg * 2.5,
    )

    const chainPoints: { x: number; y: number }[] = [{ x: this.x, y: this.y }]
    for (let i = 0; i < chainCount; i++) {
      const z = inRange[i]
      z.takeDamage(scaledDamage)
      chainPoints.push({ x: z.x, y: z.y })

      // EMP: stun nearby zombies when a kill happens
      if (!z.alive && this.electricEMPActive) {
        const empRadius = 120
        for (const ez of zombies) {
          if (!ez.alive || ez === z) continue
          if (dist(z.x, z.y, ez.x, ez.y) < empRadius) ez.stun(0.8)
        }
        effects?.spawnRadialBurst(z.x, z.y)
      }
    }
    effects?.spawnLightningChain(chainPoints)
    this.fireCooldown = 1 / this.effectiveFireRate(this.profile.fireRate)
  }

  private updateMachineGun(zombies: Zombie[], bullets: Bullet[]): void {
    if (this.fireCooldown > 0) return
    const target = this.findNearest(zombies, this.effectiveRange(this.profile.range))
    if (!target) return
    const angle = angleTo(this.x, this.y, target.x, target.y)

    // Overdrive: +30% fire rate
    const fireRate = this.machineGunOverdriveActive
      ? this.profile.fireRate * 1.3 * (1 + this.auraFireRateBonus)
      : this.effectiveFireRate(this.profile.fireRate)

    const dmg = this.effectiveDamage(this.profile.damage * this.level)
    const b = new Bullet(this.x, this.y, angle, 700, dmg, 'tower')

    // Overdrive: slow on hit
    if (this.machineGunOverdriveActive) b.machineGunSlow = true

    // AP Rounds: flag for armor pierce (read in Game bullet collision)
    if (this.machineGunAPActive) b.armorPiercing = true

    bullets.push(b)
    this.fireCooldown = 1 / fireRate
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
    // Fortress Protocol: +100% max HP inside aura
    return this.profile.hp * this.level
  }
}
