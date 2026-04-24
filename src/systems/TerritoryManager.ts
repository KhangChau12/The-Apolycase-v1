// Manages territory radius and crystal-based expansion
export class TerritoryManager {
  radius: number
  level = 0
  private readonly baseRadius = 300
  private readonly radiusPerLevel = 200

  constructor() {
    this.radius = this.baseRadius
  }

  crystalCostForNextExpansion(currentCrystals: number): number {
    // Cost: 1 + level (1, 2, 3, ...)
    void currentCrystals
    return 1 + this.level
  }

  expand(): void {
    this.level++
    this.radius = this.baseRadius + this.level * this.radiusPerLevel
  }

  isInsideTerritory(x: number, y: number, cx: number, cy: number): boolean {
    const dx = x - cx
    const dy = y - cy
    return dx * dx + dy * dy <= this.radius * this.radius
  }
}
