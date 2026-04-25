import type { Player } from '../entities/Player'

export type PlayerSkillId =
  | 'healthBoost'
  | 'damageBoost'
  | 'attackSpeed'
  | 'doubleBullet'
  | 'bulletDamage'
  | 'bulletExplosion'
  | 'bulletPenetration'
  | 'armorUp'
  | 'critBoost'
  | 'speedBoost'

export interface PlayerSkillDef {
  id: PlayerSkillId
  label: string
  description: string
  icon: string
  maxStacks: number
  apply(player: Player, stack: number): void
}

export const PLAYER_SKILL_POOL: PlayerSkillDef[] = [
  {
    id: 'healthBoost',
    label: 'Iron Constitution',
    description: '+30 Max HP and heals 15 HP.',
    icon: 'heart',
    maxStacks: 5,
    apply: (p) => {
      p.stats.maxHp += 30
      p.stats.hp = Math.min(p.stats.hp + 15, p.stats.maxHp)
    },
  },
  {
    id: 'damageBoost',
    label: 'Raw Power',
    description: '+8 bullet damage.',
    icon: 'zap',
    maxStacks: 5,
    apply: (p) => { p.stats.damage += 8 },
  },
  {
    id: 'attackSpeed',
    label: 'Trigger Finger',
    description: '+15% fire rate.',
    icon: 'crosshair',
    maxStacks: 3,
    apply: (p, stack) => { p.fireRateMultiplier = 1 + stack * 0.15 },
  },
  {
    id: 'doubleBullet',
    label: 'Twin Shot',
    description: 'Fire 2 bullets at once in a small spread.',
    icon: 'split',
    maxStacks: 1,
    apply: (p) => { p.bulletCount = 2 },
  },
  {
    id: 'bulletDamage',
    label: 'Hollow Point',
    description: '+20% bullet damage multiplier.',
    icon: 'circle-dot',
    maxStacks: 4,
    apply: (p, stack) => { p.stats.damage = Math.round(p.stats.damage * (1 + stack * 0.2) / (1 + (stack - 1) * 0.2)) },
  },
  {
    id: 'bulletExplosion',
    label: 'Explosive Rounds',
    description: 'Bullets explode on impact for 50% splash damage.',
    icon: 'bomb',
    maxStacks: 1,
    apply: (p) => { p.bulletExplosion = true },
  },
  {
    id: 'bulletPenetration',
    label: 'Armor Piercing',
    description: 'Bullets pierce through enemies.',
    icon: 'arrow-right',
    maxStacks: 1,
    apply: (p) => { p.bulletPenetrating = true },
  },
  {
    id: 'armorUp',
    label: 'Combat Vest',
    description: '+3 armor (damage reduction).',
    icon: 'shield',
    maxStacks: 4,
    apply: (p) => { p.stats.armor += 3 },
  },
  {
    id: 'critBoost',
    label: 'Eagle Eye',
    description: '+10% critical hit chance.',
    icon: 'eye',
    maxStacks: 5,
    apply: (p) => { p.stats.critChance = Math.min(0.8, p.stats.critChance + 0.1) },
  },
  {
    id: 'speedBoost',
    label: 'Adrenaline',
    description: '+25 movement speed.',
    icon: 'activity',
    maxStacks: 4,
    apply: (p) => { p.stats.speed += 25 },
  },
]
