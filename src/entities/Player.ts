import { InputManager } from '../core/InputManager'
import { Camera } from '../core/Camera'
import { Bullet } from './Bullet'
import { clamp, angleTo } from '../utils/math'
import { WEAPON_PROFILES, WeaponProfile } from '../data/weaponData'

export interface PlayerStats {
  maxHp: number
  hp: number
  armor: number
  speed: number
  damage: number
  critChance: number
  pickupRange: number
  level: number
  xp: number
  xpToNext: number
}

interface GameRef {
  bullets: Bullet[]
  screenW: number
  screenH: number
  shake(intensity: number, duration: number): void
  hud: { showMessage(msg: string, color?: string, duration?: number): void }
}

export class Player {
  x: number
  y: number
  angle = 0
  invincibleTimer = 0

  stats: PlayerStats = {
    maxHp: 100,
    hp: 100,
    armor: 0,
    speed: 200,
    damage: 10,
    critChance: 0.05,
    pickupRange: 80,
    level: 1,
    xp: 0,
    xpToNext: 100,
  }

  currentWeapon: WeaponProfile
  ammoInMag: number
  reserveAmmo: number
  private fireCooldown = 0
  reloading = false
  reloadTimer = 0
  kills = 0

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
    this.currentWeapon = WEAPON_PROFILES[0]
    this.ammoInMag = this.currentWeapon.magSize
    this.reserveAmmo = this.currentWeapon.magSize * 3
  }

  update(dt: number, input: InputManager, camera: Camera, game: GameRef): void {
    this.move(dt, input)
    this.updateAim(input, camera, game)
    this.updateFire(dt, input, game)
    this.updateReload(dt, input, game)
    if (this.invincibleTimer > 0) this.invincibleTimer -= dt
  }

  private move(dt: number, input: InputManager): void {
    let dx = 0, dy = 0
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) dy -= 1
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) dy += 1
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx -= 1
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx += 1
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len > 0) {
      dx /= len; dy /= len
    }
    this.x = clamp(this.x + dx * this.stats.speed * dt, 20, 2980)
    this.y = clamp(this.y + dy * this.stats.speed * dt, 20, 2980)
  }

  private updateAim(input: InputManager, camera: Camera, game: GameRef): void {
    const world = camera.toWorld(input.mouse.x, input.mouse.y)
    void game
    this.angle = angleTo(this.x, this.y, world.x, world.y)
  }

  private updateFire(dt: number, input: InputManager, game: GameRef): void {
    if (this.fireCooldown > 0) { this.fireCooldown -= dt; return }
    if (!input.mouse.down || this.reloading) return
    if (this.ammoInMag <= 0) {
      this.startReload(game)
      return
    }

    const w = this.currentWeapon
    const pellets = w.class === 'shotgun' ? 8 : 1

    for (let i = 0; i < pellets; i++) {
      const spread = (Math.random() - 0.5) * (w.spread * Math.PI / 180)
      const angle = this.angle + spread
      const dmg = this.calcDamage()
      game.bullets.push(new Bullet(
        this.x + Math.cos(this.angle) * 18,
        this.y + Math.sin(this.angle) * 18,
        angle,
        w.bulletSpeed,
        dmg,
        'player'
      ))
    }

    this.ammoInMag--
    this.fireCooldown = 1 / w.fireRate
  }

  private updateReload(dt: number, input: InputManager, game: GameRef): void {
    if (input.isDown('KeyR') && !this.reloading && this.ammoInMag < this.currentWeapon.magSize) {
      this.startReload(game)
    }
    if (this.reloading) {
      this.reloadTimer -= dt
      if (this.reloadTimer <= 0) {
        this.finishReload()
      }
    }
  }

  private startReload(game: GameRef): void {
    if (this.reserveAmmo <= 0) {
      game.hud.showMessage('No ammo!', '#f88')
      return
    }
    this.reloading = true
    this.reloadTimer = this.currentWeapon.reloadTime
  }

  private finishReload(): void {
    const needed = this.currentWeapon.magSize - this.ammoInMag
    const refill = Math.min(needed, this.reserveAmmo)
    this.ammoInMag += refill
    this.reserveAmmo -= refill
    this.reloading = false
  }

  private calcDamage(): number {
    const base = this.stats.damage
    const crit = Math.random() < this.stats.critChance
    return crit ? Math.floor(base * 2) : base
  }

  takeDamage(amount: number): void {
    if (this.invincibleTimer > 0) return
    const reduced = Math.max(1, amount - this.stats.armor)
    this.stats.hp = Math.max(0, this.stats.hp - reduced)
    this.invincibleTimer = 0.8
  }

  addXp(amount: number): void {
    this.stats.xp += amount
    while (this.stats.xp >= this.stats.xpToNext) {
      this.stats.xp -= this.stats.xpToNext
      this.stats.level++
      this.stats.xpToNext = Math.floor(this.stats.xpToNext * 1.4)
      this.stats.maxHp += 10
      this.stats.hp = Math.min(this.stats.hp + 20, this.stats.maxHp)
      this.stats.damage += 2
    }
  }

  equipWeapon(profile: WeaponProfile): void {
    this.currentWeapon = profile
    this.ammoInMag = profile.magSize
    this.reserveAmmo = profile.magSize * 3
    this.reloading = false
    this.fireCooldown = 0
  }
}
