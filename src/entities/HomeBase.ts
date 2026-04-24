import { dist } from '../utils/math'
import { Zombie } from './Zombie'
import { Tower } from '../towers/Tower'
import { BaseSkillId, BASE_SKILL_POOL } from '../data/baseSkillPool'

interface PlayerRef { x: number; y: number; stats: { hp: number; maxHp: number } }

export class HomeBase {
  readonly x: number
  readonly y: number
  hp: number
  maxHp: number
  regenPerSecond: number

  auraRadius = 260
  auraHealPerSec = 8
  auraDotPerSec = 5
  thornsEnabled = false

  // Base skill system
  appliedBaseSkills: Map<BaseSkillId, number> = new Map()

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

  takeDamage(amount: number, attacker?: { takeDamage(n: number): void }): void {
    this.hp -= amount
    if (this.thornsEnabled && attacker) {
      attacker.takeDamage(amount * 0.3)
    }
  }

  applyBaseSkill(id: BaseSkillId): void {
    const def = BASE_SKILL_POOL.find(s => s.id === id)
    if (!def) return
    const currentStack = (this.appliedBaseSkills.get(id) ?? 0) + 1
    this.appliedBaseSkills.set(id, currentStack)
    def.apply(this, currentStack)
  }

  get isDead(): boolean {
    return this.hp <= 0
  }
}
