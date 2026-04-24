import type { HomeBase } from '../entities/HomeBase'

export type BaseSkillId =
  | 'auraRangeUp'
  | 'auraDotUp'
  | 'auraHealUp'
  | 'baseRegenUp'
  | 'baseMaxHpUp'
  | 'thornsAura'

export interface BaseSkillDef {
  id: BaseSkillId
  label: string
  description: string
  icon: string
  maxStacks: number
  apply(base: HomeBase, stack: number): void
}

export const BASE_SKILL_POOL: BaseSkillDef[] = [
  {
    id: 'auraRangeUp',
    label: 'Extended Field',
    description: '+60 aura radius. More zombies take DOT; more towers get healed.',
    icon: '◯',
    maxStacks: 4,
    apply: (b) => { b.auraRadius += 60 },
  },
  {
    id: 'auraDotUp',
    label: 'Scorched Earth',
    description: '+4 aura DOT per second to zombies.',
    icon: '🔥',
    maxStacks: 5,
    apply: (b) => { b.auraDotPerSec += 4 },
  },
  {
    id: 'auraHealUp',
    label: 'Regeneration Field',
    description: '+4 aura heal per second to towers and player.',
    icon: '✚',
    maxStacks: 5,
    apply: (b) => { b.auraHealPerSec += 4 },
  },
  {
    id: 'baseRegenUp',
    label: 'Fortified Core',
    description: '+2 base HP regen per second.',
    icon: '⟳',
    maxStacks: 4,
    apply: (b) => { b.regenPerSecond += 2 },
  },
  {
    id: 'baseMaxHpUp',
    label: 'Reinforced Walls',
    description: '+300 max base HP and heals 150 HP.',
    icon: '■',
    maxStacks: 3,
    apply: (b) => {
      b.maxHp += 300
      b.hp = Math.min(b.hp + 150, b.maxHp)
    },
  },
  {
    id: 'thornsAura',
    label: 'Thorn Field',
    description: 'Zombies that attack the base reflect 30% damage back.',
    icon: '✦',
    maxStacks: 1,
    apply: (b) => { b.thornsEnabled = true },
  },
]
