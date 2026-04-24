export class Camera {
  x = 0
  y = 0

  constructor(
    private screenW: number,
    private screenH: number,
  ) {}

  follow(worldX: number, worldY: number, worldW: number, worldH: number): void {
    this.x = Math.max(0, Math.min(worldX - this.screenW / 2, worldW - this.screenW))
    this.y = Math.max(0, Math.min(worldY - this.screenH / 2, worldH - this.screenH))
  }

  toScreen(worldX: number, worldY: number): { x: number; y: number } {
    return { x: worldX - this.x, y: worldY - this.y }
  }

  toWorld(screenX: number, screenY: number): { x: number; y: number } {
    return { x: screenX + this.x, y: screenY + this.y }
  }

  resize(screenW: number, screenH: number): void {
    this.screenW = screenW
    this.screenH = screenH
  }
}
