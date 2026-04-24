const SAVE_KEY = 'zombie_apolycase_v1'

export interface SaveData {
  version: number
  waveIndex: number
  resources: { coins: number; iron: number; energyCore: number; crystal: number }
  territoryLevel: number
  playerStats: Record<string, number>
  skillsEquipped: (string | null)[]
  // towers are not persisted between sessions (rebuild each run)
}

export function saveGame(data: SaveData): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data))
}

export function loadGame(): SaveData | null {
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SaveData
  } catch {
    return null
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY)
}
