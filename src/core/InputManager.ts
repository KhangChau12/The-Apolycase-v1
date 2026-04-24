// Tracks keyboard and mouse state each frame
export class InputManager {
  private keys = new Set<string>()
  mouse = { x: 0, y: 0, down: false }

  constructor() {
    window.addEventListener('keydown', e => this.keys.add(e.code))
    window.addEventListener('keyup', e => this.keys.delete(e.code))
    window.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX
      this.mouse.y = e.clientY
    })
    window.addEventListener('mousedown', e => { if (e.button === 0) this.mouse.down = true })
    window.addEventListener('mouseup',   e => { if (e.button === 0) this.mouse.down = false })
  }

  isDown(code: string): boolean {
    return this.keys.has(code)
  }
}
