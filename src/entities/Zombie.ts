import { dist, angleTo, randInt } from '../utils/math'
import { ZOMBIE_TEMPLATES, ZOMBIE_TIER_SCALING } from '../data/zombieData'
import {
  ANIMATION_CLIPS, WINDUP_DURATIONS, COMBO_DAMAGE_MULT,
  type AnimationState, type AnimationFrame,
} from '../data/zombieAnimationData'

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
interface GameRef {
  shake(i: number, d: number): void
  spawnZombieSlash(x: number, y: number, fromAngle: number, archetype: ZombieArchetype): void
}

export class Zombie {
  x: number
  y: number
  hp: number
  maxHp: number
  speed: number
  damage: number
  archetype: ZombieArchetype
  tier: number
  radius: number
  xpReward: number
  alive = true
  auraKill = false   // set by Tower.applyAura when aura DOT delivers killing blow
  angle = 0          // movement direction in radians, used for polygon rotation
  burnTimer = 0
  burnDps = 0
  slowFactor = 0        // fraction of speed reduction (0 = none, 0.6 = 60% slower); reset each frame by HomeBase
  stunTimer = 0         // seconds remaining stunned

  // Visual-only state — read by renderer, no game logic impact
  attackFlashTimer = 0  // red slash effect when attacking (0.12s)
  attackAnimTimer  = 0  // drives 'attack' animState, longer window (0.3s)
  wobbleTimer      = 0  // accumulated movement time for walk cycle

  // Animation state machine
  animState: AnimationState = 'idle'
  frameIndex = 0
  frameTimer = 0
  currentFrame: AnimationFrame

  // Combo attack
  comboCounter = 0    // 0-2 index into COMBO_DAMAGE_MULT

  // Wind-up
  windupActive = false
  windupTimer  = 0
  windupMax    = 0    // cached from WINDUP_DURATIONS for renderer pct

  // Hit recoil
  hitRecoilTimer = 0

  private attackCooldown = 0
  private attackRange: number
  private attackRate: number
  private damageReduction: number

  constructor(x: number, y: number, archetype: ZombieArchetype, waveMult: number, tier = 0) {
    const t = ZOMBIE_TEMPLATES[archetype]
    const tierScale = ZOMBIE_TIER_SCALING[archetype]
    const appliedTier = Math.max(0, Math.floor(tier))
    this.x = x
    this.y = y
    this.archetype = archetype
    this.tier = archetype === 'boss' ? 0 : appliedTier
    this.hp = Math.floor(t.baseHp * waveMult * (1 + tierScale.hpPerTier * this.tier))
    this.maxHp = this.hp
    this.speed = t.baseSpeed * (0.9 + Math.random() * 0.2) * (1 + tierScale.speedPerTier * this.tier)
    this.damage = Math.floor(t.baseDamage * waveMult * (1 + tierScale.damagePerTier * this.tier))
    const baseRadius = archetype === 'boss' ? 32 : archetype === 'tank' ? 22 : 14
    this.radius = baseRadius * (1 + tierScale.sizePerTier * this.tier)
    this.attackRange = this.radius + 40
    this.attackRate = archetype === 'boss' ? 0.8 : archetype === 'tank' ? 1.2 : 1.5
    const baseXp = archetype === 'boss' ? 200 : archetype === 'tank' ? 40 : archetype === 'armored' ? 30 : 15
    this.xpReward = Math.floor(baseXp * (1 + tierScale.xpPerTier * this.tier))
    const armoredBaseReduction = archetype === 'armored' ? 0.5 : 0
    this.damageReduction = Math.min(0.85, armoredBaseReduction + tierScale.armorBonusPerTier * this.tier)
    this.windupMax = WINDUP_DURATIONS[archetype]
    // Init currentFrame to idle frame 0
    this.currentFrame = ANIMATION_CLIPS[archetype].idle.frames[0]
  }

  update(dt: number, base: BaseTarget, towers: TowerTarget[], game: GameRef): void {
    if (!this.alive) return
    if (this.attackFlashTimer > 0) this.attackFlashTimer -= dt
    if (this.attackAnimTimer  > 0) this.attackAnimTimer  -= dt
    if (this.hitRecoilTimer   > 0) this.hitRecoilTimer   -= dt

    // Stun — skip movement and attacks while stunned
    if (this.stunTimer > 0) {
      this.stunTimer -= dt
      this.slowFactor = 0
      this.updateAnimation(dt, false)
      return
    }

    const effectiveSpeed = this.speed * (1 - this.slowFactor)
    this.slowFactor = 0  // reset each frame; HomeBase re-applies next frame if still in aura

    // Advance attack cooldown
    if (this.attackCooldown > 0) this.attackCooldown -= dt

    // Find nearest tower in path or attack base if close
    const nearTower = this.findNearestTower(towers)
    const distToBase = dist(this.x, this.y, base.x, base.y)

    let moving = false

    if (nearTower && dist(this.x, this.y, nearTower.x, nearTower.y) < this.attackRange + 20) {
      this.handleAttack(dt, nearTower, game)
    } else if (distToBase < this.attackRange) {
      this.handleAttack(dt, base, game)
    } else {
      const target = nearTower && dist(this.x, this.y, nearTower.x, nearTower.y) < 120
        ? nearTower
        : base
      this.angle = angleTo(this.x, this.y, target.x, target.y)
      this.x += Math.cos(this.angle) * effectiveSpeed * dt
      this.y += Math.sin(this.angle) * effectiveSpeed * dt
      this.wobbleTimer += dt
      moving = true
    }

    this.updateAnimation(dt, moving)
  }

  private handleAttack(dt: number, target: BaseTarget | TowerTarget, game: GameRef): void {
    // Phase 1: start wind-up when cooldown expired
    if (this.attackCooldown <= 0 && !this.windupActive) {
      this.windupActive = true
      this.windupTimer  = this.windupMax
    }

    // Phase 2: count down wind-up then deal damage
    if (this.windupActive) {
      this.windupTimer -= dt
      if (this.windupTimer <= 0) {
        this.windupActive = false
        const mult = COMBO_DAMAGE_MULT[this.comboCounter % COMBO_DAMAGE_MULT.length]
        target.takeDamage(Math.floor(this.damage * mult))
        this.comboCounter = (this.comboCounter + 1) % COMBO_DAMAGE_MULT.length
        this.attackCooldown = 1 / this.attackRate
        this.attackFlashTimer = 0.12
        this.attackAnimTimer  = 0.30
        game.spawnZombieSlash(target.x, target.y, this.angle, this.archetype)
        if (this.archetype === 'boss') game.shake(10, 0.3)
      }
    }
  }

  private updateAnimation(dt: number, moving: boolean): void {
    // Determine target state
    let nextState: AnimationState
    if (this.stunTimer > 0) {
      nextState = 'stun'
    } else if (this.windupActive) {
      nextState = 'windup'
    } else if (this.attackAnimTimer > 0) {
      nextState = 'attack'
    } else if (moving) {
      nextState = 'walk'
    } else {
      nextState = 'idle'
    }

    // Reset frame index on state transition
    if (nextState !== this.animState) {
      this.animState = nextState
      this.frameIndex = 0
      this.frameTimer = 0
    }

    const clip = ANIMATION_CLIPS[this.archetype][this.animState]
    const frame = clip.frames[this.frameIndex % clip.frames.length]

    this.frameTimer += dt
    if (this.frameTimer >= frame.duration) {
      this.frameTimer -= frame.duration
      if (clip.loopable) {
        this.frameIndex = (this.frameIndex + 1) % clip.frames.length
      } else {
        this.frameIndex = Math.min(this.frameIndex + 1, clip.frames.length - 1)
      }
    }

    this.currentFrame = clip.frames[this.frameIndex % clip.frames.length]
  }

  stun(duration: number): void {
    this.stunTimer = Math.max(this.stunTimer, duration)
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
    const reduced = this.damageReduction > 0
      ? Math.max(1, Math.floor(amount * (1 - this.damageReduction)))
      : amount
    this.hp -= reduced
    this.hitRecoilTimer = 0.1
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
