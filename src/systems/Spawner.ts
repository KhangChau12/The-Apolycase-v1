import { Zombie, ZombieArchetype } from '../entities/Zombie'

const WORLD_W = 3000
const WORLD_H = 3000
const MARGIN = 60

const SPAWN_POINTS = [
  { x: WORLD_W / 2, y: MARGIN },
  { x: WORLD_W / 2, y: WORLD_H - MARGIN },
  { x: MARGIN, y: WORLD_H / 2 },
  { x: WORLD_W - MARGIN, y: WORLD_H / 2 },
  { x: MARGIN, y: MARGIN },
  { x: WORLD_W - MARGIN, y: MARGIN },
  { x: MARGIN, y: WORLD_H - MARGIN },
  { x: WORLD_W - MARGIN, y: WORLD_H - MARGIN },
]

interface SpawnConfig {
  archetype: ZombieArchetype
  count: number
}

const BOSS_EVERY = 5
const MAX_TIER = 3
const BASE_TIER_CHANCE = 0.05
const TIER_CHANCE_STEP = 0.01
const TIER_STEP_WAVE_CADENCE = 2

function bossesDefeatedBeforeWave(waveIndex: number): number {
  return Math.floor((waveIndex - 1) / BOSS_EVERY)
}

function maxUnlockedTier(waveIndex: number): number {
  const defeated = bossesDefeatedBeforeWave(waveIndex)
  // Tier unlocks at boss counts: 1 -> tier 1, 3 -> tier 2, 5 -> tier 3.
  return Math.max(0, Math.min(MAX_TIER, Math.floor((defeated + 1) / 2)))
}

function unlockWaveForTier(tier: number): number {
  if (tier <= 0) return 1
  const requiredBossKills = 2 * tier - 1
  return requiredBossKills * BOSS_EVERY + 1
}

function tierChanceAtWave(tier: number, waveIndex: number): number {
  const unlockWave = unlockWaveForTier(tier)
  if (waveIndex < unlockWave) return 0
  const steps = Math.floor((waveIndex - unlockWave) / TIER_STEP_WAVE_CADENCE)
  const raw = BASE_TIER_CHANCE + steps * TIER_CHANCE_STEP
  return Math.min(0.2, raw)
}

function rollZombieTier(waveIndex: number, archetype: ZombieArchetype): number {
  if (archetype === 'boss') return 0

  const maxTier = maxUnlockedTier(waveIndex)
  if (maxTier <= 0) return 0

  const weights = new Array(maxTier + 1).fill(0)
  let remaining = 1

  // Allocate higher tiers first so top tiers remain intentionally rare.
  for (let tier = maxTier; tier >= 1; tier--) {
    const share = Math.min(remaining, tierChanceAtWave(tier, waveIndex))
    weights[tier] = share
    remaining -= share
  }
  weights[0] = Math.max(0, remaining)

  let r = Math.random()
  for (let tier = 0; tier <= maxTier; tier++) {
    r -= weights[tier]
    if (r <= 0) return tier
  }
  return 0
}

function waveConfig(waveIndex: number, isBoss: boolean): SpawnConfig[] {
  const w = waveIndex
  const configs: SpawnConfig[] = [
    { archetype: 'regular', count: 5 + w * 3 },
  ]
  if (w >= 2) configs.push({ archetype: 'fast', count: Math.floor(w * 1.5) })
  if (w >= 3) configs.push({ archetype: 'tank', count: Math.floor(w * 0.8) })
  if (w >= 4) configs.push({ archetype: 'armored', count: Math.floor(w * 0.6) })
  if (isBoss) configs.push({ archetype: 'boss', count: 1 })
  return configs
}

export function spawnWave(waveIndex: number, isBoss: boolean, _ww: number, _wh: number): Zombie[] {
  const waveMult = 1 + (waveIndex - 1) * 0.18
  const configs = waveConfig(waveIndex, isBoss)
  const zombies: Zombie[] = []

  for (const cfg of configs) {
    for (let i = 0; i < cfg.count; i++) {
      const sp = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)]
      const jx = sp.x + (Math.random() - 0.5) * 80
      const jy = sp.y + (Math.random() - 0.5) * 80
      const tier = rollZombieTier(waveIndex, cfg.archetype)
      zombies.push(new Zombie(jx, jy, cfg.archetype, waveMult, tier))
    }
  }

  return zombies
}
