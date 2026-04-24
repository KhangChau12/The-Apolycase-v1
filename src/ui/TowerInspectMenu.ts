import { Game } from '../core/Game'
import { Tower } from '../towers/Tower'
import { T } from './theme'

export class TowerInspectMenu {
  private el: HTMLElement
  private tower: Tower | null = null
  private towerIndex = -1
  visible = false

  constructor(private game: Game) {
    this.el = document.getElementById('tower-inspect-menu')!
    this.el.classList.add('hidden')
    this.bindGlobalClose()
  }

  show(screenX: number, screenY: number, tower: Tower, index: number): void {
    this.tower = tower
    this.towerIndex = index
    this.render(screenX, screenY)
    this.el.classList.remove('hidden')
    this.visible = true
  }

  hide(): void {
    this.el.classList.add('hidden')
    this.visible = false
    this.tower = null
    this.towerIndex = -1
    this.game.inspectedTower = null
  }

  private render(screenX: number, screenY: number): void {
    const t = this.tower!
    const g = this.game
    const res = g.resources.res
    const isMaxed = t.level >= 3
    const upgCost = { iron: t.level * 15, core: t.level * 5 }
    const canUpgrade = !isMaxed && res.iron >= upgCost.iron && res.energyCore >= upgCost.core

    const nextDmg    = t.profile.damage * (t.level + 1)
    const nextHp     = t.profile.hp * (t.level + 1)
    const nextRepair = t.profile.type === 'repairTower' ? 3 * (t.level + 1) : null
    void nextRepair

    const hpPct = t.hp / t.maxHp

    const typeAccent: Record<string, string> = {
      barricade:      T.rust,
      fireTower:      T.orange,
      electricTower:  T.coreBlue,
      repairTower:    '#4CAF50',
      machineGunTower:T.amber,
    }
    const accent = typeAccent[t.profile.type] ?? T.iron

    this.el.innerHTML = `
      <div style="
        background:rgba(20,14,8,0.96);
        border:1px solid ${T.rust};
        border-left:3px solid ${accent};
        border-radius:3px;
        padding:14px;min-width:240px;max-width:270px;
        display:flex;flex-direction:column;gap:10px;
        box-shadow:0 6px 24px rgba(0,0,0,0.8);
        font-family:${T.font};
      ">

        <!-- Title row -->
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="color:${accent};font:bold 13px ${T.font};letter-spacing:0.5px;">${t.profile.label}</div>
            <div style="color:${T.iron};font:10px ${T.font};">Level ${t.level}${isMaxed ? ' · MAX' : ` → ${t.level + 1} available`}</div>
          </div>
          <button id="tim-close" style="
            background:none;border:none;color:${T.iron};font:12px ${T.font};cursor:pointer;
            padding:2px 5px;border-radius:2px;line-height:1;
          " title="Close">✕</button>
        </div>

        <!-- HP bar -->
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span style="color:${T.iron};font:10px ${T.font};">HP</span>
            <span style="color:${T.hpColor(hpPct)};font:10px ${T.font};">${Math.ceil(t.hp)} / ${t.maxHp}</span>
          </div>
          <div style="background:rgba(44,36,22,0.7);border-radius:2px;height:6px;overflow:hidden;">
            <div style="width:${hpPct * 100}%;height:100%;background:${T.hpColor(hpPct)};transition:width 0.1s;"></div>
          </div>
        </div>

        <!-- Current stats -->
        <div style="background:rgba(44,28,20,0.5);border-radius:2px;padding:8px 10px;display:flex;flex-direction:column;gap:4px;">
          <div style="color:${T.iron};font:bold 9px ${T.font};letter-spacing:1px;margin-bottom:2px;">STATS</div>
          ${t.profile.range > 0
            ? `<div style="${statRow()}"><span style="color:${T.iron};">Range</span><span style="color:${T.bg};">${t.profile.range}px</span></div>`
            : ''
          }
          ${t.profile.damage > 0
            ? `<div style="${statRow()}"><span style="color:${T.iron};">Damage</span><span style="color:${T.bg};">${t.profile.damage * t.level}</span></div>`
            : ''
          }
          ${t.profile.fireRate > 0
            ? `<div style="${statRow()}"><span style="color:${T.iron};">Fire Rate</span><span style="color:${T.bg};">${t.profile.fireRate}/s</span></div>`
            : ''
          }
          ${t.profile.type === 'repairTower'
            ? `<div style="${statRow()}"><span style="color:${T.iron};">Worker</span><span style="color:#4CAF50;">Active</span></div>`
            : ''
          }
          <div style="${statRow()}"><span style="color:${T.iron};">Max HP</span><span style="color:${T.bg};">${t.maxHp}</span></div>
        </div>

        <!-- After-upgrade preview -->
        ${!isMaxed ? `
        <div style="background:rgba(20,44,20,0.5);border:1px solid rgba(76,175,80,0.3);border-radius:2px;padding:8px 10px;display:flex;flex-direction:column;gap:4px;">
          <div style="color:#4CAF50;font:bold 9px ${T.font};letter-spacing:1px;margin-bottom:2px;">AFTER UPGRADE (LV${t.level + 1})</div>
          ${t.profile.damage > 0
            ? `<div style="${statRow()}">
                <span style="color:${T.iron};">Damage</span>
                <span style="color:#4CAF50;">${t.profile.damage * t.level} → ${nextDmg}</span>
               </div>`
            : ''
          }
          ${nextRepair !== null
            ? `<div style="${statRow()}">
                <span style="color:${T.iron};">Heal/s</span>
                <span style="color:#4CAF50;">${3 * t.level} → ${nextRepair} HP</span>
               </div>`
            : ''
          }
          <div style="${statRow()}">
            <span style="color:${T.iron};">Max HP</span>
            <span style="color:#4CAF50;">${t.maxHp} → ${nextHp}</span>
          </div>
          <div style="${statRow()};margin-top:4px;">
            <span style="color:${T.iron};">Cost</span>
            <span style="color:${canUpgrade ? T.amber : '#5a4a3a'};">⬡${upgCost.iron} ◈${upgCost.core}</span>
          </div>
        </div>
        ` : `
        <div style="background:rgba(139,58,42,0.15);border:1px solid rgba(139,58,42,0.3);border-radius:2px;padding:8px 10px;text-align:center;">
          <span style="color:${T.orange};font:11px ${T.font};letter-spacing:1px;">MAX LEVEL</span>
        </div>
        `}

        <!-- Sell info -->
        <div style="color:${T.iron};font:9px ${T.font};text-align:right;">
          Sell refund: ⬡${Math.floor(t.profile.costIron * 0.5)} ◈${Math.floor(t.profile.costCore * 0.5)}
        </div>

        <!-- Action buttons -->
        <div style="display:flex;gap:6px;">
          ${!isMaxed ? `
          <button id="tim-upgrade" style="
            background:${canUpgrade ? 'rgba(76,175,80,0.15)' : 'rgba(20,12,8,0.5)'};
            border:1px solid ${canUpgrade ? 'rgba(76,175,80,0.4)' : '#2a1a0a'};
            color:${canUpgrade ? '#4CAF50' : '#5a4a3a'};
            font:bold 11px ${T.font};padding:7px 10px;border-radius:2px;cursor:pointer;flex:1;
          " ${canUpgrade ? '' : 'disabled'}>
            Upgrade LV${t.level + 1}
          </button>` : ''}
          <button id="tim-sell" style="
            background:rgba(139,58,42,0.15);
            border:1px solid ${T.rust};
            color:${T.blood};
            font:bold 11px ${T.font};padding:7px 10px;border-radius:2px;cursor:pointer;flex:1;
          ">Sell</button>
        </div>
      </div>
    `

    const menuW = 280, menuH = 400
    const x = Math.min(screenX + 12, window.innerWidth - menuW - 8)
    const y = Math.min(screenY, window.innerHeight - menuH - 8)
    this.el.style.left = `${x}px`
    this.el.style.top  = `${y}px`

    this.bindMenuEvents()
    this.game.inspectedTower = this.tower
  }

  private bindMenuEvents(): void {
    const g = this.game
    const t = this.tower!
    const idx = this.towerIndex

    this.el.querySelector('#tim-close')?.addEventListener('click', (e) => {
      e.stopPropagation(); this.hide()
    })

    this.el.querySelector('#tim-upgrade')?.addEventListener('click', (e) => {
      e.stopPropagation()
      const upgCost = { iron: t.level * 15, energyCore: t.level * 5 }
      if (!g.resources.spend(upgCost)) return
      t.upgrade()
      g.hud.showMessage(`${t.profile.label} → LV${t.level}`, T.amber)
      const rect = this.el.getBoundingClientRect()
      this.render(rect.left - 12, rect.top)
    })

    this.el.querySelector('#tim-sell')?.addEventListener('click', (e) => {
      e.stopPropagation()
      g.resources.add({
        iron:        Math.floor(t.profile.costIron * 0.5),
        energyCore:  Math.floor(t.profile.costCore * 0.5),
      })
      g.towers.splice(idx, 1)
      g.hud.showMessage(`${t.profile.label} sold`, T.iron)
      this.hide()
    })
  }

  private bindGlobalClose(): void {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this.hide()
    })
    document.addEventListener('click', (e) => {
      if (this.visible && !this.el.contains(e.target as Node)) this.hide()
    })
  }
}

function statRow(): string {
  return `display:flex;justify-content:space-between;font:11px ${T.font};`
}
