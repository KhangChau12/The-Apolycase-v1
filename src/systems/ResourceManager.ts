export interface Resources {
  coins: number
  iron: number
  energyCore: number
  crystal: number
}

export class ResourceManager {
  res: Resources = { coins: 0, iron: 0, energyCore: 0, crystal: 0 }

  add(partial: Partial<Resources>): void {
    for (const key of Object.keys(partial) as (keyof Resources)[]) {
      this.res[key] += partial[key] ?? 0
    }
  }

  spend(partial: Partial<Resources>): boolean {
    for (const key of Object.keys(partial) as (keyof Resources)[]) {
      if (this.res[key] < (partial[key] ?? 0)) return false
    }
    for (const key of Object.keys(partial) as (keyof Resources)[]) {
      this.res[key] -= partial[key] ?? 0
    }
    return true
  }

  canAfford(partial: Partial<Resources>): boolean {
    return (Object.keys(partial) as (keyof Resources)[]).every(
      k => this.res[k] >= (partial[k] ?? 0)
    )
  }
}
