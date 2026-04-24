export interface ParticleOptions {
  dirAngle?: number   // bias direction (radians); if set, spread is ±spread around this angle
  spread?: number     // spread in radians (default: full circle = Math.PI)
  gravity?: number    // downward acceleration px/s²
  sizeDecay?: number  // size reduction per second
  life?: number       // fixed lifespan in seconds (overrides random)
}

export class Particle {
  x: number
  y: number
  color: string
  size: number
  alpha = 1
  alive = true
  private vx: number
  private vy: number
  private life: number
  private maxLife: number
  private gravity: number
  private sizeDecay: number

  constructor(
    x: number, y: number, color: string, size: number, speed: number,
    opts: ParticleOptions = {}
  ) {
    this.x = x
    this.y = y
    this.color = color
    this.size = size
    this.gravity   = opts.gravity   ?? 0
    this.sizeDecay = opts.sizeDecay ?? 0

    const spread = opts.spread ?? Math.PI
    const baseAngle = opts.dirAngle ?? (Math.random() * Math.PI * 2)
    const angle = baseAngle + (Math.random() * 2 - 1) * spread
    const spd = (0.4 + Math.random() * 0.6) * speed
    this.vx = Math.cos(angle) * spd
    this.vy = Math.sin(angle) * spd

    this.life    = opts.life ?? (0.3 + Math.random() * 0.3)
    this.maxLife = this.life
  }

  update(dt: number): void {
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.vx *= 0.9
    this.vy  = this.vy * 0.9 + this.gravity * dt
    this.size = Math.max(0.5, this.size - this.sizeDecay * dt)
    this.life -= dt
    this.alpha = Math.max(0, this.life / this.maxLife)
    if (this.life <= 0) this.alive = false
  }
}
