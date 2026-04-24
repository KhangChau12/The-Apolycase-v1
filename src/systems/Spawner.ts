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
      zombies.push(new Zombie(jx, jy, cfg.archetype, waveMult))
    }
  }

  return zombies
}
