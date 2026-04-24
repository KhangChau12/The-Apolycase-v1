import { Game } from '../core/Game'
import { T } from './theme'

export class GameOverScreen {
  private el: HTMLElement

  constructor(private game: Game) {
    this.el = document.getElementById('gameover-screen')!
    this.el.classList.add('hidden')
  }

  show(): void {
    const g = this.game
    const p = g.player
    const kills = p.kills
    const wave = g.waveManager.waveIndex
    const territory = g.territory.level
    const score = Math.floor(kills * 10 + wave * 100 + p.stats.level * 50)

    this.el.innerHTML = `
      <div style="
        background:rgba(20,12,8,0.96);
        border:2px solid ${T.blood};
        border-radius:4px;
        padding:36px 40px;
        text-align:center;
        max-width:460px;width:100%;
        display:flex;flex-direction:column;gap:16px;
        box-shadow: 0 0 60px rgba(204,26,26,0.2);
      ">
        <div class="go-title">BASE DESTROYED</div>
        <div style="color:${T.iron};font:11px ${T.font};letter-spacing:2px;">THE HORDE HAS OVERRUN YOUR POSITION</div>

        <!-- Score -->
        <div style="
          background:rgba(139,58,42,0.15);
          border:1px solid rgba(139,58,42,0.4);
          border-radius:2px;padding:10px;
        ">
          <div style="color:${T.iron};font:9px ${T.font};letter-spacing:2px;margin-bottom:4px;">FINAL SCORE</div>
          <div id="go-score" style="color:${T.gold};font:bold 32px ${T.font};">0</div>
        </div>

        <!-- Stats -->
        <div style="
          background:rgba(44,28,20,0.7);
          border:1px solid #5a1a0a;
          border-radius:2px;
          padding:14px 16px;
          display:flex;flex-direction:column;gap:8px;
        ">
          <div class="go-stat" style="animation-delay:0.2s;${statRow()}">
            <span style="color:${T.iron};">Waves survived</span>
            <span style="color:${T.amber};">${wave}</span>
          </div>
          <div class="go-stat" style="animation-delay:0.4s;${statRow()}">
            <span style="color:${T.iron};">Kills</span>
            <span id="go-kills" style="color:${T.ember};">0</span>
          </div>
          <div class="go-stat" style="animation-delay:0.6s;${statRow()}">
            <span style="color:${T.iron};">Level reached</span>
            <span style="color:${T.coreBlue};">LV${p.stats.level}</span>
          </div>
          <div class="go-stat" style="animation-delay:0.8s;${statRow()}">
            <span style="color:${T.iron};">Territory expansions</span>
            <span style="color:${T.crystalCyan};">${territory}</span>
          </div>
        </div>

        <button id="go-restart" style="
          background:${T.rust};
          border:1px solid ${T.blood};
          color:${T.bg};
          font:bold 14px ${T.font};
          padding:14px 40px;
          border-radius:3px;
          cursor:pointer;
          letter-spacing:2px;
          margin-top:4px;
        ">PLAY AGAIN</button>
      </div>
    `

    this.el.classList.remove('hidden')
    this.el.querySelector('#go-restart')?.addEventListener('click', () => location.reload())

    // Count-up animations
    this.animateCountUp('#go-kills', kills, 1200)
    this.animateCountUp('#go-score', score, 1500)
  }

  private animateCountUp(selector: string, target: number, durationMs: number): void {
    const el = this.el.querySelector(selector) as HTMLElement | null
    if (!el) return
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(1, elapsed / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      el.textContent = Math.floor(eased * target).toString()
      if (progress < 1) requestAnimationFrame(tick)
    }
    tick()
  }

  hide(): void {
    this.el.classList.add('hidden')
  }
}

function statRow(): string {
  return `display:flex;justify-content:space-between;align-items:center;font:12px ${T.font};`
}
