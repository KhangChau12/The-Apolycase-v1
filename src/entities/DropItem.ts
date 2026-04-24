import { ZombieDrops } from './Zombie'

export class DropItem {
  x: number
  y: number
  coins: number
  iron: number
  energyCore: number
  crystal: boolean
  ammo: number
  picked = false
  private lifetime = 20

  // Magnet state — set by Game when item enters attract range
  private magnetVx = 0
  private magnetVy = 0
  private magnetActive = false

  constructor(x: number, y: number, drops: ZombieDrops) {
    this.x = x + (Math.random() - 0.5) * 20
    this.y = y + (Math.random() - 0.5) * 20
    this.coins = drops.coins
    this.iron = drops.iron
    this.energyCore = drops.energyCore
    this.crystal = drops.crystal
    this.ammo = drops.ammo
  }

  attractTo(px: number, py: number): void {
    const dx = px - this.x
    const dy = py - this.y
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < 1) return
    const speed = 320
    this.magnetVx = (dx / d) * speed
    this.magnetVy = (dy / d) * speed
    this.magnetActive = true
  }

  update(dt: number): void {
    if (this.magnetActive) {
      this.x += this.magnetVx * dt
      this.y += this.magnetVy * dt
    }
    this.lifetime -= dt
    if (this.lifetime <= 0) this.picked = true
  }
}
