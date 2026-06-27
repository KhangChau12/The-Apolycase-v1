export type WeaponClass = 'pistol' | 'shotgun' | 'assaultRifle' | 'smg' | 'sniperRifle' | 'grenadeLauncher' | 'marksmanRifle'

export interface WeaponProfile {
  id: string
  label: string
  class: WeaponClass
  damage: number
  fireRate: number      // shots per second
  spread: number        // degrees
  reloadTime: number    // seconds
  magSize: number
  bulletSpeed: number
  cost: number          // coins
  shakeIntensity: number
  shakeDuration: number
}

export const WEAPON_PROFILES: WeaponProfile[] = [
  {
    id: 'pistol_m9',
    label: 'M9 Pistol',
    class: 'pistol',
    damage: 18,
    fireRate: 3,
    spread: 3,
    reloadTime: 1.2,
    magSize: 15,
    bulletSpeed: 1400,
    cost: 0,
    shakeIntensity: 0.8,
    shakeDuration: 0.06,
  },
  {
    id: 'shotgun_870',
    label: 'Pump Shotgun',
    class: 'shotgun',
    damage: 12,    // per pellet, 8 pellets
    fireRate: 0.8,
    spread: 18,
    reloadTime: 2.5,
    magSize: 6,
    bulletSpeed: 1100,
    cost: 180,
    shakeIntensity: 2.5,
    shakeDuration: 0.12,
  },
  {
    id: 'ar_m4',
    label: 'M4 Assault Rifle',
    class: 'assaultRifle',
    damage: 22,
    fireRate: 8,
    spread: 4,
    reloadTime: 2.0,
    magSize: 30,
    bulletSpeed: 1800,
    cost: 300,
    shakeIntensity: 1.0,
    shakeDuration: 0.07,
  },
  {
    id: 'smg_mp5',
    label: 'MP5 SMG',
    class: 'smg',
    damage: 14,
    fireRate: 12,
    spread: 6,
    reloadTime: 1.8,
    magSize: 40,
    bulletSpeed: 1600,
    cost: 220,
    shakeIntensity: 0.6,
    shakeDuration: 0.05,
  },
  {
    id: 'sniper_awp',
    label: 'AWP Sniper',
    class: 'sniperRifle',
    damage: 175,
    fireRate: 0.5,
    spread: 0.5,
    reloadTime: 3.0,
    magSize: 5,
    bulletSpeed: 2800,
    cost: 550,
    shakeIntensity: 3.5,
    shakeDuration: 0.15,
  },
  {
    id: 'smg_vector',
    label: 'Vector SMG',
    class: 'smg',
    damage: 10,
    fireRate: 18,
    spread: 8,
    reloadTime: 1.2,
    magSize: 25,
    bulletSpeed: 1700,
    cost: 420,
    shakeIntensity: 0.5,
    shakeDuration: 0.04,
  },
  {
    id: 'rl_m79',
    label: 'M79 Grenade Launcher',
    class: 'grenadeLauncher',
    damage: 55,
    fireRate: 0.8,
    spread: 2,
    reloadTime: 2.6,
    magSize: 6,
    bulletSpeed: 900,
    cost: 420,
    shakeIntensity: 4.0,
    shakeDuration: 0.18,
  },
  {
    id: 'rifle_dsr',
    label: 'DSR Marksman Rifle',
    class: 'marksmanRifle',
    damage: 75,
    fireRate: 2.0,
    spread: 1.2,
    reloadTime: 2.2,
    magSize: 12,
    bulletSpeed: 2200,
    cost: 500,
    shakeIntensity: 1.8,
    shakeDuration: 0.09,
  },
]
