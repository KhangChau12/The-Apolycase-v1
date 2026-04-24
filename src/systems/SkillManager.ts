export type SkillId =
  | 'adrenalineBurst'
  | 'ironSkin'
  | 'overcharge'
  | 'scavenger'
  | 'towerLink'

export interface SkillDef {
  id: SkillId
  label: string
  description: string
}

export const SKILL_DEFS: SkillDef[] = [
  { id: 'adrenalineBurst', label: 'Adrenaline Burst', description: 'Kill streak grants +30% speed for 3s.' },
  { id: 'ironSkin',        label: 'Iron Skin',         description: 'After taking damage, immune for 1.5s.' },
  { id: 'overcharge',      label: 'Overcharge',         description: 'First bullet after reload deals x2 damage.' },
  { id: 'scavenger',       label: 'Scavenger',          description: 'Increased Iron and Energy Core drop rate.' },
  { id: 'towerLink',       label: 'Tower Link',         description: 'Towers in territory fire 15% faster.' },
]

export class SkillManager {
  unlockedSlots = 0
  equipped: (SkillId | null)[] = []

  unlockSlot(): SkillId[] {
    this.unlockedSlots++
    this.equipped.push(null)
    return this.rollOptions(3)
  }

  equip(slot: number, skillId: SkillId): void {
    this.equipped[slot] = skillId
  }

  has(skillId: SkillId): boolean {
    return this.equipped.includes(skillId)
  }

  private rollOptions(count: number): SkillId[] {
    const pool = [...SKILL_DEFS.map(s => s.id)]
    const result: SkillId[] = []
    while (result.length < count && pool.length > 0) {
      const i = Math.floor(Math.random() * pool.length)
      result.push(pool.splice(i, 1)[0])
    }
    return result
  }
}
