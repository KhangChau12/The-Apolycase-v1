export type TowerType = 'barricade' | 'fireTower' | 'electricTower' | 'repairTower' | 'machineGunTower' | 'freezeTower' | 'poisonTower'

export interface TowerProfile {
  type: TowerType
  label: string
  costIron: number
  costCore: number
  hp: number
  range: number
  damage: number
  fireRate: number      // shots per second (0 = passive)
  description: string
  burnDps?: number
  burnDuration?: number
  chainCount?: number
  slowAmount?: number
  pulseCooldown?: number
  poisonDps?: number
  poisonDuration?: number
  poisonMaxStacks?: number
}

export const TOWER_PROFILES: Record<TowerType, TowerProfile> = {
  barricade: {
    type: 'barricade',
    label: 'Barricade',
    costIron: 4,
    costCore: 0,
    hp: 400,
    range: 0,
    damage: 0,
    fireRate: 0,
    description: 'Physical blocker. Zombies must destroy it to pass.',
  },
  fireTower: {
    type: 'fireTower',
    label: 'Fire Tower',
    costIron: 25,
    costCore: 8,
    hp: 180,
    range: 160,
    damage: 30,
    fireRate: 1.5,
    burnDps: 8,
    burnDuration: 3,
    description: 'Fires a large slow fireball that passes through all zombies and sets them ablaze.',
  },
  electricTower: {
    type: 'electricTower',
    label: 'Electric Tower',
    costIron: 20,
    costCore: 10,
    hp: 140,
    range: 180,
    damage: 18,
    fireRate: 1.0,
    chainCount: 4,
    description: 'Chains lightning to multiple enemies. More targets = more damage.',
  },
  repairTower: {
    type: 'repairTower',
    label: 'Repair Tower',
    costIron: 15,
    costCore: 10,
    hp: 130,
    range: 150,
    damage: 0,
    fireRate: 0,
    description: 'Spawns a worker drone that walks to damaged towers and repairs them.',
  },
  machineGunTower: {
    type: 'machineGunTower',
    label: 'Machine Gun',
    costIron: 30,
    costCore: 6,
    hp: 220,
    range: 200,
    damage: 6,
    fireRate: 12,
    description: 'Extreme fire rate, single target. High sustained DPS.',
  },
  freezeTower: {
    type: 'freezeTower',
    label: 'Cryo Emitter',
    costIron: 18,
    costCore: 14,
    hp: 120,
    range: 170,
    damage: 0,
    fireRate: 0,
    slowAmount: 0.35,
    pulseCooldown: 2.5,
    description: 'Emits a cryo pulse every 2.5s that slows all enemies in range. Stacks with base aura.',
  },
  poisonTower: {
    type: 'poisonTower',
    label: 'Acid Sprayer',
    costIron: 22,
    costCore: 10,
    hp: 150,
    range: 140,
    damage: 4,
    fireRate: 2.0,
    poisonDps: 8,
    poisonDuration: 3.5,
    poisonMaxStacks: 3,
    description: 'Fires acid blobs that poison enemies for 8 DPS over 3.5s (stacks up to 3×).',
  },
}
