export type TowerType = 'guard' | 'barricade' | 'shockPylon' | 'sniperPost' | 'repairNode'

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
}

export const TOWER_PROFILES: Record<TowerType, TowerProfile> = {
  guard: {
    type: 'guard',
    label: 'Guard Tower',
    costIron: 20,
    costCore: 0,
    hp: 200,
    range: 180,
    damage: 15,
    fireRate: 2,
    description: 'Basic auto-attack tower, targets nearest zombie.',
  },
  barricade: {
    type: 'barricade',
    label: 'Barricade',
    costIron: 10,
    costCore: 0,
    hp: 400,
    range: 0,
    damage: 0,
    fireRate: 0,
    description: 'Physical blocker. Zombies must destroy it to pass.',
  },
  shockPylon: {
    type: 'shockPylon',
    label: 'Shock Pylon',
    costIron: 15,
    costCore: 5,
    hp: 150,
    range: 120,
    damage: 8,
    fireRate: 1,
    description: 'AOE electric pulse. Slows zombies in radius.',
  },
  sniperPost: {
    type: 'sniperPost',
    label: 'Sniper Post',
    costIron: 25,
    costCore: 8,
    hp: 120,
    range: 400,
    damage: 80,
    fireRate: 0.5,
    description: 'Long range, high damage, slow fire rate.',
  },
  repairNode: {
    type: 'repairNode',
    label: 'Repair Node',
    costIron: 10,
    costCore: 10,
    hp: 100,
    range: 150,
    damage: 0,
    fireRate: 0,
    description: 'Passively heals towers and Home Base in range.',
  },
}
