import { Game } from '../core/Game'
import { WEAPON_PROFILES } from '../data/weaponData'
import { T } from './theme'

interface StatUpgradeDef {
  key: keyof import('../entities/Player').PlayerStats
  label: string
  desc: string
  baseCost: number
  maxPurchases: number
  apply: (player: import('../entities/Player').Player, purchases: number) => void
}

const STAT_UPGRADES: StatUpgradeDef[] = [
  {
    key: 'maxHp',
    label: 'Max HP +25',
    desc: 'Increases max health and heals for half.',
    baseCost: 40,
    maxPurchases: 10,
    apply: (p) => { p.stats.maxHp += 25; p.stats.hp = Math.min(p.stats.hp + 12, p.stats.maxHp) },
  },
  {
    key: 'damage',
    label: 'Damage +5',
    desc: 'Increases bullet damage.',
    baseCost: 50,
    maxPurchases: 10,
    apply: (p) => { p.stats.damage += 5 },
  },
  {
    key: 'speed',
    label: 'Speed +20',
    desc: 'Increases movement speed.',
    baseCost: 45,
    maxPurchases: 6,
    apply: (p) => { p.stats.speed += 20 },
  },
  {
    key: 'armor',
    label: 'Armor +2',
    desc: 'Reduces damage taken per hit.',
    baseCost: 55,
    maxPurchases: 8,
    apply: (p) => { p.stats.armor += 2 },
  },
  {
    key: 'critChance',
    label: 'Crit Chance +5%',
    desc: 'Critical hits deal double damage.',
    baseCost: 60,
    maxPurchases: 8,
    apply: (p) => { p.stats.critChance = Math.min(0.8, p.stats.critChance + 0.05) },
  },
  {
    key: 'pickupRange',
    label: 'Pickup Range +20',
    desc: 'Auto-collect drops from further away.',
    baseCost: 30,
    maxPurchases: 5,
    apply: (p) => { p.stats.pickupRange += 20 },
  },
]

export class BreakPanel {
  private el: HTMLElement
  private statPurchases: number[] = STAT_UPGRADES.map(() => 0)

  constructor(private game: Game) {
    this.el = document.getElementById('break-panel')!
  }

  get isVisible(): boolean {
    return this.el.classList.contains('panel-open')
  }

  show(): void {
    this.el.classList.remove('panel-hidden')
    requestAnimationFrame(() => this.el.classList.add('panel-open'))
    this.render()
  }

  hide(): void {
    this.el.classList.remove('panel-open')
    setTimeout(() => this.el.classList.add('panel-hidden'), 290)
    if (this.game.phase === 'break') {
      this.game.buildMode = false
      this.game.pendingTowerType = null
    } else {
      this.game.paused = false
    }
  }

  toggle(): void {
    if (this.isVisible) this.hide()
    else this.show()
  }

  private render(): void {
    const g = this.game
    const res = g.resources.res
    const crystalCost = g.territory.crystalCostForNextExpansion(res.crystal)
    const canExpand = res.crystal >= crystalCost
    const p = g.player
    const isDuringWave = g.phase === 'playing'

    this.el.innerHTML = `
      <div style="
        background:rgba(20,12,8,0.98);
        min-height:100%;
        display:flex;flex-direction:column;
        border-left:2px solid ${T.rust};
      ">
        <!-- Header -->
        <div style="
          background:rgba(20,12,8,0.99);
          border-bottom:2px solid ${T.rust};
          padding:14px 16px 12px;
          position:sticky;top:0;z-index:2;
        ">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="color:${T.amber};font:bold 18px ${T.font};letter-spacing:1px;">
                ${isDuringWave ? 'UPGRADES' : 'SUPPLY DEPOT'}
              </div>
              <div style="color:${T.iron};font:11px ${T.font};margin-top:2px;">
                ${isDuringWave
                  ? 'Mid-wave · Esc or U to close'
                  : `Wave in <span id="bp-timer">${Math.ceil(g.waveManager.breakTimeLeft)}</span>s · Build &amp; upgrade freely`
                }
              </div>
            </div>
            ${isDuringWave
              ? `<button id="bp-close" style="${S.closeBtn()}">✕</button>`
              : `<button id="bp-skip" style="${S.closeBtn()}">SKIP ▶</button>`
            }
          </div>
          <!-- Resources -->
          <div style="
            display:flex;gap:12px;flex-wrap:wrap;
            background:rgba(139,58,42,0.12);
            border:1px solid rgba(139,58,42,0.3);
            border-radius:3px;padding:6px 10px;margin-top:10px;
          ">
            <span style="color:${T.gold};font:bold 11px ${T.font};">¢${res.coins}</span>
            <span style="color:${T.ironGrey};font:bold 11px ${T.font};">⬡${res.iron}</span>
            <span style="color:${T.coreBlue};font:bold 11px ${T.font};">◈${res.energyCore}</span>
            <span style="color:${T.crystalCyan};font:bold 11px ${T.font};">✦${res.crystal}</span>
          </div>
        </div>

        <!-- Scrollable content -->
        <div style="padding:12px 16px 80px;display:flex;flex-direction:column;gap:10px;flex:1;">

          <!-- Character upgrades -->
          <div style="${S.section(T.orange)}">
            <div style="${S.sectionTitle(T.orange)}">CHARACTER</div>
            <div style="color:${T.iron};font:9px ${T.font};margin-bottom:8px;">
              LV${p.stats.level} · ${Math.ceil(p.stats.hp)}/${p.stats.maxHp} HP ·
              ${p.stats.damage} DMG · ${p.stats.armor} ARMOR · ${Math.round(p.stats.critChance*100)}% CRIT
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              ${STAT_UPGRADES.map((u, i) => {
                const purchases = this.statPurchases[i]
                const maxed = purchases >= u.maxPurchases
                const cost = Math.floor(u.baseCost * (1 + purchases * 0.4))
                const canBuy = !maxed && res.coins >= cost
                return `<button class="bp-stat-up" data-idx="${i}"
                  style="${S.btn(T.orange, canBuy)};display:flex;justify-content:space-between;"
                  ${canBuy ? '' : 'disabled'}>
                  <span>${maxed ? '✓ ' : ''}${u.label}${maxed ? ' MAX' : ''}</span>
                  <span style="color:${T.iron};font-size:10px;">${maxed ? '' : `¢${cost}`}</span>
                </button>`
              }).join('')}
            </div>
          </div>

          <!-- Supplies -->
          <div style="${S.section(T.amber)}">
            <div style="${S.sectionTitle(T.amber)}">SUPPLIES</div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              <button id="bp-buy-ammo" style="${S.btn(T.amber, res.coins>=20)};display:flex;justify-content:space-between;" ${res.coins>=20?'':'disabled'}>
                <span>Refill Ammo</span><span style="color:${T.iron};font-size:10px;">¢20</span>
              </button>
              <button id="bp-heal-player" style="${S.btn('#4CAF50', res.coins>=30)};display:flex;justify-content:space-between;" ${res.coins>=30?'':'disabled'}>
                <span>Heal +50 HP</span><span style="color:${T.iron};font-size:10px;">¢30</span>
              </button>
              <button id="bp-repair-base" style="${S.btn(T.coreBlue, res.coins>=60)};display:flex;justify-content:space-between;" ${res.coins>=60?'':'disabled'}>
                <span>Repair Base +200 HP</span><span style="color:${T.iron};font-size:10px;">¢60</span>
              </button>
            </div>
          </div>

          <!-- Weapons -->
          <div style="${S.section(T.amber)}">
            <div style="${S.sectionTitle(T.amber)}">WEAPONS</div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              ${WEAPON_PROFILES.map(wp => {
                const owned = g.player.currentWeapon.id === wp.id
                const canBuy = !owned && wp.cost > 0 && res.coins >= wp.cost
                return `<button class="bp-buy-weapon" data-id="${wp.id}"
                  style="${S.btn(owned ? '#4CAF50' : T.amber, owned || canBuy)};display:flex;justify-content:space-between;"
                  ${owned || canBuy ? '' : 'disabled'}>
                  <span>${owned ? '✓ ' : ''}${wp.label}</span>
                  <span style="color:${T.iron};font-size:10px;">${wp.cost===0?'Default':`¢${wp.cost}`} · ${wp.damage}dmg</span>
                </button>`
              }).join('')}
            </div>
          </div>

          <!-- Territory -->
          <div style="${S.section(T.crystalCyan)}">
            <div style="${S.sectionTitle(T.crystalCyan)}">TERRITORY</div>
            <div style="color:${T.iron};font:9px ${T.font};margin-bottom:6px;">
              Radius ${g.territory.radius} · Unlock new skill slot
            </div>
            <button id="bp-expand"
              style="${S.btn(T.crystalCyan, canExpand)};display:flex;justify-content:space-between;"
              ${canExpand?'':'disabled'}>
              <span>Expand + Unlock Skill</span>
              <span style="color:${T.iron};font-size:10px;">✦${crystalCost}</span>
            </button>
          </div>

        </div>

        <!-- Sticky footer -->
        <div style="
          position:sticky;bottom:0;
          padding:10px 16px;
          background:rgba(20,12,8,0.98);
          border-top:1px solid rgba(139,58,42,0.3);
        ">
          ${isDuringWave
            ? `<button id="bp-close-footer" style="
                background:${T.rust};border:1px solid ${T.blood};
                color:${T.bg};font:bold 12px ${T.font};
                padding:10px;width:100%;border-radius:3px;cursor:pointer;
                letter-spacing:1px;
              ">CLOSE PANEL</button>`
            : `<button id="bp-skip-footer" style="
                background:${T.rust};border:1px solid ${T.orange};
                color:${T.bg};font:bold 12px ${T.font};
                padding:10px;width:100%;border-radius:3px;cursor:pointer;
                letter-spacing:1px;
              ">SKIP BREAK ▶</button>`
          }
        </div>
      </div>
    `

    this.bindEvents()
    if (this.game.phase !== 'playing') this.startTimerTick()
  }

  private startTimerTick(): void {
    const tick = () => {
      const timerEl = this.el.querySelector('#bp-timer')
      if (!timerEl || !this.isVisible) return
      timerEl.textContent = Math.ceil(this.game.waveManager.breakTimeLeft).toString()
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  private bindEvents(): void {
    const g = this.game

    this.el.querySelector('#bp-skip')?.addEventListener('click', () => g.skipBreak())
    this.el.querySelector('#bp-skip-footer')?.addEventListener('click', () => g.skipBreak())
    this.el.querySelector('#bp-close')?.addEventListener('click', () => this.hide())
    this.el.querySelector('#bp-close-footer')?.addEventListener('click', () => this.hide())

    this.el.querySelector('#bp-expand')?.addEventListener('click', () => {
      g.expandTerritory()
      this.show()
    })

    this.el.querySelectorAll('.bp-stat-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.idx!)
        const u = STAT_UPGRADES[idx]
        const purchases = this.statPurchases[idx]
        const cost = Math.floor(u.baseCost * (1 + purchases * 0.4))
        if (!g.resources.spend({ coins: cost })) return
        u.apply(g.player, purchases)
        this.statPurchases[idx]++
        g.hud.showMessage(u.label, T.amber)
        this.show()
      })
    })

    this.el.querySelectorAll('.bp-buy-weapon').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!
        const wp = WEAPON_PROFILES.find(w => w.id === id)!
        if (wp.cost === 0 || g.player.currentWeapon.id === id) return
        if (!g.resources.spend({ coins: wp.cost })) return
        g.player.equipWeapon(wp)
        g.hud.showMessage(`Equipped ${wp.label}`, T.amber)
        this.show()
      })
    })

    this.el.querySelector('#bp-buy-ammo')?.addEventListener('click', () => {
      if (!g.resources.spend({ coins: 20 })) return
      g.player.reserveAmmo += g.player.currentWeapon.magSize * 2
      g.hud.showMessage('+Ammo', T.amber)
      this.show()
    })

    this.el.querySelector('#bp-heal-player')?.addEventListener('click', () => {
      if (!g.resources.spend({ coins: 30 })) return
      g.player.stats.hp = Math.min(g.player.stats.maxHp, g.player.stats.hp + 50)
      g.hud.showMessage('+50 HP', '#4CAF50')
      this.show()
    })

    this.el.querySelector('#bp-repair-base')?.addEventListener('click', () => {
      if (!g.resources.spend({ coins: 60 })) return
      g.base.hp = Math.min(g.base.maxHp, g.base.hp + 200)
      g.hud.showMessage('Base +200 HP', T.coreBlue)
      this.show()
    })
  }
}

const S = {
  btn: (accent: string, enabled: boolean) =>
    `background:${enabled ? `rgba(20,12,8,0.8)` : 'rgba(20,12,8,0.4)'};` +
    `border-left:3px solid ${enabled ? accent : '#2a1a0a'};border:1px solid rgba(44,36,22,0.5);` +
    `border-left:3px solid ${enabled ? accent : '#2a1a0a'};` +
    `color:${enabled ? T.bg : T.iron};font:11px ${T.font};` +
    `padding:7px 10px;border-radius:2px;cursor:pointer;width:100%;text-align:left;`,

  section: (accent: string) =>
    `background:rgba(20,12,8,0.6);border:1px solid rgba(44,36,22,0.5);` +
    `border-left:3px solid ${accent};border-radius:2px;padding:10px 12px;`,

  sectionTitle: (color: string) =>
    `color:${color};font:bold 11px ${T.font};letter-spacing:2px;` +
    `margin-bottom:8px;text-transform:uppercase;` +
    `border-bottom:1px solid ${color}33;padding-bottom:4px;`,

  closeBtn: () =>
    `background:transparent;border:1px solid ${T.rust};color:${T.iron};` +
    `font:bold 10px ${T.font};padding:4px 8px;border-radius:2px;cursor:pointer;` +
    `letter-spacing:1px;`,
}
