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
  lifesteal: number       // fraction of damage dealt restored as HP
  dodgeChance: number     // chance to fully negate an incoming hit
  reloadSpeedMult: number // multiplier on reload time (>1 = faster)
  xpMult: number          // multiplier on XP gained
  dropBonus: number       // additive bonus to resource drop rate
}

interface GameRef {
  bullets: Bullet[]
  screenW: number
  screenH: number
  shake(intensity: number, duration: number): void
  hud: { showMessage(msg: string, color?: string, duration?: number): void }
  audio?: { playGunshot(c: string): void; playDryFire(): void; playReload(c: string): void }
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
    lifesteal: 0,
    dodgeChance: 0,
    reloadSpeedMult: 1,
    xpMult: 1,
    dropBonus: 0,
  }

  // Skill flags
  appliedPlayerSkills: Map<PlayerSkillId, number> = new Map()
  bulletCount = 1
  bulletPenetrating = false
  bulletExplosion = false
  fireRateMultiplier = 1.0
  lastStandEnabled = false
  berserkerEnabled = false
  overchargeEnabled = false
  phantomRoundEnabled = false
  deathMarkEnabled = false

  // Berserker runtime state
  berserkerStacks = 0
  berserkerTimer = 0

  // Overcharge: true right after a reload finishes
  private overchargeReady = false

  // v1.7 skill flags
  acidCoatingEnabled = false
  acidCoatingStacks = 0
  kineticStrikeEnabled = false
  kineticHitStreak = 0
  kineticLastTarget: object | null = null
  ricochetEnabled = false
  focusedFireEnabled = false
  focusedFireStacks = 0
  focusedFireMaxStacks = 10
  private focusedLastAngle = 0
  executionerEnabled = false
  executionerReady = false
  executionerTimer = 0

  // Sniper hold-breath: charge while mouse held, bonus shot at 0.4s
  holdBreathTimer = 0
  holdBreathReady = false
  private static readonly HOLD_BREATH_CHARGE = 0.4

  // MP5 run-and-gun: true when player moved this frame
  isMoving = false

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

  // Effective speed accounting for Last Stand bonus and sniper hold-breath penalty
  get effectiveSpeed(): number {
    let base = this.stats.speed
    if (this.lastStandEnabled && this.stats.hp < this.stats.maxHp * 0.25) base += 30
    if (this.currentWeapon.class === 'sniperRifle' && this.holdBreathTimer > 0) base *= 0.3
    return base
  }

  // ── Update ────────────────────────────────────────────────────────

  update(dt: number, input: InputManager, camera: Camera, game: GameRef): void {
    this.move(dt, input)
    this.updateAim(input, camera, game)
    this.updateFire(dt, input, game)
    this.updateReload(dt, input, game)
    this.updateWeaponSwitch(input, game)
    this.updateBerserker(dt)
    this.updateExecutioner(dt)
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
        b.weaponClass = w.class
        game.bullets.push(b)
        game.shake(w.shakeIntensity, w.shakeDuration)
        this.pendingFollowBullet = null
      }
    }
  }

  private updateBerserker(dt: number): void {
    if (!this.berserkerEnabled || this.berserkerStacks === 0) return
    this.berserkerTimer -= dt
    if (this.berserkerTimer <= 0) this.berserkerStacks = 0
  }

  private updateExecutioner(dt: number): void {
    if (!this.executionerEnabled || !this.executionerReady) return
    this.executionerTimer -= dt
    if (this.executionerTimer <= 0) {
      this.executionerReady = false
      this.executionerTimer = 0
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
    this.isMoving = len > 0
    if (len > 0) {
      dx /= len; dy /= len
    }
    this.x = clamp(this.x + dx * this.effectiveSpeed * dt, 20, 2980)
    this.y = clamp(this.y + dy * this.effectiveSpeed * dt, 20, 2980)
  }

  private updateAim(input: InputManager, camera: Camera, game: GameRef): void {
    void game
    const world = camera.toWorld(input.mouse.x, input.mouse.y)
    this.angle = angleTo(this.x, this.y, world.x, world.y)
  }

  private updateFire(dt: number, input: InputManager, game: GameRef): void {
    if (this.fireCooldown > 0) this.fireCooldown -= dt

    const w = this.currentWeapon

    // Sniper hold-breath: accumulate while mouse held (even during fire cooldown)
    if (w.class === 'sniperRifle') {
      if (input.mouse.down && !this.reloading && this.ammoInMag > 0) {
        this.holdBreathTimer = Math.min(this.holdBreathTimer + dt, Player.HOLD_BREATH_CHARGE)
        this.holdBreathReady = this.holdBreathTimer >= Player.HOLD_BREATH_CHARGE
      } else if (!input.mouse.down) {
        this.holdBreathTimer = 0
        this.holdBreathReady = false
      }
    } else {
      this.holdBreathTimer = 0
      this.holdBreathReady = false
    }

    if (this.fireCooldown > 0) return
    if (!input.mouse.down || this.reloading) return
    if (this.ammoInMag <= 0) {
      this.startReload(game)
      return
    }

    const basePellets = w.class === 'shotgun' ? 8 : 1

    // Focused Fire: track consecutive angle
    if (this.focusedFireEnabled) {
      const angleDiff = Math.abs(((this.angle - this.focusedLastAngle) + Math.PI) % (2 * Math.PI) - Math.PI)
      if (angleDiff < 0.087) { // ~5 degrees
        this.focusedFireStacks = Math.min(this.focusedFireStacks + 1, this.focusedFireMaxStacks)
      } else {
        this.focusedFireStacks = 0
      }
      this.focusedLastAngle = this.angle
    }

    // Sniper hold-breath bonus: perfect shot on full charge
    const sniperPerfect = w.class === 'sniperRifle' && this.holdBreathReady
    const spreadDeg = sniperPerfect ? 0 : w.spread

    for (let i = 0; i < basePellets; i++) {
      const spread = (Math.random() - 0.5) * (spreadDeg * Math.PI / 180)
      const angle = this.angle + spread
      let dmg = this.calcDamage()
      if (sniperPerfect) dmg = Math.floor(dmg * 1.5)
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
      b.weaponClass = w.class
      b.lifesteal = this.stats.lifesteal
      b.deathMark = this.deathMarkEnabled
      b.canRicochet = this.ricochetEnabled
      if (w.class === 'shotgun') b.knockback = 20
      // Grenade launcher bullets always explode
      if (w.class === 'grenadeLauncher') {
        b.isExplosive = true
        b.splashFraction = 0.55
        b.splashRadius = 70
        b.radius = 8
      }
      game.bullets.push(b)

      // Twin Shot: queue a follow-up bullet with 0.08s delay, same trajectory
      if (this.bulletCount >= 2 && i === 0) {
        this.pendingFollowBullet = { angle, timer: 0.08, dmg: this.calcDamage() }
      }
    }

    // Phantom Round: 20% chance to not consume ammo
    if (!this.phantomRoundEnabled || Math.random() >= 0.2) {
      this.ammoInMag--
    }

    this.overchargeReady = false
    // Reset sniper hold-breath after firing
    if (w.class === 'sniperRifle') {
      this.holdBreathTimer = 0
      this.holdBreathReady = false
    }
    game.shake(w.shakeIntensity, w.shakeDuration)
    game.audio?.playGunshot(w.class)
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
      game.audio?.playDryFire()
      return
    }
    this.reloading = true
    this.reloadTimer = this.currentWeapon.reloadTime / this.stats.reloadSpeedMult
    game.audio?.playReload(this.currentWeapon.class)
  }

  private finishReload(): void {
    const needed = this.currentWeapon.magSize - this.ammoInMag
    const refill = Math.min(needed, this.reserveAmmo)
    this.ammoInMag += refill
    this.reserveAmmo -= refill
    this.reloading = false
    if (this.overchargeEnabled) this.overchargeReady = true
  }

  private calcDamage(): number {
    let base = this.stats.damage

    // Last Stand: +40% damage below 25% HP
    if (this.lastStandEnabled && this.stats.hp < this.stats.maxHp * 0.25) {
      base = Math.floor(base * 1.4)
    }

    // Berserker: each recent kill adds +5% damage (max +50%)
    if (this.berserkerEnabled && this.berserkerStacks > 0) {
      base = Math.floor(base * (1 + Math.min(this.berserkerStacks, 10) * 0.05))
    }

    // Overcharge: double damage on first shot after reload
    if (this.overchargeEnabled && this.overchargeReady) {
      base *= 2
    }

    // Focused Fire: +4% per consecutive shot in same direction
    if (this.focusedFireEnabled && this.focusedFireStacks > 0) {
      base = Math.floor(base * (1 + this.focusedFireStacks * 0.04))
    }

    // Executioner: triple damage on next shot after execute
    if (this.executionerEnabled && this.executionerReady) {
      base *= 3
      this.executionerReady = false
      this.executionerTimer = 0
    }

    // MP5 run-and-gun: +15% damage while moving (mobile suppressor archetype)
    if (this.currentWeapon.id === 'smg_mp5' && this.isMoving) {
      base = Math.floor(base * 1.15)
    }

    const crit = Math.random() < this.stats.critChance
    return crit ? Math.floor(base * 2) : base
  }

  // ── Public methods ────────────────────────────────────────────────

  takeDamage(amount: number): void {
    if (this.invincibleTimer > 0) return
    // Dodge chance: skip the hit entirely
    if (this.stats.dodgeChance > 0 && Math.random() < this.stats.dodgeChance) return
    const reduced = Math.max(1, amount - this.stats.armor)
    this.stats.hp = Math.max(0, this.stats.hp - reduced)
    this.invincibleTimer = 0.8
  }

  // Called by the game when a bullet this player fired hits a zombie
  onBulletHit(damageDealt: number, target?: object): void {
    if (this.stats.lifesteal > 0) {
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + damageDealt * this.stats.lifesteal)
    }

    // Kinetic Strike: 8 consecutive hits on same target → stun 0.6s
    if (this.kineticStrikeEnabled && target) {
      if (target === this.kineticLastTarget) {
        this.kineticHitStreak++
      } else {
        this.kineticHitStreak = 1
        this.kineticLastTarget = target
      }
      if (this.kineticHitStreak >= 10) {
        this.kineticHitStreak = 0
        // The stun is applied by Game.ts after calling onBulletHit — returns a flag
        this._kineticStunPending = true
      }
    }
  }

  // Consumed by Game.ts in bullet hit handler
  _kineticStunPending = false

  // Called by Game.ts before onZombieDead when kill was below 30% HP
  triggerExecutioner(): void {
    if (!this.executionerEnabled) return
    this.executionerReady = true
    this.executionerTimer = 2
  }

  // Called when player kills a zombie
  onKill(): void {
    this.kills++
    if (this.berserkerEnabled) {
      this.berserkerStacks = Math.min(this.berserkerStacks + 1, 10)
      this.berserkerTimer = 3
    }
  }

  addXp(amount: number, onLevelUp?: () => void): void {
    this.stats.xp += Math.floor(amount * this.stats.xpMult)
    if (this.stats.xp >= this.stats.xpToNext) {
      this.stats.xp -= this.stats.xpToNext
      this.stats.level++
      this.stats.xpToNext = Math.floor(this.stats.xpToNext * 1.3)
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
