import { Game } from './core/Game'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
canvas.width = window.innerWidth
canvas.height = window.innerHeight

// Wait for Russo One to load before starting canvas text rendering
document.fonts.ready.then(() => {
  new Game(canvas)
})
