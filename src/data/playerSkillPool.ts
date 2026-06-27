import type { Player } from '../entities/Player'

export type SkillRarity = 'common' | 'rare' | 'legendary'

export type PlayerSkillId =
  | 'healthBoost'
  | 'damageBoost'
  | 'attackSpeed'
  | 'armorUp'
  | 'speedBoost'
  | 'reloadMaster'
  | 'xpBoost'
  | 'scavenger'
  | 'critBoost'
  | 'bulletDamage'
  | 'doubleBullet'
  | 'lifesteal'
  | 'dodgeUp'
  | 'lastStand'
  | 'berserker'
  | 'bulletPenetration'
  | 'bulletExplosion'
  | 'overcharge'
  | 'phantomRound'
  | 'deathMark'
  | 'acidCoating'
  | 'kineticStrike'
  | 'ricochetRounds'
  | 'focusedFire'
  | 'executioner'

export interface PlayerSkillDef {
  id: PlayerSkillId
  label: string
  description: string
  icon: string
  rarity: SkillRarity
  maxStacks: number
  apply(player: Player, stack: number): void
}

export const PLAYER_SKILL_POOL: PlayerSkillDef[] = [
  // ── COMMON ─────────────────────────────────────────────────────────
  {
    id: 'healthBoost',
    label: 'Iron Constitution',
    description: '+25 Max HP and heals 12 HP.',
    icon: 'heart',
    rarity: 'common',
    maxStacks: 5,
    apply: (p) => {
      p.stats.maxHp += 25
      p.stats.hp = Math.min(p.stats.hp + 12, p.stats.maxHp)
    },
  },
  {
    id: 'damageBoost',
    label: 'Raw Power',
    description: '+6 bullet damage.',
    icon: 'zap',
    rarity: 'common',
    maxStacks: 5,
    apply: (p) => { p.stats.damage += 6 },
  },
  {
    id: 'attackSpeed',
    label: 'Trigger Finger',
    description: '+12% fire rate.',
    icon: 'crosshair',
    rarity: 'common',
    maxStacks: 3,
    apply: (p, stack) => { p.fireRateMultiplier = 1 + stack * 0.12 },
  },
  {
    id: 'armorUp',
    label: 'Combat Vest',
    description: '+4 armor (damage reduction).',
    icon: 'shield',
    rarity: 'common',
    maxStacks: 4,
    apply: (p) => { p.stats.armor += 4 },
  },
  {
    id: 'speedBoost',
    label: 'Adrenaline',
    description: '+25 movement speed.',
    icon: 'activity',
    rarity: 'common',
    maxStacks: 4,
    apply: (p) => { p.stats.speed += 25 },
  },
  {
    id: 'reloadMaster',
    label: 'Quick Hands',
    description: '+25% reload speed.',
    icon: 'refresh-cw',
    rarity: 'common',
    maxStacks: 4,
    apply: (p, stack) => { p.stats.reloadSpeedMult = 1 + stack * 0.25 },
  },
  {
    id: 'xpBoost',
    label: 'Focused Mind',
    description: '+20% XP gained from kills.',
    icon: 'star',
    rarity: 'common',
    maxStacks: 3,
    apply: (p, stack) => { p.stats.xpMult = 1 + stack * 0.2 },
  },
  {
    id: 'scavenger',
    label: 'Scavenger',
    description: '+15% resource drop rate from kills.',
    icon: 'package',
    rarity: 'common',
    maxStacks: 3,
    apply: (p) => { p.stats.dropBonus += 0.15 },
  },

  // ── RARE ───────────────────────────────────────────────────────────
  {
    id: 'critBoost',
    label: 'Eagle Eye',
    description: '+10% critical hit chance (max 80%).',
    icon: 'eye',
    rarity: 'rare',
    maxStacks: 4,
    apply: (p) => { p.stats.critChance = Math.min(0.8, p.stats.critChance + 0.1) },
  },
  {
    id: 'bulletDamage',
    label: 'Hollow Point',
    description: '+15% bullet damage multiplier.',
    icon: 'circle-dot',
    rarity: 'rare',
    maxStacks: 4,
    apply: (p, stack) => {
      p.stats.damage = Math.round(p.stats.damage * (1 + stack * 0.15) / (1 + (stack - 1) * 0.15))
    },
  },
  {
    id: 'doubleBullet',
    label: 'Twin Shot',
    description: 'Fire 2 bullets at once in a small spread.',
    icon: 'split',
    rarity: 'rare',
    maxStacks: 1,
    apply: (p) => { p.bulletCount = 2 },
  },
  {
    id: 'lifesteal',
    label: 'Vampiric',
    description: '+3% lifesteal — heal HP on every bullet hit.',
    icon: 'heart',
    rarity: 'rare',
    maxStacks: 3,
    apply: (p) => { p.stats.lifesteal += 0.03 },
  },
  {
    id: 'dodgeUp',
    label: 'Ghost Step',
    description: '+8% chance to dodge incoming damage (max 32%).',
    icon: 'map',
    rarity: 'rare',
    maxStacks: 4,
    apply: (p) => { p.stats.dodgeChance = Math.min(0.32, p.stats.dodgeChance + 0.08) },
  },
  {
    id: 'lastStand',
    label: 'Last Stand',
    description: 'Below 25% HP: +40% damage and +30 speed.',
    icon: 'zap',
    rarity: 'rare',
    maxStacks: 1,
    apply: (p) => { p.lastStandEnabled = true },
  },
  {
    id: 'berserker',
    label: 'Berserker',
    description: 'Each kill within 3s stacks +5% damage (max +50%).',
    icon: 'activity',
    rarity: 'rare',
    maxStacks: 1,
    apply: (p) => { p.berserkerEnabled = true },
  },

  // ── LEGENDARY (wave 5+) ────────────────────────────────────────────
  {
    id: 'bulletPenetration',
    label: 'Armor Piercing',
    description: 'Bullets pierce through all enemies.',
    icon: 'arrow-right',
    rarity: 'legendary',
    maxStacks: 1,
    apply: (p) => { p.bulletPenetrating = true },
  },
  {
    id: 'bulletExplosion',
    label: 'Explosive Rounds',
    description: 'Bullets explode on impact for 50% AoE splash.',
    icon: 'bomb',
    rarity: 'legendary',
    maxStacks: 1,
    apply: (p) => { p.bulletExplosion = true },
  },
  {
    id: 'overcharge',
    label: 'Overcharge',
    description: 'First bullet after each reload deals double damage.',
    icon: 'zap',
    rarity: 'legendary',
    maxStacks: 1,
    apply: (p) => { p.overchargeEnabled = true },
  },
  {
    id: 'phantomRound',
    label: 'Phantom Round',
    description: '20% chance each shot consumes no ammo.',
    icon: 'eye',
    rarity: 'legendary',
    maxStacks: 1,
    apply: (p) => { p.phantomRoundEnabled = true },
  },
  {
    id: 'deathMark',
    label: 'Death Mark',
    description: 'Enemies below 20% HP take double damage.',
    icon: 'crosshair',
    rarity: 'legendary',
    maxStacks: 1,
    apply: (p) => { p.deathMarkEnabled = true },
  },

  // ── NEW v1.7 SKILLS ────────────────────────────────────────────────────
  {
    id: 'acidCoating',
    label: 'Acid Coating',
    description: 'Bullets coat enemies in acid: 3 DPS per stack for 2s (max 3 stacks).',
    icon: 'flame',
    rarity: 'rare',
    maxStacks: 3,
    apply: (p, stack) => { p.acidCoatingEnabled = true; p.acidCoatingStacks = stack },
  },
  {
    id: 'kineticStrike',
    label: 'Kinetic Strike',
    description: 'Every 10 consecutive hits on the same enemy stuns it for 0.6s.',
    icon: 'zap',
    rarity: 'common',
    maxStacks: 1,
    apply: (p) => { p.kineticStrikeEnabled = true },
  },
  {
    id: 'ricochetRounds',
    label: 'Ricochet Rounds',
    description: 'Bullets that expire in the air bounce once at 60% damage in a random direction.',
    icon: 'arrow-right',
    rarity: 'rare',
    maxStacks: 1,
    apply: (p) => { p.ricochetEnabled = true },
  },
  {
    id: 'focusedFire',
    label: 'Focused Fire',
    description: 'Consecutive shots in the same direction build +4% damage per shot (max +40% per stack).',
    icon: 'crosshair',
    rarity: 'common',
    maxStacks: 2,
    apply: (p, stack) => { p.focusedFireEnabled = true; p.focusedFireMaxStacks = stack * 10 },
  },
  {
    id: 'executioner',
    label: 'Executioner',
    description: 'Killing an enemy below 30% HP charges your next shot for 2s: triple damage.',
    icon: 'sword',
    rarity: 'legendary',
    maxStacks: 1,
    apply: (p) => { p.executionerEnabled = true },
  },
]
