import { Game } from '../core/Game'
import { WEAPON_PROFILES } from '../data/weaponData'
import { T } from './theme'
import { getIcon } from './icons'

interface StatUpgradeDef {
  key: keyof import('../entities/Player').PlayerStats
  label: string
  desc: string
  icon: string
  baseCost: number
  maxPurchases: number
  apply: (player: import('../entities/Player').Player, purchases: number) => void
}

const STAT_UPGRADES: StatUpgradeDef[] = [
  {
    key: 'maxHp',
    label: 'Max HP',
    desc: '+25 max health, heals 12',
    icon: 'heart',
    baseCost: 40,
    maxPurchases: 10,
    apply: (p) => { p.stats.maxHp += 25; p.stats.hp = Math.min(p.stats.hp + 12, p.stats.maxHp) },
  },
  {
    key: 'damage',
    label: 'Damage',
    desc: '+5 bullet damage',
    icon: 'zap',
    baseCost: 50,
    maxPurchases: 10,
    apply: (p) => { p.stats.damage += 5 },
  },
  {
    key: 'speed',
    label: 'Speed',
    desc: '+20 movement speed',
    icon: 'activity',
    baseCost: 45,
    maxPurchases: 6,
    apply: (p) => { p.stats.speed += 20 },
  },
  {
    key: 'armor',
    label: 'Armor',
    desc: '+2 damage reduction',
    icon: 'shield',
    baseCost: 55,
    maxPurchases: 8,
    apply: (p) => { p.stats.armor += 2 },
  },
  {
    key: 'critChance',
    label: 'Crit Chance',
    desc: '+5% critical hit chance',
    icon: 'eye',
    baseCost: 60,
    maxPurchases: 8,
    apply: (p) => { p.stats.critChance = Math.min(0.8, p.stats.critChance + 0.05) },
  },
  {
    key: 'pickupRange',
    label: 'Pickup Range',
    desc: '+20 auto-collect radius',
    icon: 'expand',
    baseCost: 30,
    maxPurchases: 5,
    apply: (p) => { p.stats.pickupRange += 20 },
  },
]

// Weapon class icons
const WEAPON_ICONS: Record<string, string> = {
  pistol:       'crosshair',
  shotgun:      'zap',
  assaultRifle: 'activity',
  smg:          'arrow-right',
  sniperRifle:  'eye',
}

export class BreakPanel {
  private el: HTMLElement
  private statPurchases: number[] = STAT_UPGRADES.map(() => 0)
  private liveUpdateInterval: number | null = null

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
    this.startLiveUpdate()
  }

  hide(): void {
    this.el.classList.remove('panel-open')
    setTimeout(() => this.el.classList.add('panel-hidden'), 290)
    this.stopLiveUpdate()
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

  // Live-update resource bar and button states without full re-render
  private startLiveUpdate(): void {
    this.stopLiveUpdate()
    this.liveUpdateInterval = window.setInterval(() => {
      if (!this.isVisible) { this.stopLiveUpdate(); return }
      this.updateResourceBar()
      this.updateButtonStates()
      this.updateTimer()
    }, 120)
  }

  private stopLiveUpdate(): void {
    if (this.liveUpdateInterval !== null) {
      clearInterval(this.liveUpdateInterval)
      this.liveUpdateInterval = null
    }
  }

  private updateResourceBar(): void {
    const res = this.game.resources.res
    const bar = this.el.querySelector('#bp-res-bar') as HTMLElement | null
    if (!bar) return
    bar.innerHTML = this.resourceBarHTML(res)
  }

  private updateButtonStates(): void {
    const g = this.game
    const res = g.resources.res
    const p = g.player

    // Stat upgrade buttons
    this.el.querySelectorAll<HTMLElement>('.bp-stat-up').forEach(btn => {
      const idx = parseInt(btn.dataset.idx!)
      const u = STAT_UPGRADES[idx]
      const purchases = this.statPurchases[idx]
      const maxed = purchases >= u.maxPurchases
      const cost = Math.floor(u.baseCost * (1 + purchases * 0.4))
      const canBuy = !maxed && res.coins >= cost
      this.applyBtnState(btn, T.orange, canBuy || maxed, maxed)
      const costEl = btn.querySelector('.bp-cost') as HTMLElement | null
      if (costEl) costEl.textContent = maxed ? 'MAX' : `¢${cost}`
      const stackEl = btn.querySelector('.bp-stack') as HTMLElement | null
      if (stackEl) stackEl.textContent = `${purchases}/${u.maxPurchases}`
    })

    // Supply buttons
    const ammoBtn = this.el.querySelector<HTMLElement>('#bp-buy-ammo')
    if (ammoBtn) this.applyBtnState(ammoBtn, T.amber, res.coins >= 20, false)

    const healBtn = this.el.querySelector<HTMLElement>('#bp-heal-player')
    if (healBtn) this.applyBtnState(healBtn, '#4CAF50', res.coins >= 30 && p.stats.hp < p.stats.maxHp, false)

    const repairBtn = this.el.querySelector<HTMLElement>('#bp-repair-base')
    if (repairBtn) this.applyBtnState(repairBtn, T.coreBlue, res.coins >= 60 && g.base.hp < g.base.maxHp, false)

    // (territory expand button removed — now manual via skill tree)

    // Weapon buttons
    this.el.querySelectorAll<HTMLElement>('.bp-buy-weapon').forEach(btn => {
      const id = btn.dataset.id!
      const wp = WEAPON_PROFILES.find(w => w.id === id)!
      const owned = g.player.hasWeapon(id)
      const active = g.player.currentWeapon.id === id
      const canBuy = !owned && wp.cost > 0 && res.coins >= wp.cost
      this.applyBtnState(btn, active ? T.amber : owned ? '#4CAF50' : T.iron, owned || canBuy, false)
    })
  }

  private applyBtnState(btn: HTMLElement, accent: string, enabled: boolean, maxed: boolean): void {
    btn.style.opacity = enabled ? '1' : '0.45'
    btn.style.borderLeftColor = enabled ? accent : '#2a1a0a'
    btn.style.cursor = enabled && !maxed ? 'pointer' : 'default'
    ;(btn as HTMLButtonElement).disabled = !enabled || maxed
  }

  private updateTimer(): void {
    const timerEl = this.el.querySelector('#bp-timer') as HTMLElement | null
    if (timerEl && this.game.phase === 'break') {
      timerEl.textContent = Math.ceil(this.game.waveManager.breakTimeLeft).toString()
    }
  }

  private resourceBarHTML(res: { coins: number; iron: number; energyCore: number; crystal: number }): string {
    return `
      <div style="display:flex;align-items:center;gap:4px;">
        ${getIcon('coins', 13, T.gold)}
        <span style="color:${T.gold};font:bold 12px ${T.font};">${res.coins}</span>
      </div>
      <div style="width:1px;height:14px;background:rgba(139,58,42,0.35);"></div>
      <div style="display:flex;align-items:center;gap:4px;">
        ${getIcon('hexagon', 13, T.ironGrey)}
        <span style="color:${T.ironGrey};font:bold 12px ${T.font};">${res.iron}</span>
      </div>
      <div style="width:1px;height:14px;background:rgba(139,58,42,0.35);"></div>
      <div style="display:flex;align-items:center;gap:4px;">
        ${getIcon('cpu', 13, T.coreBlue)}
        <span style="color:${T.coreBlue};font:bold 12px ${T.font};">${res.energyCore}</span>
      </div>
      <div style="width:1px;height:14px;background:rgba(139,58,42,0.35);"></div>
      <div style="display:flex;align-items:center;gap:4px;">
        ${getIcon('gem', 13, T.crystalCyan)}
        <span style="color:${T.crystalCyan};font:bold 12px ${T.font};">${res.crystal}</span>
      </div>
    `
  }

  private render(): void {
    const g = this.game
    const res = g.resources.res
    const p = g.player
    const isDuringWave = g.phase === 'playing'

    this.el.innerHTML = `
      <div style="
        background:rgba(14,9,5,0.99);
        min-height:100%;
        display:flex;flex-direction:column;
        border-left:2px solid ${T.rust};
      ">

        <!-- ── Header ── -->
        <div style="
          background:rgba(14,9,5,0.99);
          border-bottom:1px solid rgba(139,58,42,0.4);
          padding:16px 18px 14px;
          position:sticky;top:0;z-index:2;
          backdrop-filter:blur(4px);
        ">
          <!-- Title row -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="
                background:${T.rust};
                width:3px;height:22px;border-radius:2px;
                box-shadow: 0 0 8px ${T.rust};
              "></div>
              <div>
                <div style="color:${T.amber};font:bold 16px ${T.font};letter-spacing:2px;line-height:1;">
                  ${isDuringWave ? 'UPGRADES' : 'SUPPLY DEPOT'}
                </div>
                <div style="color:${T.iron};font:10px ${T.font};margin-top:2px;letter-spacing:0.5px;">
                  ${isDuringWave
                    ? 'Mid-wave · Esc or U to close'
                    : `Next wave in <span id="bp-timer" style="color:${T.amber};font-weight:bold;">${Math.ceil(g.waveManager.breakTimeLeft)}</span>s`
                  }
                </div>
              </div>
            </div>
            ${isDuringWave
              ? `<button id="bp-close" style="${S.iconBtn()}">${getIcon('x', 14, T.iron)}</button>`
              : `<button id="bp-skip" style="${S.skipBtn()}">
                  <span>SKIP</span>${getIcon('chevron-right', 14, T.bg)}
                </button>`
            }
          </div>

          <!-- Resource bar -->
          <div id="bp-res-bar" style="
            display:flex;align-items:center;gap:10px;flex-wrap:wrap;
            background:rgba(0,0,0,0.35);
            border:1px solid rgba(139,58,42,0.3);
            border-radius:4px;
            padding:8px 12px;
          ">
            ${this.resourceBarHTML(res)}
          </div>
        </div>

        <!-- ── Scrollable body ── -->
        <div style="padding:14px 18px 80px;display:flex;flex-direction:column;gap:12px;flex:1;overflow-y:auto;">

          <!-- Character section -->
          <div style="${S.section(T.orange)}">
            ${S.sectionHeader(T.orange, getIcon('user', 13, T.orange), 'CHARACTER')}

            <!-- Stat pills row -->
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
              ${[
                { icon: 'heart',      val: `${Math.ceil(p.stats.hp)}/${p.stats.maxHp}`, color: T.hpHigh },
                { icon: 'zap',        val: `${p.stats.damage}`,                         color: T.amber },
                { icon: 'shield',     val: `${p.stats.armor}`,                          color: T.coreBlue },
                { icon: 'eye',        val: `${Math.round(p.stats.critChance*100)}%`,     color: T.crystalCyan },
              ].map(s => `
                <div style="
                  display:flex;align-items:center;gap:4px;
                  background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);
                  border-radius:12px;padding:3px 8px;
                ">
                  ${getIcon(s.icon, 11, s.color)}
                  <span style="color:${s.color};font:bold 10px ${T.font};">${s.val}</span>
                </div>
              `).join('')}
            </div>

            <!-- Upgrade grid (2 columns) -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
              ${STAT_UPGRADES.map((u, i) => {
                const purchases = this.statPurchases[i]
                const maxed = purchases >= u.maxPurchases
                const cost = Math.floor(u.baseCost * (1 + purchases * 0.4))
                const canBuy = !maxed && res.coins >= cost
                const enabled = canBuy || maxed
                return `
                  <button class="bp-stat-up" data-idx="${i}" style="
                    background:rgba(0,0,0,0.3);
                    border:1px solid rgba(44,36,22,0.6);
                    border-left:3px solid ${enabled ? T.orange : '#2a1a0a'};
                    border-radius:3px;padding:8px 10px;
                    cursor:${canBuy ? 'pointer' : 'default'};
                    text-align:left;
                    opacity:${enabled ? '1' : '0.45'};
                    display:flex;flex-direction:column;gap:5px;
                    transition:opacity 0.15s,border-left-color 0.15s;
                  " ${canBuy ? '' : 'disabled'}>
                    <div style="display:flex;align-items:center;justify-content:space-between;">
                      <div style="display:flex;align-items:center;gap:6px;">
                        <span style="
                          display:flex;align-items:center;justify-content:center;
                          background:rgba(196,98,45,0.15);border-radius:4px;padding:3px;
                        ">${getIcon(u.icon, 13, maxed ? T.hpHigh : T.orange)}</span>
                        <span style="color:${maxed ? T.hpHigh : T.bg};font:bold 11px ${T.font};">${u.label}</span>
                      </div>
                      <span class="bp-stack" style="color:${T.iron};font:9px ${T.font};">${purchases}/${u.maxPurchases}</span>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;">
                      <span style="color:${T.iron};font:9px ${T.font};line-height:1.3;">${u.desc}</span>
                      <span class="bp-cost" style="
                        color:${maxed ? T.hpHigh : T.gold};
                        font:bold 10px ${T.font};
                        white-space:nowrap;margin-left:6px;
                      ">${maxed ? 'MAX' : `¢${cost}`}</span>
                    </div>
                    ${!maxed ? `
                      <div style="
                        height:2px;background:rgba(44,36,22,0.6);border-radius:1px;overflow:hidden;
                      ">
                        <div style="
                          height:100%;width:${Math.round(purchases/u.maxPurchases*100)}%;
                          background:linear-gradient(90deg,${T.rust},${T.amber});
                          border-radius:1px;transition:width 0.2s;
                        "></div>
                      </div>
                    ` : ''}
                  </button>`
              }).join('')}
            </div>
          </div>

          <!-- Supplies section -->
          <div style="${S.section('#4CAF50')}">
            ${S.sectionHeader('#4CAF50', getIcon('package', 13, '#4CAF50'), 'SUPPLIES')}
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${[
                {
                  id: 'bp-buy-ammo',
                  icon: 'crosshair',
                  label: 'Refill Ammo',
                  sub: 'Restore 2× mag capacity',
                  cost: '¢20',
                  costNum: 20,
                  accent: T.amber,
                  enabled: res.coins >= 20,
                },
                {
                  id: 'bp-heal-player',
                  icon: 'heart',
                  label: 'Medkit',
                  sub: `+50 HP  (${Math.ceil(p.stats.hp)}/${p.stats.maxHp})`,
                  cost: '¢30',
                  costNum: 30,
                  accent: '#4CAF50',
                  enabled: res.coins >= 30 && p.stats.hp < p.stats.maxHp,
                },
                {
                  id: 'bp-repair-base',
                  icon: 'refresh-cw',
                  label: 'Repair Base',
                  sub: '+200 Base HP',
                  cost: '¢60',
                  costNum: 60,
                  accent: T.coreBlue,
                  enabled: res.coins >= 60 && g.base.hp < g.base.maxHp,
                },
              ].map(item => `
                <button id="${item.id}" style="
                  background:rgba(0,0,0,0.3);
                  border:1px solid rgba(44,36,22,0.6);
                  border-left:3px solid ${item.enabled ? item.accent : '#2a1a0a'};
                  border-radius:3px;padding:9px 12px;
                  cursor:${item.enabled ? 'pointer' : 'default'};
                  opacity:${item.enabled ? '1' : '0.4'};
                  display:flex;align-items:center;gap:10px;
                  transition:opacity 0.15s;
                " ${item.enabled ? '' : 'disabled'}>
                  <span style="
                    display:flex;align-items:center;justify-content:center;
                    background:rgba(0,0,0,0.3);border-radius:5px;padding:5px;min-width:28px;
                  ">${getIcon(item.icon, 14, item.accent)}</span>
                  <span style="flex:1;">
                    <span style="display:block;color:${T.bg};font:bold 11px ${T.font};">${item.label}</span>
                    <span style="display:block;color:${T.iron};font:9px ${T.font};margin-top:1px;">${item.sub}</span>
                  </span>
                  <span style="
                    color:${T.gold};font:bold 11px ${T.font};
                    background:rgba(0,0,0,0.3);border-radius:3px;padding:3px 7px;
                    border:1px solid rgba(232,200,74,0.2);
                  ">${item.cost}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Weapons section -->
          <div style="${S.section(T.amber)}">
            ${S.sectionHeader(T.amber, getIcon('crosshair', 13, T.amber), 'WEAPONS')}
            <div style="display:flex;flex-direction:column;gap:5px;">
              ${WEAPON_PROFILES.map(wp => {
                const owned = g.player.hasWeapon(wp.id)
                const active = g.player.currentWeapon.id === wp.id
                const canBuy = !owned && wp.cost > 0 && res.coins >= wp.cost
                const accent = active ? T.amber : owned ? '#4CAF50' : T.iron
                const enabled = owned || canBuy
                const wIcon = WEAPON_ICONS[wp.class] ?? 'crosshair'
                return `
                  <button class="bp-buy-weapon" data-id="${wp.id}" style="
                    background:${active ? 'rgba(232,160,48,0.08)' : owned ? 'rgba(76,175,80,0.05)' : 'rgba(0,0,0,0.3)'};
                    border:1px solid ${active ? 'rgba(232,160,48,0.4)' : owned ? 'rgba(76,175,80,0.25)' : 'rgba(44,36,22,0.6)'};
                    border-left:3px solid ${enabled ? accent : '#2a1a0a'};
                    border-radius:3px;padding:8px 12px;
                    cursor:${canBuy ? 'pointer' : 'default'};
                    opacity:${enabled ? '1' : '0.4'};
                    display:flex;align-items:center;gap:10px;
                    transition:opacity 0.15s;
                  " ${owned || canBuy ? '' : 'disabled'}>
                    <span style="
                      display:flex;align-items:center;justify-content:center;
                      background:rgba(0,0,0,0.3);border-radius:5px;padding:5px;
                    ">${getIcon(wIcon, 13, accent)}</span>
                    <span style="flex:1;display:flex;flex-direction:column;gap:2px;">
                      <span style="color:${T.bg};font:bold 11px ${T.font};display:flex;align-items:center;gap:5px;">
                        ${active ? `${getIcon('check', 11, T.amber)} ` : owned ? `${getIcon('check', 11, '#4CAF50')} ` : ''}${wp.label}
                      </span>
                      <span style="color:${T.iron};font:9px ${T.font};">${wp.damage} dmg · ${wp.fireRate}/s · ${wp.magSize} mag</span>
                    </span>
                    <span style="
                      color:${active ? T.amber : owned ? '#4CAF50' : wp.cost === 0 ? T.iron : T.gold};
                      font:bold 10px ${T.font};
                      background:rgba(0,0,0,0.3);border-radius:3px;padding:3px 7px;
                      border:1px solid rgba(255,255,255,0.08);white-space:nowrap;
                    ">${active ? 'ACTIVE' : owned ? 'OWNED' : wp.cost === 0 ? 'DEFAULT' : `¢${wp.cost}`}</span>
                  </button>`
              }).join('')}
            </div>
          </div>

          <!-- Territory section -->
          <div style="${S.section(T.crystalCyan)}">
            ${S.sectionHeader(T.crystalCyan, getIcon('map', 13, T.crystalCyan), 'TERRITORY')}
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
              <div style="
                display:flex;align-items:center;gap:6px;
                background:rgba(0,0,0,0.3);border-radius:3px;padding:5px 10px;
              ">
                ${getIcon('expand', 11, T.crystalCyan)}
                <span style="color:${T.ironGrey};font:10px ${T.font};">Radius <span style="color:${T.crystalCyan};font-weight:bold;">${g.territory.radius}</span></span>
              </div>
              <div style="
                display:flex;align-items:center;gap:6px;
                background:rgba(0,0,0,0.3);border-radius:3px;padding:5px 10px;
              ">
                ${getIcon('gem', 11, T.crystalCyan)}
                <span style="color:${T.ironGrey};font:10px ${T.font};"><span style="color:${T.crystalCyan};font-weight:bold;">${res.crystal}</span> crystals</span>
              </div>
            </div>
            <div style="color:${T.iron};font:9px ${T.font};margin-bottom:8px;">
              Territory auto-expands after each boss wave. Use crystals to unlock base skills.
            </div>
            <button id="bp-skill-tree" style="
              background:rgba(136,238,255,0.06);
              border:1px solid rgba(136,238,255,0.35);
              border-left:3px solid ${T.crystalCyan};
              border-radius:3px;padding:11px 14px;
              cursor:pointer;
              display:flex;align-items:center;gap:12px;width:100%;
              transition:opacity 0.15s;
            ">
              ${getIcon('star', 16, T.crystalCyan)}
              <span style="flex:1;text-align:left;">
                <span style="display:block;color:${T.bg};font:bold 12px ${T.font};">Base Skill Tree</span>
                <span style="display:block;color:${T.iron};font:9px ${T.font};margin-top:2px;">Spend crystals to unlock base upgrades</span>
              </span>
              ${getIcon('chevron-right', 14, T.crystalCyan)}
            </button>
          </div>

        </div>

        <!-- ── Sticky footer ── -->
        <div style="
          position:sticky;bottom:0;
          padding:10px 18px;
          background:rgba(14,9,5,0.98);
          border-top:1px solid rgba(139,58,42,0.3);
        ">
          ${isDuringWave
            ? `<button id="bp-close-footer" style="${S.footerBtn(T.rust)}">
                ${getIcon('x', 13, T.bg)} CLOSE
              </button>`
            : `<button id="bp-skip-footer" style="${S.footerBtn(T.orange)}">
                SKIP BREAK ${getIcon('chevron-right', 14, T.bg)}
              </button>`
          }
        </div>
      </div>
    `

    this.bindEvents()
  }

  private bindEvents(): void {
    const g = this.game

    this.el.querySelector('#bp-skip')?.addEventListener('click', () => g.skipBreak())
    this.el.querySelector('#bp-skip-footer')?.addEventListener('click', () => g.skipBreak())
    this.el.querySelector('#bp-close')?.addEventListener('click', () => this.hide())
    this.el.querySelector('#bp-close-footer')?.addEventListener('click', () => this.hide())

    this.el.querySelector('#bp-skill-tree')?.addEventListener('click', () => {
      g.openBaseSkillTree()
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
        g.hud.showMessage(`${u.label} upgraded`, T.amber)
        this.show()
      })
    })

    this.el.querySelectorAll('.bp-buy-weapon').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!
        const wp = WEAPON_PROFILES.find(w => w.id === id)!
        if (g.player.hasWeapon(id)) {
          // Already owned — switch to it
          const idx = g.player.ownedWeapons.findIndex(s => s.profile.id === id)
          g.player.switchToSlot(idx, g.hud)
          this.show()
          return
        }
        if (wp.cost === 0) return
        if (!g.resources.spend({ coins: wp.cost })) return
        g.player.addWeapon(wp)
        g.hud.showMessage(`${wp.label} acquired`, T.amber)
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
  section: (accent: string) =>
    `background:rgba(0,0,0,0.25);` +
    `border:1px solid rgba(44,36,22,0.5);` +
    `border-left:3px solid ${accent};` +
    `border-radius:4px;padding:12px 14px;`,

  sectionHeader: (color: string, iconHtml: string, title: string) =>
    `<div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;` +
    `padding-bottom:6px;border-bottom:1px solid ${color}22;">` +
    `${iconHtml}` +
    `<span style="color:${color};font:bold 11px 'Russo One',sans-serif;letter-spacing:2px;">${title}</span>` +
    `</div>`,

  skipBtn: () =>
    `background:rgba(196,98,45,0.18);border:1px solid ${T.orange};` +
    `color:${T.bg};font:bold 10px 'Russo One',sans-serif;` +
    `padding:5px 10px;border-radius:3px;cursor:pointer;letter-spacing:1px;` +
    `display:flex;align-items:center;gap:5px;`,

  iconBtn: () =>
    `background:transparent;border:1px solid rgba(139,58,42,0.35);` +
    `color:${T.iron};padding:5px 7px;border-radius:3px;cursor:pointer;` +
    `display:flex;align-items:center;`,

  footerBtn: (accent: string) =>
    `background:${accent};border:1px solid ${accent};` +
    `color:${T.bg};font:bold 12px 'Russo One',sans-serif;` +
    `padding:11px;width:100%;border-radius:3px;cursor:pointer;letter-spacing:1px;` +
    `display:flex;align-items:center;justify-content:center;gap:6px;`,
}
