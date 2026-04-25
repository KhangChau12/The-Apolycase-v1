import { InputManager } from '../core/InputManager'
import { Camera } from '../core/Camera'
import { Bullet } from './Bullet'
import { clamp, angleTo } from '../utils/math'
import { WEAPON_PROFILES, WeaponProfile } from '../data/weaponData'
import { PlayerSkillId, PLAYER_SKILL_POOL } from '../data/playerSkillPool'

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

// Per-slot ammo state so each weapon remembers its own ammo
interface WeaponSlot {
  profile: WeaponProfile
  ammoInMag: number
  reserveAmmo: number
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

  // Skill system
  appliedPlayerSkills: Map<PlayerSkillId, number> = new Map()
  bulletCount = 1
  bulletPenetrating = false
  bulletExplosion = false
  fireRateMultiplier = 1.0

  // Weapon inventory — slots preserve per-weapon ammo
  private weaponSlots: WeaponSlot[] = []
  private activeSlotIndex = 0

  private fireCooldown = 0
  private pendingFollowBullet: { angle: number; timer: number; dmg: number } | null = null
  reloading = false
  reloadTimer = 0
  kills = 0

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
    const starter = WEAPON_PROFILES[0]
    this.weaponSlots = [{ profile: starter, ammoInMag: starter.magSize, reserveAmmo: starter.magSize * 3 }]
  }

  // ── Accessors used throughout the codebase ────────────────────────

  get currentWeapon(): WeaponProfile { return this.weaponSlots[this.activeSlotIndex].profile }
  get ammoInMag(): number            { return this.weaponSlots[this.activeSlotIndex].ammoInMag }
  get reserveAmmo(): number          { return this.weaponSlots[this.activeSlotIndex].reserveAmmo }

  set ammoInMag(v: number)   { this.weaponSlots[this.activeSlotIndex].ammoInMag = v }
  set reserveAmmo(v: number) { this.weaponSlots[this.activeSlotIndex].reserveAmmo = v }

  get ownedWeapons(): WeaponSlot[] { return this.weaponSlots }
  get activeWeaponIndex(): number  { return this.activeSlotIndex }

  // ── Update ────────────────────────────────────────────────────────

  update(dt: number, input: InputManager, camera: Camera, game: GameRef): void {
    this.move(dt, input)
    this.updateAim(input, camera, game)
    this.updateFire(dt, input, game)
    this.updateReload(dt, input, game)
    this.updateWeaponSwitch(input, game)
    if (this.invincibleTimer > 0) this.invincibleTimer -= dt

    // Delayed follow bullet for Twin Shot
    if (this.pendingFollowBullet) {
      this.pendingFollowBullet.timer -= dt
      if (this.pendingFollowBullet.timer <= 0) {
        const { angle, dmg } = this.pendingFollowBullet
        const w = this.currentWeapon
        const b = new Bullet(
          this.x + Math.cos(this.angle) * 18,
          this.y + Math.sin(this.angle) * 18,
          angle,
          w.bulletSpeed,
          dmg,
          'player',
        )
        b.isPenetrating = this.bulletPenetrating
        b.isExplosive = this.bulletExplosion
        game.bullets.push(b)
        this.pendingFollowBullet = null
      }
    }
  }

  private updateWeaponSwitch(input: InputManager, game: GameRef): void {
    const count = this.weaponSlots.length
    if (count < 2) return
    for (let i = 0; i < Math.min(count, 9); i++) {
      if (input.consumePress(`Digit${i + 1}`)) {
        this.switchToSlot(i, game.hud)
        return
      }
    }
  }

  switchToSlot(idx: number, hud: { showMessage(msg: string, color?: string): void }): void {
    if (idx < 0 || idx >= this.weaponSlots.length) return
    if (idx === this.activeSlotIndex) return
    this.activeSlotIndex = idx
    this.reloading = false
    this.fireCooldown = 0
    this.pendingFollowBullet = null
    hud.showMessage(this.currentWeapon.label, '#E8A030')
  }

  // ── Private update methods ────────────────────────────────────────

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
    const basePellets = w.class === 'shotgun' ? 8 : 1

    for (let i = 0; i < basePellets; i++) {
      const spread = (Math.random() - 0.5) * (w.spread * Math.PI / 180)
      const angle = this.angle + spread
      const dmg = this.calcDamage()
      const b = new Bullet(
        this.x + Math.cos(this.angle) * 18,
        this.y + Math.sin(this.angle) * 18,
        angle,
        w.bulletSpeed,
        dmg,
        'player',
      )
      b.isPenetrating = this.bulletPenetrating
      b.isExplosive = this.bulletExplosion
      game.bullets.push(b)

      // Twin Shot: queue a follow-up bullet with 0.08s delay, same trajectory
      if (this.bulletCount >= 2 && i === 0) {
        this.pendingFollowBullet = { angle, timer: 0.08, dmg: this.calcDamage() }
      }
    }

    this.ammoInMag--
    this.fireCooldown = 1 / (w.fireRate * this.fireRateMultiplier)
  }

  private updateReload(dt: number, input: InputManager, game: GameRef): void {
    if (input.consumePress('KeyR') && !this.reloading && this.ammoInMag < this.currentWeapon.magSize) {
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

  // ── Public methods ────────────────────────────────────────────────

  takeDamage(amount: number): void {
    if (this.invincibleTimer > 0) return
    const reduced = Math.max(1, amount - this.stats.armor)
    this.stats.hp = Math.max(0, this.stats.hp - reduced)
    this.invincibleTimer = 0.8
  }

  addXp(amount: number, onLevelUp?: () => void): void {
    this.stats.xp += amount
    if (this.stats.xp >= this.stats.xpToNext) {
      this.stats.xp -= this.stats.xpToNext
      this.stats.level++
      this.stats.xpToNext = Math.floor(this.stats.xpToNext * 1.4)
      onLevelUp?.()
    }
  }

  applyLevelUpSkill(id: PlayerSkillId): void {
    const def = PLAYER_SKILL_POOL.find(s => s.id === id)
    if (!def) return
    const currentStack = (this.appliedPlayerSkills.get(id) ?? 0) + 1
    this.appliedPlayerSkills.set(id, currentStack)
    def.apply(this, currentStack)
  }

  // Add weapon to inventory (called when buying) — if already owned, just equip
  addWeapon(profile: WeaponProfile): void {
    const existing = this.weaponSlots.findIndex(s => s.profile.id === profile.id)
    if (existing >= 0) {
      this.activeSlotIndex = existing
      return
    }
    this.weaponSlots.push({ profile, ammoInMag: profile.magSize, reserveAmmo: profile.magSize * 3 })
    this.activeSlotIndex = this.weaponSlots.length - 1
    this.reloading = false
    this.fireCooldown = 0
  }

  // Legacy: direct equip (replaces slot if same profile id exists, else adds)
  equipWeapon(profile: WeaponProfile): void {
    this.addWeapon(profile)
  }

  hasWeapon(id: string): boolean {
    return this.weaponSlots.some(s => s.profile.id === id)
  }
}
