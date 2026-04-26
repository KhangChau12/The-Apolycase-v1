import type { HomeBase } from '../entities/HomeBase'
import type { SkillRarity } from './playerSkillPool'

export type BaseSkillId =
  | 'auraRangeUp'
  | 'auraDotUp'
  | 'auraHealUp'
  | 'baseRegenUp'
  | 'baseMaxHpUp'
  | 'resourceAura'
  | 'slowAura'
  | 'towerDamageBuff'
  | 'towerRangeBuff'
  | 'shieldPulse'
  | 'thornsAura'
  | 'counterStrike'
  | 'stunPulse'
  | 'garrisonCall'
  | 'overlordAura'
  | 'divineShield'
  // garrison sub-skills
  | 'garrisonSize'
  | 'garrisonHP'
  | 'garrisonDamage'
  | 'garrisonHeavy'
  | 'garrisonMedic'
  | 'garrisonTitan'
  | 'heavySlowField'
  | 'medicHealUp'
  | 'emergencyRespawn'
  | 'garrisonArmored'
  | 'warlordCall'
  // active base attacks
  | 'baseFirebolt'
  | 'baseChainLightning'
  | 'baseMortarBarrage'
  // technology
  | 'fireTowerOverdrive'
  | 'electricTowerOverload'
  | 'machineGunOverdrive'
  | 'repairDroneUpgrade'
  | 'fireTowerInferno'
  | 'electricTowerEMP'
  | 'machineGunArmorPierce'
  | 'overlordAuraTech'
  | 'towerNetworkSync'
  | 'fortressProtocol'
  // root
  | 'baseCore'
  // gateway nodes
  | 'auraCore'
  | 'techCore'

export interface BaseSkillDef {
  id: BaseSkillId
  label: string
  description: string
  icon: string
  rarity: SkillRarity
  maxStacks: number
  apply(base: HomeBase, stack: number): void
}

export const BASE_SKILL_POOL: BaseSkillDef[] = [
  // ── COMMON ─────────────────────────────────────────────────────────
  {
    id: 'auraRangeUp',
    label: 'Extended Field',
    description: '+60 aura radius. More zombies take DOT; more towers get healed.',
    icon: 'expand',
    rarity: 'common',
    maxStacks: 4,
    apply: (b) => { b.auraRadius += 60 },
  },
  {
    id: 'auraDotUp',
    label: 'Scorched Earth',
    description: '+4 aura DOT per second to zombies.',
    icon: 'flame',
    rarity: 'common',
    maxStacks: 5,
    apply: (b) => { b.auraDotPerSec += 4 },
  },
  {
    id: 'auraHealUp',
    label: 'Regeneration Field',
    description: '+4 aura heal per second to towers and player.',
    icon: 'plus-circle',
    rarity: 'common',
    maxStacks: 5,
    apply: (b) => { b.auraHealPerSec += 4 },
  },
  {
    id: 'baseRegenUp',
    label: 'Fortified Core',
    description: '+2 base HP regen per second.',
    icon: 'refresh-cw',
    rarity: 'common',
    maxStacks: 4,
    apply: (b) => { b.regenPerSecond += 2 },
  },
  {
    id: 'baseMaxHpUp',
    label: 'Reinforced Walls',
    description: '+300 max base HP and heals 150 HP.',
    icon: 'layers',
    rarity: 'common',
    maxStacks: 3,
    apply: (b) => {
      b.maxHp += 300
      b.hp = Math.min(b.hp + 150, b.maxHp)
    },
  },
  {
    id: 'resourceAura',
    label: 'Salvage Field',
    description: '+15% resource drop rate for kills inside the aura.',
    icon: 'package',
    rarity: 'common',
    maxStacks: 3,
    apply: (b) => { b.resourceDropBonus += 0.15 },
  },

  // ── RARE ───────────────────────────────────────────────────────────
  {
    id: 'slowAura',
    label: 'Tar Field',
    description: 'Zombies inside the aura move 15% slower.',
    icon: 'map',
    rarity: 'rare',
    maxStacks: 3,
    apply: (b, stack) => { b.slowAuraAmount = Math.min(0.6, stack * 0.15) },
  },
  {
    id: 'towerDamageBuff',
    label: 'Fire Control',
    description: '+10% damage for all towers inside the aura.',
    icon: 'zap',
    rarity: 'rare',
    maxStacks: 3,
    apply: (b, stack) => { b.towerDamageAura = stack * 0.1 },
  },
  {
    id: 'towerRangeBuff',
    label: 'Signal Boost',
    description: '+15% range for all towers inside the aura.',
    icon: 'expand',
    rarity: 'rare',
    maxStacks: 3,
    apply: (b, stack) => { b.towerRangeAura = stack * 0.15 },
  },
  {
    id: 'shieldPulse',
    label: 'Barrier Pulse',
    description: 'Every 15s the base generates a shield absorbing 200 damage.',
    icon: 'shield',
    rarity: 'rare',
    maxStacks: 3,
    apply: (b, stack) => {
      b.shieldPulseEnabled = true
      b.shieldPulseMaxHp = stack * 200
      b.shieldPulseCooldown = Math.max(8, 15 - (stack - 1) * 2)
    },
  },
  {
    id: 'thornsAura',
    label: 'Thorn Field',
    description: 'Zombies that attack the base reflect 30% damage back.',
    icon: 'sword',
    rarity: 'rare',
    maxStacks: 1,
    apply: (b) => { b.thornsEnabled = true },
  },
  {
    id: 'counterStrike',
    label: 'Counter Strike',
    description: 'When the base takes damage, fire a retaliatory shot at the attacker.',
    icon: 'crosshair',
    rarity: 'rare',
    maxStacks: 1,
    apply: (b) => { b.counterStrikeEnabled = true },
  },

  // ── LEGENDARY (wave 5+) ────────────────────────────────────────────
  {
    id: 'stunPulse',
    label: 'Shockwave',
    description: 'Every 10s, stun all zombies in the aura for 1.5s.',
    icon: 'zap',
    rarity: 'legendary',
    maxStacks: 1,
    apply: (b) => {
      b.stunPulseEnabled = true
      b.stunPulseCooldownMax = 10
    },
  },
  {
    id: 'garrisonCall',
    label: 'Call to Arms',
    description: 'Spawn 2 Soldier units at the start of each wave to defend the base.',
    icon: 'user',
    rarity: 'legendary',
    maxStacks: 1,
    apply: (b) => { b.garrisonEnabled = true },
  },
  {
    id: 'overlordAura',
    label: 'Overlord',
    description: 'All towers inside the aura gain +25% to all stats.',
    icon: 'star',
    rarity: 'legendary',
    maxStacks: 1,
    apply: (b) => { b.overlordAuraEnabled = true },
  },
  {
    id: 'divineShield',
    label: 'Divine Shield',
    description: 'Every 30s the base becomes invulnerable for 3s.',
    icon: 'shield',
    rarity: 'legendary',
    maxStacks: 1,
    apply: (b) => {
      b.divineShieldEnabled = true
      b.divineShieldCooldownMax = 30
    },
  },
]
