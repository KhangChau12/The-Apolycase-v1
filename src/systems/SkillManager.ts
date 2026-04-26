import { PLAYER_SKILL_POOL, PlayerSkillId, SkillRarity } from '../data/playerSkillPool'
import { BASE_SKILL_POOL, BaseSkillId } from '../data/baseSkillPool'

export type SkillId = PlayerSkillId | BaseSkillId

// Rarity weights: common=60, rare=30, legendary=10 (sums to 100)
const RARITY_WEIGHTS: Record<SkillRarity, number> = { common: 60, rare: 30, legendary: 10 }

export class SkillManager {
  unlockedSlots = 0
  equipped: (BaseSkillId | null)[] = []

  unlockSlot(waveIndex = 0): BaseSkillId[] {
    this.unlockedSlots++
    this.equipped.push(null)
    return this.rollBaseOptions(3, waveIndex)
  }

  equip(slot: number, skillId: BaseSkillId): void {
    this.equipped[slot] = skillId
  }

  has(skillId: BaseSkillId): boolean {
    return this.equipped.includes(skillId)
  }

  // Roll options for player level-up skills
  rollPlayerOptions(count: number, waveIndex: number, applied: Map<PlayerSkillId, number>): PlayerSkillId[] {
    const pool = PLAYER_SKILL_POOL.filter(s => {
      if (s.rarity === 'legendary' && waveIndex < 5) return false
      const stacks = applied.get(s.id) ?? 0
      return stacks < s.maxStacks
    })
    return this.weightedSample(pool.map(s => ({ id: s.id, rarity: s.rarity })), count) as PlayerSkillId[]
  }

  // Roll options for base territory expansion skills
  rollBaseOptions(count: number, waveIndex: number): BaseSkillId[] {
    const pool = BASE_SKILL_POOL.filter(s => {
      if (s.rarity === 'legendary' && waveIndex < 5) return false
      const stacks = this.equipped.filter(e => e === s.id).length
      return stacks < s.maxStacks
    })
    return this.weightedSample(pool.map(s => ({ id: s.id, rarity: s.rarity })), count) as BaseSkillId[]
  }

  private weightedSample(pool: { id: string; rarity: SkillRarity }[], count: number): string[] {
    const result: string[] = []
    const remaining = [...pool]

    while (result.length < count && remaining.length > 0) {
      const totalWeight = remaining.reduce((sum, s) => sum + RARITY_WEIGHTS[s.rarity], 0)
      let roll = Math.random() * totalWeight
      let chosen = remaining[remaining.length - 1]
      for (const skill of remaining) {
        roll -= RARITY_WEIGHTS[skill.rarity]
        if (roll <= 0) { chosen = skill; break }
      }
      result.push(chosen.id)
      remaining.splice(remaining.indexOf(chosen), 1)
    }

    return result
  }
}
