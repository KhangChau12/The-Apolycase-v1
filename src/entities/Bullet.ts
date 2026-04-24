export type BulletOwner = 'player' | 'tower'

export class Bullet {
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  owner: BulletOwner
  alive = true
  radius = 4
  get angle(): number { return Math.atan2(this.vy, this.vx) }
  private lifetime = 2.5

  // Special bullet flags
  isPenetrating = false
  isExplosive = false
  isBurning = false
  burnDps = 0
  isFireball = false
  hitZombies: Set<object> = new Set()  // prevents hitting same zombie twice per pass

  constructor(x: number, y: number, angle: number, speed: number, damage: number, owner: BulletOwner) {
    this.x = x
    this.y = y
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed
    this.damage = damage
    this.owner = owner
  }

  update(dt: number): void {
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.lifetime -= dt
    if (this.lifetime <= 0 || this.x < -100 || this.x > 3100 || this.y < -100 || this.y > 3100) {
      this.alive = false
    }
  }
}
