export type GarrisonUnitType = 'soldier' | 'heavy' | 'medic' | 'titan'

export interface GarrisonProfile {
  type: GarrisonUnitType
  hp: number
  damage: number      // DPS
  speed: number
  attackRange: number
  attackRate: number  // attacks per second
  radius: number
  color: string
  glowColor: string
  splashRadius?: number  // titan only
  slowOnHit?: number     // heavy only: slow fraction
}

export const GARRISON_PROFILES: Record<GarrisonUnitType, GarrisonProfile> = {
  soldier: {
    type: 'soldier', hp: 80,  damage: 15, speed: 140,
    attackRange: 120, attackRate: 1.5,
    radius: 20, color: '#3A3A3A', glowColor: '#4488FF',
  },
  heavy: {
    type: 'heavy', hp: 220, damage: 28, speed: 80,
    attackRange: 70, attackRate: 1.0,
    radius: 30, color: '#3A3A3A', glowColor: '#FF8820',
    slowOnHit: 0.5,
  },
  medic: {
    type: 'medic', hp: 60,  damage: 0,  speed: 120,
    attackRange: 110, attackRate: 0,
    radius: 16, color: '#2A3A2A', glowColor: '#44FF88',
  },
  titan: {
    type: 'titan', hp: 500, damage: 65, speed: 50,
    attackRange: 80, attackRate: 0.5,
    radius: 42, color: '#3A2A3A', glowColor: '#BB44FF',
    splashRadius: 120,
  },
}
