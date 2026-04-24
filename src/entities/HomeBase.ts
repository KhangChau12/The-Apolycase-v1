import { dist } from '../utils/math'
import { Zombie } from './Zombie'
import { Tower } from '../towers/Tower'

interface PlayerRef { x: number; y: number; stats: { hp: number; maxHp: number } }

export class HomeBase {
  readonly x: number
  readonly y: number
  hp: number
  maxHp: number
  regenPerSecond: number

  // Aura config — scales with base upgrade level (future shop)
  auraRadius = 260
  auraHealPerSec = 8      // HP/s restored to towers and player inside aura
  auraDotPerSec = 5       // damage/s dealt to zombies inside aura

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
    this.maxHp = 1000
    this.hp = 1000
    this.regenPerSecond = 2
  }

  update(dt: number): void {
    // passive self-regen
    this.hp = Math.min(this.maxHp, this.hp + this.regenPerSecond * dt)
  }

  applyAura(dt: number, zombies: Zombie[], towers: Tower[], player: PlayerRef): void {
    const dot  = this.auraDotPerSec  * dt
    const heal = this.auraHealPerSec * dt

    // DOT to zombies in aura
    for (const z of zombies) {
      if (!z.alive) continue
      if (dist(this.x, this.y, z.x, z.y) < this.auraRadius) {
        z.takeDamage(dot)
        if (!z.alive) z.auraKill = true
      }
    }

    // Heal allied towers in aura
    for (const t of towers) {
      if (!t.alive) continue
      if (dist(this.x, this.y, t.x, t.y) < this.auraRadius) {
        t.hp = Math.min(t.maxHp, t.hp + heal)
      }
    }

    // Heal player in aura
    if (dist(this.x, this.y, player.x, player.y) < this.auraRadius) {
      player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal * 0.5)
    }
  }

  takeDamage(amount: number): void {
    this.hp -= amount
  }

  get isDead(): boolean {
    return this.hp <= 0
  }
}
