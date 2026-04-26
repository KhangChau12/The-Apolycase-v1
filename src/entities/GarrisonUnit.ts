import { dist, angleTo } from '../utils/math'
import { GarrisonUnitType, GarrisonProfile } from '../data/garrisonData'
import type { Zombie } from './Zombie'
import type { Tower } from '../towers/Tower'
import type { HomeBase } from './HomeBase'

interface PlayerRef { x: number; y: number; stats: { hp: number; maxHp: number } }

// Pending soldier bullet — consumed by Game.ts to spawn actual Bullet objects
export interface PendingSoldierBullet {
  x: number; y: number
  angle: number        // radians toward target
  angle2: number       // second barrel offset (+6°)
}

// Pending stomp splash — consumed by Game.ts for AOE damage
export interface PendingStompSplash {
  x: number; y: number
  radius: number
  damage: number
  slowAmount: number   // 0 if no slow
  isPrimary?: boolean  // titan distinguishes primary vs splash
  primaryTarget?: Zombie | null
  primaryDamage?: number
}

// Pending heal particle — consumed by Game.ts for visual effect
export interface PendingHealParticle {
  x: number; y: number
}

export class GarrisonUnit {
  x: number
  y: number
  hp: number
  readonly maxHp: number
  readonly type: GarrisonUnitType
  readonly profile: GarrisonProfile
  readonly damage: number
  alive = true
  angle = 0

  respawnTimer = 0
  hasRespawned = false

  // --- Animation state (read by Game.ts for rendering) ---
  attackFlashTimer = 0          // >0 = glow burst on unit
  stompPulseTimer = 0           // >0 = expanding ring after stomp
  stompPulseMax = 0.25          // duration of stomp ring

  // Titan wind-up
  titanWindupTimer = 0
  titanWindupActive = false
  titanWindupMax = 0.4

  // Medic aura phase (increases over time for sin-based pulse)
  healAuraTimer = 0

  // --- Pending outputs consumed by Game.ts ---
  pendingSoldierBullets: PendingSoldierBullet[] = []
  pendingStompSplash: PendingStompSplash | null = null
  pendingHealParticle: PendingHealParticle | null = null

  // Legacy compat — titan splash still populated for backward compat
  titanSplashPending: { x: number; y: number; dmg: number } | null = null

  private target: Zombie | null = null
  private attackCooldown = 0

  // Soldier burst queue
  private burstQueue: { remaining: number; intervalTimer: number; angle: number } | null = null

  constructor(
    x: number,
    y: number,
    type: GarrisonUnitType,
    profile: GarrisonProfile,
    hpMult: number,
    damageMult: number,
  ) {
    this.x = x
    this.y = y
    this.type = type
    this.profile = profile
    this.maxHp = Math.round(profile.hp * hpMult)
    this.hp = this.maxHp
    this.damage = profile.damage * damageMult
  }

  update(
    dt: number,
    zombies: Zombie[],
    towers: Tower[],
    player: PlayerRef,
    base: HomeBase,
  ): void {
    if (!this.alive) return

    // Tick timers
    if (this.attackCooldown > 0) this.attackCooldown -= dt
    if (this.attackFlashTimer > 0) this.attackFlashTimer -= dt
    if (this.stompPulseTimer > 0) this.stompPulseTimer -= dt
    this.healAuraTimer += dt

    if (this.type === 'medic') {
      this.updateMedic(dt, towers, player, base)
    } else if (this.type === 'titan') {
      this.updateTitan(dt, zombies)
    } else {
      this.updateCombat(dt, zombies, base)
    }

    // Heavy slow field: passively slow nearby zombies
    if (this.type === 'heavy' && base.heavySlowFieldEnabled) {
      for (const z of zombies) {
        if (!z.alive) continue
        if (dist(this.x, this.y, z.x, z.y) < 120) {
          z.slowFactor = Math.max(z.slowFactor, 0.25)
        }
      }
    }
  }

  private updateCombat(dt: number, zombies: Zombie[], _base: HomeBase): void {
    // Tick soldier burst queue
    if (this.type === 'soldier' && this.burstQueue) {
      this.burstQueue.intervalTimer -= dt
      if (this.burstQueue.intervalTimer <= 0) {
        this._fireSoldierBurst(this.burstQueue.angle)
        this.burstQueue.remaining--
        if (this.burstQueue.remaining <= 0) {
          this.burstQueue = null
        } else {
          this.burstQueue.intervalTimer = 0.04
        }
      }
      // During burst, still move/face target but skip attack trigger
      this._moveTowardTarget(dt)
      return
    }

    // Validate existing target
    if (this.target && (!this.target.alive || dist(this.x, this.y, this.target.x, this.target.y) > this.profile.attackRange * 2.5)) {
      this.target = null
    }
    if (!this.target) {
      this.target = this.findNearestZombie(zombies, 300)
    }
    if (!this.target) return

    this.angle = angleTo(this.x, this.y, this.target.x, this.target.y)
    const d = dist(this.x, this.y, this.target.x, this.target.y)

    if (this.type === 'soldier') {
      // Soldier keeps range — stops when close enough
      if (d > this.profile.attackRange * 0.8) {
        const spd = this.profile.speed * dt
        this.x += Math.cos(this.angle) * spd
        this.y += Math.sin(this.angle) * spd
      }
      if (d <= this.profile.attackRange && this.attackCooldown <= 0) {
        // Start burst of 3
        this.attackCooldown = 1 / this.profile.attackRate
        this.attackFlashTimer = 0.12
        this.burstQueue = { remaining: 3, intervalTimer: 0, angle: this.angle }
      }
    } else if (this.type === 'heavy') {
      if (d > this.profile.attackRange) {
        const spd = this.profile.speed * dt
        this.x += Math.cos(this.angle) * spd
        this.y += Math.sin(this.angle) * spd
      } else {
        if (this.attackCooldown <= 0) {
          // Stomp AOE from self position
          const attackDmg = this.damage / this.profile.attackRate
          this.pendingStompSplash = {
            x: this.x,
            y: this.y,
            radius: 80,
            damage: attackDmg,
            slowAmount: 0.5,
          }
          this.attackCooldown = 1 / this.profile.attackRate
          this.attackFlashTimer = 0.15
          this.stompPulseTimer = this.stompPulseMax
        }
      }
    }
  }

  private _moveTowardTarget(dt: number): void {
    if (!this.target || !this.target.alive) return
    const d = dist(this.x, this.y, this.target.x, this.target.y)
    if (d > this.profile.attackRange * 0.8) {
      const spd = this.profile.speed * dt
      this.x += Math.cos(this.angle) * spd
      this.y += Math.sin(this.angle) * spd
    }
  }

  private _fireSoldierBurst(baseAngle: number): void {
    const offset = 0.105 // ~6°
    this.pendingSoldierBullets.push({
      x: this.x,
      y: this.y,
      angle: baseAngle - offset,
      angle2: baseAngle + offset,
    })
  }

  private updateTitan(dt: number, zombies: Zombie[]): void {
    // Validate target
    if (this.target && (!this.target.alive || dist(this.x, this.y, this.target.x, this.target.y) > this.profile.attackRange * 3)) {
      this.target = null
    }
    if (!this.target) {
      this.target = this.findNearestZombie(zombies, 400)
    }
    if (!this.target) return

    this.angle = angleTo(this.x, this.y, this.target.x, this.target.y)
    const d = dist(this.x, this.y, this.target.x, this.target.y)

    if (d > this.profile.attackRange) {
      if (!this.titanWindupActive) {
        const spd = this.profile.speed * dt
        this.x += Math.cos(this.angle) * spd
        this.y += Math.sin(this.angle) * spd
      }
    } else {
      if (this.attackCooldown <= 0 && !this.titanWindupActive) {
        // Start wind-up
        this.titanWindupActive = true
        this.titanWindupTimer = this.titanWindupMax
        this.attackFlashTimer = 0.05
      }
    }

    // Wind-up countdown
    if (this.titanWindupActive) {
      this.titanWindupTimer -= dt
      if (this.titanWindupTimer <= 0) {
        this.titanWindupActive = false
        this._fireTitanStomp()
        this.attackCooldown = 1 / this.profile.attackRate
        this.stompPulseTimer = this.stompPulseMax * 1.5
        this.attackFlashTimer = 0.3
      }
    }
  }

  private _fireTitanStomp(): void {
    const attackDmg = this.damage / this.profile.attackRate
    const splashR = this.profile.splashRadius ?? 120

    // primary target full damage
    this.pendingStompSplash = {
      x: this.x,
      y: this.y,
      radius: splashR,
      damage: attackDmg,
      slowAmount: 0,
      isPrimary: true,
      primaryTarget: this.target,
      primaryDamage: attackDmg,
    }

    // Legacy compat
    if (this.target) {
      this.titanSplashPending = { x: this.x, y: this.y, dmg: attackDmg * 0.6 }
    }
  }

  private updateMedic(dt: number, towers: Tower[], player: PlayerRef, base: HomeBase): void {
    const healPerSec = base.medicHealUpEnabled ? 20 : 8

    let bestTarget: Tower | PlayerRef | null = null
    let lowestHpPct = 0.95

    for (const t of towers) {
      if (!t.alive) continue
      const d = dist(this.x, this.y, t.x, t.y)
      if (d > this.profile.attackRange) continue
      const pct = t.hp / t.maxHp
      if (pct < lowestHpPct) { lowestHpPct = pct; bestTarget = t }
    }

    const playerDist = dist(this.x, this.y, player.x, player.y)
    if (playerDist < this.profile.attackRange) {
      const playerPct = player.stats.hp / player.stats.maxHp
      if (playerPct < lowestHpPct) { bestTarget = player }
    }

    if (bestTarget) {
      const healAmt = healPerSec * dt
      let targetX = 0, targetY = 0
      if ('maxHp' in bestTarget && 'level' in bestTarget) {
        const t = bestTarget as Tower
        t.hp = Math.min(t.maxHp, t.hp + healAmt)
        targetX = t.x; targetY = t.y
      } else {
        const p = bestTarget as PlayerRef
        p.stats.hp = Math.min(p.stats.maxHp, p.stats.hp + healAmt)
        targetX = p.x; targetY = p.y
      }
      // Occasionally emit heal particles (roughly every 0.3s)
      if (Math.floor(this.healAuraTimer / 0.3) !== Math.floor((this.healAuraTimer - dt) / 0.3)) {
        this.pendingHealParticle = { x: targetX, y: targetY }
      }
    } else {
      // Move toward base center when idle
      const cx = base.x, cy = base.y
      const d = dist(this.x, this.y, cx, cy)
      if (d > 80) {
        const a = angleTo(this.x, this.y, cx, cy)
        this.x += Math.cos(a) * this.profile.speed * dt
        this.y += Math.sin(a) * this.profile.speed * dt
        this.angle = a
      }
    }

    if (base.medicHealUpEnabled) {
      base.hp = Math.min(base.maxHp, base.hp + 3 * dt)
    }
  }

  private findNearestZombie(zombies: Zombie[], maxRange: number): Zombie | null {
    let best: Zombie | null = null
    let bestDist = maxRange
    for (const z of zombies) {
      if (!z.alive) continue
      const d = dist(this.x, this.y, z.x, z.y)
      if (d < bestDist) { bestDist = d; best = z }
    }
    return best
  }

  takeDamage(amount: number, base: HomeBase): void {
    const reduction = base.garrisonArmoredEnabled ? 0.8 : 1.0
    this.hp -= amount * reduction
    if (this.hp <= 0) {
      this.hp = 0
      this.alive = false
    }
  }
}
