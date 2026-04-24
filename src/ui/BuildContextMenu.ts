import { Game } from '../core/Game'
import { TOWER_PROFILES, TowerType } from '../towers/TowerTypes'
import { T } from './theme'

export class BuildContextMenu {
  private el: HTMLElement
  private pendingWorldX = 0
  private pendingWorldY = 0
  visible = false

  constructor(private game: Game) {
    this.el = document.getElementById('build-context-menu')!
    this.el.classList.add('hidden')
    this.bindGlobalClose()
  }

  show(screenX: number, screenY: number, worldX: number, worldY: number): void {
    this.pendingWorldX = worldX
    this.pendingWorldY = worldY

    const g = this.game
    const res = g.resources.res
    const inTerritory = g.territory.isInsideTerritory(worldX, worldY, g.base.x, g.base.y)

    this.el.innerHTML = `
      <div style="
        background:rgba(20,14,8,0.96);
        border:1px solid ${T.rust};
        border-radius:3px;
        padding:10px;
        min-width:220px;
        display:flex;flex-direction:column;gap:4px;
        box-shadow:0 8px 32px rgba(0,0,0,0.8),0 0 0 1px rgba(139,58,42,0.2);
        font-family:${T.font};
      ">
        <div style="color:${T.iron};font:bold 9px ${T.font};padding:2px 6px;letter-spacing:2px;border-bottom:1px solid rgba(139,58,42,0.3);margin-bottom:2px;padding-bottom:6px;">BUILD TOWER</div>
        ${!inTerritory
          ? `<div style="color:${T.blood};font:10px ${T.font};padding:4px 6px;border-left:3px solid ${T.blood};">Outside territory — expand first</div>`
          : ''
        }
        ${Object.values(TOWER_PROFILES).map(tp => {
          const canAfford = res.iron >= tp.costIron && res.energyCore >= tp.costCore
          const blocked = !inTerritory || !canAfford
          return `
            <button class="bcm-tower-btn" data-type="${tp.type}"
              ${blocked ? 'disabled' : ''}
              style="
                background:${blocked ? 'rgba(28,20,12,0.5)' : 'rgba(196,98,45,0.1)'};
                border:1px solid rgba(44,36,22,0.5);
                border-left:3px solid ${blocked ? '#2a1a0a' : T.orange};
                color:${blocked ? '#5a4a3a' : T.bg};
                font:11px ${T.font};padding:7px 10px;border-radius:2px;
                cursor:${blocked ? 'not-allowed' : 'pointer'};
                text-align:left;display:flex;justify-content:space-between;align-items:center;
              ">
              <span style="color:${blocked ? '#5a4a3a' : T.amber};">${tp.label}</span>
              <span style="color:${T.iron};font-size:10px;">⬡${tp.costIron}${tp.costCore > 0 ? ` ◈${tp.costCore}` : ''}</span>
            </button>
          `
        }).join('')}
        <div style="border-top:1px solid rgba(44,36,22,0.4);margin-top:2px;padding-top:4px;">
          <button id="bcm-cancel" style="
            background:none;border:none;color:${T.iron};font:10px ${T.font};
            cursor:pointer;padding:4px 6px;width:100%;text-align:left;letter-spacing:0.5px;
          ">Cancel (Esc)</button>
        </div>
      </div>
    `

    const menuW = 230, menuH = 280
    const x = Math.min(screenX, window.innerWidth - menuW - 8)
    const y = Math.min(screenY, window.innerHeight - menuH - 8)
    this.el.style.left = `${x}px`
    this.el.style.top = `${y}px`
    this.el.classList.remove('hidden')
    this.visible = true

    this.el.querySelectorAll('.bcm-tower-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const type = (btn as HTMLElement).dataset.type as TowerType
        this.hide()
        this.game.placeTower(this.pendingWorldX, this.pendingWorldY, type)
      })
    })
    this.el.querySelector('#bcm-cancel')?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.hide()
    })
  }

  hide(): void {
    this.el.classList.add('hidden')
    this.visible = false
  }

  private bindGlobalClose(): void {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        this.hide()
        this.game.buildMode = false
        this.game.pendingTowerType = null
      }
    })
    document.addEventListener('click', (e) => {
      if (this.visible && !this.el.contains(e.target as Node)) {
        this.hide()
      }
    })
  }
}
