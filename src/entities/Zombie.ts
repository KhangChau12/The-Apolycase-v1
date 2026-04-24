import { dist, angleTo, randInt } from '../utils/math'
import { ZOMBIE_TEMPLATES } from '../data/zombieData'

export type ZombieArchetype = 'regular' | 'fast' | 'tank' | 'armored' | 'boss'

export interface ZombieDrops {
  iron: number
  energyCore: number
  coins: number
  crystal: boolean
  ammo: number
}

interface BaseTarget { x: number; y: number; takeDamage(n: number): void }
interface TowerTarget { x: number; y: number; hp: number; alive: boolean; takeDamage(n: number): void }
interface GameRef { shake(i: number, d: number): void }

export class Zombie {
  x: number
  y: number
  hp: number
  maxHp: number
  speed: number
  damage: number
  archetype: ZombieArchetype
  radius: number
  xpReward: number
  alive = true
  auraKill = false   // set by Tower.applyAura when aura DOT delivers killing blow

  private attackCooldown = 0
  private attackRange: number
  private attackRate: number

  constructor(x: number, y: number, archetype: ZombieArchetype, waveMult: number) {
    const t = ZOMBIE_TEMPLATES[archetype]
    this.x = x
    this.y = y
    this.archetype = archetype
    this.hp = Math.floor(t.baseHp * waveMult)
    this.maxHp = this.hp
    this.speed = t.baseSpeed * (0.9 + Math.random() * 0.2)
    this.damage = Math.floor(t.baseDamage * waveMult)
    this.radius = archetype === 'boss' ? 32 : archetype === 'tank' ? 22 : 14
    this.attackRange = this.radius + 40
    this.attackRate = archetype === 'boss' ? 0.8 : archetype === 'tank' ? 1.2 : 1.5
    this.xpReward = archetype === 'boss' ? 200 : archetype === 'tank' ? 40 : archetype === 'armored' ? 30 : 15
  }

  update(dt: number, base: BaseTarget, towers: TowerTarget[], game: GameRef): void {
    if (!this.alive) return
    if (this.attackCooldown > 0) this.attackCooldown -= dt

    // Find nearest tower in path or attack base if close
    const nearTower = this.findNearestTower(towers)
    const distToBase = dist(this.x, this.y, base.x, base.y)

    if (nearTower && dist(this.x, this.y, nearTower.x, nearTower.y) < this.attackRange + 20) {
      if (this.attackCooldown <= 0) {
        nearTower.takeDamage(this.damage)
        this.attackCooldown = 1 / this.attackRate
      }
    } else if (distToBase < this.attackRange) {
      if (this.attackCooldown <= 0) {
        base.takeDamage(this.damage)
        this.attackCooldown = 1 / this.attackRate
        if (this.archetype === 'boss') game.shake(10, 0.3)
      }
    } else {
      const target = nearTower && dist(this.x, this.y, nearTower.x, nearTower.y) < 120
        ? nearTower
        : base
      const angle = angleTo(this.x, this.y, target.x, target.y)
      this.x += Math.cos(angle) * this.speed * dt
      this.y += Math.sin(angle) * this.speed * dt
    }
  }

  private findNearestTower(towers: TowerTarget[]): TowerTarget | null {
    let nearest: TowerTarget | null = null
    let nearestDist = 150
    for (const t of towers) {
      if (!t.alive) continue
      const d = dist(this.x, this.y, t.x, t.y)
      if (d < nearestDist) {
        nearestDist = d
        nearest = t
      }
    }
    return nearest
  }

  takeDamage(amount: number): void {
    const reduced = this.archetype === 'armored' ? Math.floor(amount * 0.5) : amount
    this.hp -= reduced
    if (this.hp <= 0) this.alive = false
  }

  getDrops(): ZombieDrops {
    const t = ZOMBIE_TEMPLATES[this.archetype]
    const ammoRoll = Math.random()
    const ammo = ammoRoll < t.ammoDrop[2]
      ? randInt(t.ammoDrop[0], t.ammoDrop[1])
      : 0
    return {
      iron: randInt(t.ironDrop[0], t.ironDrop[1]),
      energyCore: randInt(t.energyCoreDrop[0], t.energyCoreDrop[1]),
      coins: randInt(t.coinsDrop[0], t.coinsDrop[1]),
      crystal: t.dropsCrystal,
      ammo,
    }
  }
}
