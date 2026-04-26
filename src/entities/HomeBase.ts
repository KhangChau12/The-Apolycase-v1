import { dist } from '../utils/math'
import { Zombie } from './Zombie'
import { Tower } from '../towers/Tower'
import { BaseSkillId } from '../data/baseSkillPool'
import { BASE_SKILL_TREE_MAP } from '../data/baseSkillTree'

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

  slowAuraAmount = 0
  towerDamageAura = 0
  towerRangeAura = 0
  towerFireRateAura = 0
  overlordAuraEnabled = false
  resourceDropBonus = 0

  // Shield pulse
  shieldPulseEnabled = false
  shieldPulseMaxHp = 0
  shieldHp = 0
  shieldPulseCooldown = 15
  private shieldTimer = 0

  // Counter strike
  counterStrikeEnabled = false
  pendingCounterStrike: object | null = null

  // Stun pulse
  stunPulseEnabled = false
  stunPulseCooldownMax = 10
  private stunTimer = 0

  // Active base attacks
  fireboltEnabled = false
  fireboltTimer = 0
  readonly fireboltCooldownMax = 4

  arcDischargeEnabled = false
  arcDischargeTimer = 0
  readonly arcDischargeCooldownMax = 8
  pendingArcDischarge = false

  mortarBarrageEnabled = false
  mortarTimer = 0
  readonly mortarCooldownMax = 15
  pendingMortarBarrage = false

  // Garrison
  garrisonEnabled = false
  garrisonUnitCount = 2
  garrisonHpMult = 1.0
  garrisonDamageMult = 1.0
  garrisonHeavyEnabled = false
  garrisonMedicEnabled = false
  garrisonTitanEnabled = false
  heavySlowFieldEnabled = false
  medicHealUpEnabled = false
  emergencyRespawnEnabled = false
  garrisonArmoredEnabled = false
  warlordCallEnabled = false
  warlordUsedThisWave = false

  // Technology
  fireTowerOverdriveEnabled = false
  electricTowerOverloadEnabled = false
  machineGunOverdriveEnabled = false
  repairDroneUpgradeEnabled = false
  fireTowerInfernoEnabled = false
  electricEMPEnabled = false
  machineGunAPEnabled = false
  synergyEngineEnabled = false
  neuralNetworkEnabled = false
  fortressProtocolEnabled = false

  // Visual animation state (read by renderer each frame, no game logic)
  rotationAngle = 0
  pulseTimer    = 0

  // Divine shield
  divineShieldEnabled = false
  divineShieldCooldownMax = 30
  private divineShieldTimer = 0
  private divineShieldActiveTimer = 0

  get isInvulnerable(): boolean { return this.divineShieldActiveTimer > 0 }

  appliedBaseSkills: Map<BaseSkillId, number> = new Map()

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
    this.maxHp = 1000
    this.hp = 1000
    this.regenPerSecond = 2
  }

  update(dt: number): void {
    this.rotationAngle += dt * 0.4
    this.pulseTimer    += dt

    if (!this.isInvulnerable) {
      this.hp = Math.min(this.maxHp, this.hp + this.regenPerSecond * dt)
    }

    if (this.shieldPulseEnabled && this.shieldHp <= 0) {
      this.shieldTimer += dt
      if (this.shieldTimer >= this.shieldPulseCooldown) {
        this.shieldTimer = 0
        this.shieldHp = this.shieldPulseMaxHp
      }
    }

    if (this.stunPulseEnabled) {
      this.stunTimer += dt
    }

    // Active base attack timers
    if (this.fireboltEnabled) {
      this.fireboltTimer += dt
    }
    if (this.arcDischargeEnabled) {
      this.arcDischargeTimer += dt
      if (this.arcDischargeTimer >= this.arcDischargeCooldownMax) {
        this.arcDischargeTimer = 0
        this.pendingArcDischarge = true
      }
    }
    if (this.mortarBarrageEnabled) {
      this.mortarTimer += dt
      if (this.mortarTimer >= this.mortarCooldownMax) {
        this.mortarTimer = 0
        this.pendingMortarBarrage = true
      }
    }

    if (this.divineShieldEnabled) {
      if (this.divineShieldActiveTimer > 0) {
        this.divineShieldActiveTimer -= dt
      } else {
        this.divineShieldTimer += dt
        if (this.divineShieldTimer >= this.divineShieldCooldownMax) {
          this.divineShieldTimer = 0
          this.divineShieldActiveTimer = 3
        }
      }
    }
  }

  applyAura(dt: number, zombies: Zombie[], towers: Tower[], player: PlayerRef): void {
    const dot  = this.auraDotPerSec  * dt
    const heal = this.auraHealPerSec * dt

    const stunThisFrame = this.stunPulseEnabled && this.stunTimer >= this.stunPulseCooldownMax
    if (stunThisFrame) this.stunTimer = 0

    for (const z of zombies) {
      if (!z.alive) continue
      if (dist(this.x, this.y, z.x, z.y) < this.auraRadius) {
        z.takeDamage(dot)
        if (!z.alive) { z.auraKill = true; continue }
        if (this.slowAuraAmount > 0) z.slowFactor = Math.max(z.slowFactor, this.slowAuraAmount)
        if (stunThisFrame) z.stun(1.5)
      }
    }

    const damageBonus = this.overlordAuraEnabled ? 0.25 : this.towerDamageAura
    const rangeBonus  = this.overlordAuraEnabled ? 0.25 : this.towerRangeAura
    const hpBonus     = this.fortressProtocolEnabled ? 1.0 : 0
    for (const t of towers) {
      if (!t.alive) continue
      if (dist(this.x, this.y, t.x, t.y) < this.auraRadius) {
        t.hp = Math.min(t.maxHp * (1 + hpBonus), t.hp + heal)
        t.auraDamageBonus = damageBonus
        t.auraRangeBonus  = rangeBonus
        t.auraFireRateBonus = this.synergyEngineEnabled ? this.towerFireRateAura : 0
        t.fireTowerOverdriveActive   = this.fireTowerOverdriveEnabled
        t.electricOverloadActive     = this.electricTowerOverloadEnabled
        t.machineGunOverdriveActive  = this.machineGunOverdriveEnabled
        t.fireTowerInfernoActive     = this.fireTowerInfernoEnabled
        t.electricEMPActive          = this.electricEMPEnabled
        t.machineGunAPActive         = this.machineGunAPEnabled
        t.neuralNetworkActive        = this.neuralNetworkEnabled
      } else {
        t.auraDamageBonus = 0
        t.auraRangeBonus  = 0
        t.auraFireRateBonus = 0
        t.fireTowerOverdriveActive  = false
        t.electricOverloadActive    = false
        t.machineGunOverdriveActive = false
        t.fireTowerInfernoActive    = false
        t.electricEMPActive         = false
        t.machineGunAPActive        = false
        t.neuralNetworkActive       = false
      }
    }

    if (dist(this.x, this.y, player.x, player.y) < this.auraRadius) {
      player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal * 0.5)
    }
  }

  takeDamage(amount: number, attacker?: { takeDamage(n: number): void }): void {
    if (this.isInvulnerable) return

    if (this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, amount)
      this.shieldHp -= absorbed
      amount -= absorbed
      if (amount <= 0) return
    }

    this.hp -= amount

    if (this.thornsEnabled && attacker) {
      attacker.takeDamage(amount * 0.3)
    }

    if (this.counterStrikeEnabled && attacker) {
      this.pendingCounterStrike = attacker as object
    }
  }

  applyBaseSkill(id: BaseSkillId): void {
    const node = BASE_SKILL_TREE_MAP.get(id)
    if (!node) return
    const currentStack = (this.appliedBaseSkills.get(id) ?? 0) + 1
    this.appliedBaseSkills.set(id, currentStack)
    node.apply(this, currentStack)
  }

  resetWaveFlags(): void {
    this.warlordUsedThisWave = false
  }

  get isDead(): boolean {
    return this.hp <= 0
  }
}
