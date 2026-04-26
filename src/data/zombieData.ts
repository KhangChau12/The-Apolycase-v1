import { ZombieArchetype } from '../entities/Zombie'

export interface ZombieTemplate {
  archetype: ZombieArchetype
  baseHp: number
  baseSpeed: number
  baseDamage: number
  ironDrop: [number, number]           // [min, max]
  energyCoreDrop: [number, number]
  coinsDrop: [number, number]
  ammoDrop: [number, number, number]   // [min, max, chance 0-1]
  dropsCrystal: boolean
}

export interface ZombieTierScaling {
  hpPerTier: number
  speedPerTier: number
  damagePerTier: number
  xpPerTier: number
  sizePerTier: number
  armorBonusPerTier: number
}

export const ZOMBIE_TEMPLATES: Record<ZombieArchetype, ZombieTemplate> = {
  regular: {
    archetype: 'regular',
    baseHp: 60,
    baseSpeed: 80,
    baseDamage: 8,
    ironDrop: [2, 5],
    energyCoreDrop: [0, 1],
    coinsDrop: [1, 3],
    ammoDrop: [3, 8, 0.30],
    dropsCrystal: false,
  },
  fast: {
    archetype: 'fast',
    baseHp: 35,
    baseSpeed: 150,
    baseDamage: 25,
    ironDrop: [1, 3],
    energyCoreDrop: [0, 1],
    coinsDrop: [1, 2],
    ammoDrop: [2, 5, 0.25],
    dropsCrystal: false,
  },
  tank: {
    archetype: 'tank',
    baseHp: 300,
    baseSpeed: 45,
    baseDamage: 20,
    ironDrop: [5, 10],
    energyCoreDrop: [0, 2],
    coinsDrop: [3, 6],
    ammoDrop: [6, 14, 0.40],
    dropsCrystal: false,
  },
  armored: {
    archetype: 'armored',
    baseHp: 120,
    baseSpeed: 65,
    baseDamage: 12,
    ironDrop: [3, 6],
    energyCoreDrop: [1, 3],
    coinsDrop: [2, 4],
    ammoDrop: [4, 10, 0.35],
    dropsCrystal: false,
  },
  boss: {
    archetype: 'boss',
    baseHp: 2000,
    baseSpeed: 55,
    baseDamage: 40,
    ironDrop: [20, 30],
    energyCoreDrop: [8, 15],
    coinsDrop: [20, 40],
    ammoDrop: [30, 60, 1.00],
    dropsCrystal: true,
  },
}

// Tier growth emphasizes each archetype's identity.
export const ZOMBIE_TIER_SCALING: Record<ZombieArchetype, ZombieTierScaling> = {
  regular: {
    hpPerTier: 0.18,
    speedPerTier: 0.04,
    damagePerTier: 0.1,
    xpPerTier: 0.12,
    sizePerTier: 0.15,
    armorBonusPerTier: 0,
  },
  fast: {
    hpPerTier: 0.12,
    speedPerTier: 0.18,
    damagePerTier: 0.12,
    xpPerTier: 0.12,
    sizePerTier: 0.15,
    armorBonusPerTier: 0,
  },
  tank: {
    hpPerTier: 0.26,
    speedPerTier: 0.02,
    damagePerTier: 0.14,
    xpPerTier: 0.15,
    sizePerTier: 0.15,
    armorBonusPerTier: 0,
  },
  armored: {
    hpPerTier: 0.22,
    speedPerTier: 0.03,
    damagePerTier: 0.12,
    xpPerTier: 0.14,
    sizePerTier: 0.15,
    armorBonusPerTier: 0.05,
  },
  boss: {
    hpPerTier: 0,
    speedPerTier: 0,
    damagePerTier: 0,
    xpPerTier: 0,
    sizePerTier: 0,
    armorBonusPerTier: 0,
  },
}
