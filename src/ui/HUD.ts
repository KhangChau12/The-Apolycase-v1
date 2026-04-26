import { Game } from '../core/Game'
import { T } from './theme'
import { getIcon } from './icons'
import { PLAYER_SKILL_POOL } from '../data/playerSkillPool'

interface Message { text: string; color: string; expiry: number }

const WEAPON_CLASS_ABBR: Record<string, string> = {
  pistol:       'PSTL',
  shotgun:      'SHOT',
  assaultRifle: 'AR',
  smg:          'SMG',
  sniperRifle:  'SNP',
}

// Slot size matches inactive weapon slot (40px)
const UPG_SLOT_SIZE = 40

type HudLayoutMode = 'normal' | 'compact' | 'ultra'

export class HUD {
  private el: HTMLElement
  private messages: Message[] = []
  private msgEl!: HTMLElement
  private announceEl!: HTMLElement
  private bossWarningEl!: HTMLElement
  private lastPlayerUpgHash = '__init__'
  private upgModalOpen = false
  private layoutMode: HudLayoutMode = 'normal'
  private bottomBarEl!: HTMLElement

  constructor(private game: Game) {
    this.el = document.getElementById('hud')!
    this.el.innerHTML = this.template()
    this.msgEl = this.el.querySelector('#hud-messages')!
    this.announceEl = this.el.querySelector('#hud-wave-announce')!
    this.bossWarningEl = this.el.querySelector('#hud-boss-warning')!
    this.bottomBarEl = this.el.querySelector('#hud-bottom-bar') as HTMLElement

    const closeBtn = this.el.querySelector('#hud-upg-modal-close') as HTMLElement | null
    const modal = this.el.querySelector('#hud-upg-modal') as HTMLElement | null
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none'
        this.upgModalOpen = false
      })
    }

    const baseTreeBtn = this.el.querySelector('#hud-base-tree-btn') as HTMLButtonElement | null
    if (baseTreeBtn) {
      baseTreeBtn.addEventListener('click', () => {
        this.game.baseSkillTreeModal.show(this.game.base, this.game.resources)
      })
      baseTreeBtn.addEventListener('mouseenter', () => {
        baseTreeBtn.style.background = 'rgba(136,238,255,0.16)'
        baseTreeBtn.style.borderColor = `${T.crystalCyan}BB`
      })
      baseTreeBtn.addEventListener('mouseleave', () => {
        baseTreeBtn.style.background = 'rgba(136,238,255,0.08)'
        baseTreeBtn.style.borderColor = `${T.crystalCyan}66`
      })
    }

    window.addEventListener('resize', () => this.refreshLayoutMode())
    this.refreshLayoutMode()
  }

  private refreshLayoutMode(): void {
    const weaponCount = this.game.player.ownedWeapons.length
    const width = window.innerWidth

    // Escalate layout strictness on smaller screens or larger inventories.
    const nextMode: HudLayoutMode = width <= 1400 || weaponCount >= 7
      ? 'ultra'
      : width <= 1680 || weaponCount >= 5
        ? 'compact'
        : 'normal'

    if (nextMode === this.layoutMode && this.bottomBarEl.dataset.layoutMode === this.layoutMode) return
    this.layoutMode = nextMode
    this.bottomBarEl.dataset.layoutMode = nextMode
    this.bottomBarEl.classList.remove('hud-layout-normal', 'hud-layout-compact', 'hud-layout-ultra')
    this.bottomBarEl.classList.add(`hud-layout-${nextMode}`)

    const waveSub = this.el.querySelector('#hud-wave-sub') as HTMLElement | null
    if (waveSub) waveSub.style.display = nextMode === 'ultra' ? 'none' : 'block'

    const upgSection = this.el.querySelector('#hud-upgrades-section') as HTMLElement | null
    if (upgSection) upgSection.style.display = nextMode === 'ultra' ? 'none' : 'flex'
  }

  private formatCompactNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
    return String(n)
  }

  private template(): string {
    return `
      <style>
        .hud-upg-item { position:relative; }
        .hud-upg-item .hud-upg-tooltip { display:none; }
        .hud-upg-item:hover .hud-upg-tooltip { display:block; }

        #hud-bottom-bar {
          --hud-cols: minmax(168px, 190px) minmax(180px, 1fr) minmax(230px, 1.6fr) minmax(148px, 170px) minmax(168px, 210px) minmax(170px, 230px);
          grid-template-columns: var(--hud-cols);
          overflow: visible;
        }
        #hud-bottom-bar.hud-layout-compact {
          --hud-cols: minmax(152px, 176px) minmax(150px, 0.9fr) minmax(190px, 1.4fr) minmax(136px, 156px) minmax(136px, 168px) minmax(150px, 200px);
        }
        #hud-bottom-bar.hud-layout-ultra {
          --hud-cols: minmax(140px, 168px) minmax(124px, 0.7fr) minmax(176px, 1.4fr) minmax(124px, 140px) minmax(112px, 132px) minmax(132px, 172px);
        }
        #hud-bottom-bar[data-layout-mode='ultra'] #hud-base-tree-btn {
          padding: 4px 7px;
          font-size: 8px;
          gap: 2px;
        }
        #hud-bottom-bar[data-layout-mode='ultra'] #hud-meta-upgrade-hint {
          display: none;
        }
        #hud-weapon-slots {
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
        }
        #hud-weapon-slots::-webkit-scrollbar {
          display: none;
        }
      </style>

      <!-- Wave announcement — center screen, fades in/out -->
      <div id="hud-wave-announce"></div>

      <!-- Boss screen-edge flash -->
      <div id="hud-boss-warning"></div>

      <!-- Messages — top center -->
      <div id="hud-messages" style="
        position:absolute;top:12px;left:50%;transform:translateX(-50%);
        display:flex;flex-direction:column;align-items:center;gap:4px;
        pointer-events:none;z-index:1;
      "></div>

      <!-- View All upgrades modal (shown above HUD bar) -->
      <div id="hud-upg-modal" style="
        display:none;
        position:absolute;bottom:98px;left:50%;transform:translateX(-50%);
        background:linear-gradient(160deg, #1e1208 0%, #120a04 100%);
        border:1px solid ${T.rust};
        border-top:2px solid ${T.amber};
        border-radius:6px;
        padding:0;
        min-width:340px;
        z-index:200;pointer-events:auto;
        box-shadow:0 -4px 24px rgba(0,0,0,0.7), 0 0 0 1px rgba(232,160,48,0.08);
      ">
        <!-- Header -->
        <div style="
          display:flex;justify-content:space-between;align-items:center;
          padding:8px 14px;
          border-bottom:1px solid rgba(139,58,42,0.35);
        ">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:3px;height:12px;background:${T.amber};border-radius:1px;"></div>
            <span style="color:${T.amber};font:bold 10px ${T.font};letter-spacing:1.5px;">ACTIVE BUFFS</span>
          </div>
          <span id="hud-upg-modal-close" style="
            color:${T.iron};font:bold 13px ${T.font};cursor:pointer;
            width:20px;height:20px;display:flex;align-items:center;justify-content:center;
            border:1px solid rgba(139,58,42,0.3);border-radius:3px;
            transition:color 0.15s;
          ">✕</span>
        </div>
        <!-- Body -->
        <div style="padding:12px 14px;display:flex;flex-direction:column;gap:12px;">
          <!-- CHARACTER group -->
          <div>
            <div style="
              display:flex;align-items:center;gap:6px;margin-bottom:8px;
            ">
              <span style="color:${T.amber};font:bold 8px ${T.font};letter-spacing:1px;">CHARACTER</span>
              <div style="flex:1;height:1px;background:linear-gradient(to right,${T.amber}44,transparent);"></div>
            </div>
            <div id="hud-upg-modal-player-row" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
          </div>
          <!-- BASE group -->
          <div>
            <div style="
              display:flex;align-items:center;gap:6px;margin-bottom:8px;
            ">
              <span style="color:${T.crystalCyan};font:bold 8px ${T.font};letter-spacing:1px;">BASE</span>
              <div style="flex:1;height:1px;background:linear-gradient(to right,${T.crystalCyan}44,transparent);"></div>
            </div>
            <div id="hud-upg-modal-base-row" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
          </div>
        </div>
      </div>

      <!-- Cinematic bottom bar — full width, 90px -->
      <div id="hud-bottom-bar" style="
        position:absolute;bottom:0;left:0;right:0;height:90px;
        background:rgba(20,12,8,0.95);
        border-top:2px solid ${T.rust};
        display:grid;
        pointer-events:auto;
      ">
        <!-- Break progress strip at top of bar -->
        <div id="hud-break-strip-wrap" style="
          position:absolute;top:0;left:0;right:0;height:3px;
          background:rgba(44,36,22,0.4);
          display:none;
        ">
          <div id="hud-break-fill-strip" style="
            height:100%;
            background:linear-gradient(90deg,${T.rust},${T.amber});
            width:100%;
            transition:width 0.1s;
          "></div>
        </div>

        <!-- 1: Vitals -->
        <div id="hud-vitals" style="
          display:flex;flex-direction:column;justify-content:center;gap:6px;
          padding:0 12px;
          border-right:1px solid rgba(139,58,42,0.3);
          border-left:3px solid ${T.rust};
        ">
          <!-- Player HP -->
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="color:${T.iron};font:bold 9px ${T.font};min-width:26px;letter-spacing:0.5px;">HP</span>
            <div style="flex:1;height:7px;background:rgba(44,36,22,0.7);border-radius:2px;overflow:hidden;">
              <div id="hud-player-hp-fill" style="height:100%;background:${T.hpHigh};transition:width 0.1s,background 0.3s;width:100%;"></div>
            </div>
            <span id="hud-player-hp-val" style="color:${T.bg};font:bold 10px ${T.font};min-width:32px;text-align:right;"></span>
          </div>
          <!-- Base HP -->
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="color:${T.iron};font:bold 9px ${T.font};min-width:26px;letter-spacing:0.5px;">BASE</span>
            <div style="flex:1;height:7px;background:rgba(44,36,22,0.7);border-radius:2px;overflow:hidden;">
              <div id="hud-base-hp-fill" style="height:100%;background:${T.hpHigh};transition:width 0.1s,background 0.3s;width:100%;"></div>
            </div>
            <span id="hud-base-hp-val" style="color:${T.bg};font:bold 10px ${T.font};min-width:32px;text-align:right;"></span>
          </div>
          <!-- Active weapon ammo -->
          <div style="display:flex;align-items:center;gap:6px;">
            <span id="hud-ammo-label" style="color:${T.iron};font:bold 9px ${T.font};min-width:26px;letter-spacing:0.5px;">AMMO</span>
            <div style="flex:1;height:7px;background:rgba(44,36,22,0.7);border-radius:2px;overflow:hidden;">
              <div id="hud-ammo-fill" style="height:100%;background:${T.amber};border-radius:2px;transition:width 0.08s linear,background 0.2s;width:100%;"></div>
            </div>
            <span id="hud-ammo-val" style="color:${T.bg};font:bold 10px ${T.font};min-width:32px;text-align:right;"></span>
          </div>
        </div>

        <!-- 2: Wave info -->
        <div id="hud-wave-section" style="
          display:flex;flex-direction:column;justify-content:center;
          padding:0 16px;
          border-right:1px solid rgba(139,58,42,0.3);
          position:relative;
          min-width:0;
        ">
          <div id="hud-wave-label" style="
            color:${T.amber};
            font:bold 28px ${T.font};
            line-height:1;
            letter-spacing:1px;
          "></div>
          <div id="hud-wave-sub" style="
            color:${T.iron};
            font:11px ${T.font};
            margin-top:2px;
          "></div>
        </div>

        <!-- 3: Weapon slots -->
        <div id="hud-weapon-section" style="
          display:flex;flex-direction:column;justify-content:flex-start;
          padding:10px 12px 0;
          border-right:1px solid rgba(139,58,42,0.3);
          min-width:0;gap:6px;
        ">
          <span style="color:${T.iron};font:bold 7px ${T.font};letter-spacing:1.2px;line-height:1;">LOADOUT</span>
          <div id="hud-weapon-slots" style="display:flex;gap:4px;align-items:center;"></div>
        </div>

        <!-- 4: Base Skill Tree button -->
        <div id="hud-base-tree-section" style="
          display:flex;flex-direction:column;justify-content:flex-start;
          padding:10px 12px 0;
          border-right:1px solid rgba(139,58,42,0.3);
          min-width:0;gap:6px;
        ">
          <span style="color:${T.iron};font:bold 7px ${T.font};letter-spacing:1.2px;line-height:1;">BASE</span>
          <div style="display:flex;align-items:center;height:44px;">
            <button id="hud-base-tree-btn" style="
              background:rgba(136,238,255,0.08);
              border:1px solid ${T.crystalCyan}66;
              border-radius:4px;
              color:${T.crystalCyan};
              font:bold 9px ${T.font};
              letter-spacing:0.8px;
              padding:0 10px;
              height:36px;
              cursor:pointer;
              display:flex;align-items:center;gap:5px;
              transition:background 0.15s,border-color 0.15s;
              white-space:nowrap;
            " title="Open Base Skill Tree">
              ${getIcon('cpu', 13, T.crystalCyan)}
              SKILL TREE
            </button>
          </div>
        </div>

        <!-- 5: Applied Upgrades (CHAR only) -->
        <div id="hud-upgrades-section" style="
          display:flex;flex-direction:column;justify-content:flex-start;
          padding:10px 12px 0;
          border-right:1px solid rgba(139,58,42,0.3);
          position:relative;gap:6px;
        ">
          <!-- Expand button -->
          <div id="hud-upg-expand-btn" style="
            display:none;
            position:absolute;top:5px;right:5px;
            width:18px;height:18px;
            background:rgba(139,58,42,0.4);
            border:1px solid ${T.rust};
            border-radius:3px;
            cursor:pointer;
            align-items:center;justify-content:center;
            font:bold 11px ${T.font};color:${T.amber};line-height:1;
          " title="View all buffs">⤢</div>

          <span style="color:${T.iron};font:bold 7px ${T.font};letter-spacing:1.2px;line-height:1;">CHARACTER</span>
          <div id="hud-upg-player-row" style="display:flex;gap:4px;align-items:center;height:44px;"></div>
        </div>

        <!-- 6: Level / XP / Resources -->
        <div id="hud-meta-section" style="
          display:flex;flex-direction:column;justify-content:center;
          padding:0 12px;gap:4px;min-width:120px;
        ">
          <!-- Level + XP -->
          <div style="display:flex;align-items:center;gap:8px;">
            <span id="hud-level-label" style="color:${T.bg};font:bold 13px ${T.font};"></span>
            <div style="flex:1;height:4px;background:rgba(44,36,22,0.7);border-radius:2px;overflow:hidden;">
              <div id="hud-xp-fill" style="height:100%;background:${T.orange};border-radius:2px;transition:width 0.1s;"></div>
            </div>
          </div>
          <!-- Resources -->
          <div id="hud-resources-row" style="display:flex;gap:8px;flex-wrap:wrap;min-width:0;">
            <span id="res-coins"   style="color:${T.gold};font:bold 10px ${T.font};white-space:nowrap;max-width:72px;overflow:hidden;text-overflow:ellipsis;"></span>
            <span id="res-iron"    style="color:${T.ironGrey};font:bold 10px ${T.font};white-space:nowrap;max-width:72px;overflow:hidden;text-overflow:ellipsis;"></span>
            <span id="res-core"    style="color:${T.coreBlue};font:bold 10px ${T.font};white-space:nowrap;max-width:72px;overflow:hidden;text-overflow:ellipsis;"></span>
            <span id="res-crystal" style="color:${T.crystalCyan};font:bold 10px ${T.font};white-space:nowrap;max-width:72px;overflow:hidden;text-overflow:ellipsis;"></span>
          </div>
          <!-- Upgrade hint -->
          <div id="hud-meta-upgrade-hint" style="color:${T.iron};font:8px ${T.font};letter-spacing:0.5px;">
            [U] UPGRADES
          </div>
        </div>
      </div>
    `
  }

  update(): void {
    const g = this.game
    const p = g.player
    const b = g.base
    const w = g.waveManager
    const res = g.resources.res

    this.refreshLayoutMode()

    // Player HP
    const phpPct = Math.max(0, Math.min(1, p.stats.hp / p.stats.maxHp))
    const phpFill = this.el.querySelector('#hud-player-hp-fill') as HTMLElement | null
    const phpVal  = this.el.querySelector('#hud-player-hp-val')  as HTMLElement | null
    if (phpFill) { phpFill.style.width = `${phpPct * 100}%`; phpFill.style.background = T.hpColor(phpPct) }
    if (phpVal)  phpVal.textContent = `${Math.ceil(p.stats.hp)}/${p.stats.maxHp}`

    // Base HP
    const bhpPct = Math.max(0, Math.min(1, b.hp / b.maxHp))
    const bhpFill = this.el.querySelector('#hud-base-hp-fill') as HTMLElement | null
    const bhpVal  = this.el.querySelector('#hud-base-hp-val')  as HTMLElement | null
    if (bhpFill) { bhpFill.style.width = `${bhpPct * 100}%`; bhpFill.style.background = T.hpColor(bhpPct) }
    if (bhpVal)  bhpVal.textContent = `${Math.ceil(b.hp)}/${b.maxHp}`

    // Wave label
    const waveLabel = this.el.querySelector('#hud-wave-label') as HTMLElement | null
    const waveSub   = this.el.querySelector('#hud-wave-sub')   as HTMLElement | null
    const zombieCount = g.zombies.filter(z => z.alive).length
    if (w.phase === 'break') {
      const timeLeft = Math.ceil(w.breakTimeLeft)
      if (waveLabel) {
        waveLabel.textContent = `BREAK ${timeLeft}s`
        waveLabel.style.color = T.amber
        waveLabel.style.textShadow = ''
      }
      if (waveSub) waveSub.textContent = 'Next wave incoming'
    } else if (w.isBossWave) {
      if (waveLabel) {
        waveLabel.textContent = `BOSS WAVE`
        waveLabel.style.color = T.blood
        waveLabel.style.textShadow = `0 0 12px ${T.blood}`
      }
      if (waveSub) waveSub.textContent = `${zombieCount} enemies`
    } else {
      if (waveLabel) {
        waveLabel.textContent = `WAVE ${w.waveIndex}`
        waveLabel.style.color = T.amber
        waveLabel.style.textShadow = ''
      }
      if (waveSub) waveSub.textContent = `${zombieCount} enemies remaining`
    }

    // Break strip
    const breakStrip = this.el.querySelector('#hud-break-strip-wrap') as HTMLElement | null
    if (breakStrip) {
      if (g.phase === 'break') {
        breakStrip.style.display = 'block'
        const fillStrip = breakStrip.querySelector('#hud-break-fill-strip') as HTMLElement | null
        const total = w.currentBreakDuration
        const left  = w.breakTimeLeft
        const pct   = Math.max(0, Math.min(1, left / total)) * 100
        if (fillStrip) fillStrip.style.width = `${pct}%`
      } else {
        breakStrip.style.display = 'none'
      }
    }

    // Boss warning
    const isBossActive = w.isBossWave && g.phase === 'playing'
    if (isBossActive) this.bossWarningEl.classList.add('boss-active')
    else this.bossWarningEl.classList.remove('boss-active')

    // Weapon slots — rebuild when count or active index changes
    const weaponSlotsEl = this.el.querySelector('#hud-weapon-slots') as HTMLElement | null
    if (weaponSlotsEl) {
      const owned = p.ownedWeapons
      const activeIdx = p.activeWeaponIndex
      const prevCount = parseInt(weaponSlotsEl.dataset.count ?? '-1')
      const prevActive = parseInt(weaponSlotsEl.dataset.active ?? '-1')
      const prevLayoutMode = weaponSlotsEl.dataset.layoutMode ?? '__unset__'
      if (prevCount !== owned.length || prevActive !== activeIdx || prevLayoutMode !== this.layoutMode) {
        weaponSlotsEl.dataset.count = String(owned.length)
        weaponSlotsEl.dataset.active = String(activeIdx)
        weaponSlotsEl.dataset.layoutMode = this.layoutMode
        weaponSlotsEl.innerHTML = owned.map((slot, i) => {
          const isActive = i === activeIdx
          const abbr = WEAPON_CLASS_ABBR[slot.profile.class] ?? '??'
          const isEmpty = slot.ammoInMag === 0
          const compact = this.layoutMode !== 'normal'
          const activeSize = this.layoutMode === 'ultra' ? 42 : compact ? 48 : 52
          const inactiveSize = this.layoutMode === 'ultra' ? 32 : compact ? 36 : 40
          const borderColor = isActive
            ? (p.reloading ? T.amber : isEmpty ? T.blood : T.orange)
            : '#2a1a0a'
          return `
            <div class="hud-weapon-slot-item" data-slot="${i}" style="
              display:flex;flex-direction:column;align-items:center;gap:2px;
              cursor:${owned.length > 1 ? 'pointer' : 'default'};
            ">
              <div style="
                width:${isActive ? activeSize : inactiveSize}px;height:${isActive ? activeSize : inactiveSize}px;
                background:${isActive ? '#1a0e06' : 'rgba(20,10,4,0.6)'};
                border:2px solid ${borderColor};
                border-radius:4px;
                display:flex;flex-direction:column;
                align-items:center;justify-content:center;gap:1px;
                transition:width 0.1s,height 0.1s,border-color 0.15s;
                position:relative;
                box-shadow:${isActive ? `0 0 8px ${T.orange}44` : 'none'};
              ">
                <span style="color:${isActive ? T.amber : T.iron};font:bold ${isActive ? (compact ? 10 : 11) : (compact ? 8 : 9)}px ${T.font};">${abbr}</span>
                ${owned.length > 1 ? `<span style="
                  position:absolute;bottom:-1px;right:-1px;
                  background:${isActive ? T.orange : '#2a1a0a'};
                  color:${isActive ? '#000' : T.iron};
                  font:bold 7px ${T.font};
                  width:12px;height:12px;
                  display:flex;align-items:center;justify-content:center;
                  border-radius:2px 0 2px 0;
                ">${i + 1}</span>` : ''}
              </div>
              <span style="
                display:${this.layoutMode === 'ultra' ? 'none' : 'inline'};
                color:${isActive ? T.iron : '#3a2a1a'};font:7px ${T.font};
                max-width:${isActive ? 56 : 42}px;text-align:center;
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
              ">${slot.profile.label.split(' ')[0]}</span>
            </div>`
        }).join('')

        // Click to switch
        weaponSlotsEl.querySelectorAll<HTMLElement>('.hud-weapon-slot-item').forEach(el => {
          el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.slot!)
            p.switchToSlot(idx, g.hud)
          })
        })
      } else {
        // Fast path: update only border color without full rebuild
        weaponSlotsEl.querySelectorAll<HTMLElement>('.hud-weapon-slot-item').forEach(el => {
          const i = parseInt(el.dataset.slot!)
          const slot = p.ownedWeapons[i]
          const isActive = i === activeIdx
          const isEmpty = slot.ammoInMag === 0
          const box = el.querySelector('div') as HTMLElement | null
          if (box) box.style.borderColor = isActive
            ? (p.reloading ? T.amber : isEmpty ? T.blood : T.orange)
            : '#2a1a0a'
        })
      }
    }

    // Ammo bar + reload animation in vitals
    const ammoVal   = this.el.querySelector('#hud-ammo-val')   as HTMLElement | null
    const ammoFill  = this.el.querySelector('#hud-ammo-fill')  as HTMLElement | null
    const ammoLabel = this.el.querySelector('#hud-ammo-label') as HTMLElement | null
    {
      const slot = p.ownedWeapons[p.activeWeaponIndex]
      if (p.reloading) {
        const elapsed = p.currentWeapon.reloadTime - p.reloadTimer
        const reloadPct = Math.min(1, elapsed / p.currentWeapon.reloadTime)
        if (ammoFill)  { ammoFill.style.width = `${reloadPct * 100}%`; ammoFill.style.background = T.amber }
        if (ammoLabel) ammoLabel.textContent = 'RLD'
        if (ammoVal)   { ammoVal.textContent = ''; ammoVal.style.display = 'none' }
      } else {
        const magPct = slot.profile.magSize > 0 ? slot.ammoInMag / slot.profile.magSize : 0
        const isEmpty = slot.ammoInMag === 0
        const barColor = isEmpty ? T.blood : magPct <= 0.25 ? T.orange : T.amber
        if (ammoFill)  { ammoFill.style.width = `${magPct * 100}%`; ammoFill.style.background = barColor }
        if (ammoLabel) ammoLabel.textContent = 'AMMO'
        if (ammoVal)   {
          ammoVal.style.display = 'inline'
          ammoVal.textContent = `${slot.ammoInMag}/${slot.reserveAmmo}`
          ammoVal.style.color = isEmpty ? T.blood : T.bg
        }
      }
    }
    // Level / XP
    const lvlLabel = this.el.querySelector('#hud-level-label') as HTMLElement | null
    if (lvlLabel) lvlLabel.textContent = `LV${p.stats.level}`
    const xpFill = this.el.querySelector('#hud-xp-fill') as HTMLElement | null
    if (xpFill) xpFill.style.width = `${Math.floor((p.stats.xp / p.stats.xpToNext) * 100)}%`

    // Resources
    const rcEl = this.el.querySelector('#res-coins')   as HTMLElement | null
    const riEl = this.el.querySelector('#res-iron')    as HTMLElement | null
    const reEl = this.el.querySelector('#res-core')    as HTMLElement | null
    const rxEl = this.el.querySelector('#res-crystal') as HTMLElement | null
    const iconStyle = 'display:inline-flex;vertical-align:middle;margin-right:2px;'
    if (rcEl) rcEl.innerHTML = `<span style="${iconStyle}">${getIcon('coins', 12, T.gold)}</span>${this.formatCompactNumber(res.coins)}`
    if (riEl) riEl.innerHTML = `<span style="${iconStyle}">${getIcon('hexagon', 12, T.ironGrey)}</span>${this.formatCompactNumber(res.iron)}`
    if (reEl) reEl.innerHTML = `<span style="${iconStyle}">${getIcon('cpu', 12, T.coreBlue)}</span>${this.formatCompactNumber(res.energyCore)}`
    if (rxEl) rxEl.innerHTML = `<span style="${iconStyle}">${getIcon('gem', 12, T.crystalCyan)}</span>${this.formatCompactNumber(res.crystal)}`

    this.updateUpgradesSection()
    this.updateMessages()
  }

  // Build one upgrade slot — either filled (icon + tooltip + stack badge) or empty
  private buildUpgSlotHtml(entry: { icon: string; label: string; description: string; rarity: string; stacks: number } | null, color: string, inModal = false): string {
    const size = inModal ? 48 : UPG_SLOT_SIZE
    const iconSize = inModal ? 22 : 18
    if (!entry) {
      return `<div style="
        width:${size}px;height:${size}px;
        background:rgba(44,28,12,0.4);
        border:1px dashed rgba(122,112,96,0.35);
        border-radius:4px;
        flex-shrink:0;
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="color:rgba(122,112,96,0.4);font:bold 14px ${T.font};line-height:1;">?</span>
      </div>`
    }
    const { icon, label, description, rarity, stacks } = entry
    const rarityColor = rarity === 'legendary' ? '#E8C84A' : rarity === 'rare' ? '#88EEFF' : T.iron
    const rarityLabel = rarity === 'legendary' ? 'LEGENDARY' : rarity === 'rare' ? 'RARE' : 'COMMON'
    const stackBadge = stacks > 1
      ? `<span style="
          position:absolute;bottom:-1px;right:-1px;
          font:bold 7px ${T.font};
          background:${T.rust};color:${T.bg};
          border-radius:2px 0 2px 0;
          padding:0 3px;line-height:1.6;
          pointer-events:none;
        ">×${stacks}</span>`
      : ''
    return `
      <div class="hud-upg-item" style="
        width:${size}px;height:${size}px;
        background:#1a0e06;
        border:2px solid ${color}88;
        border-radius:4px;
        display:flex;align-items:center;justify-content:center;
        cursor:default;flex-shrink:0;
        position:relative;
        box-shadow:0 0 8px ${color}33, inset 0 0 6px rgba(0,0,0,0.6);
      ">
        <!-- subtle corner accent lines -->
        <div style="position:absolute;top:2px;left:2px;width:6px;height:1px;background:${color};opacity:0.5;"></div>
        <div style="position:absolute;top:2px;left:2px;width:1px;height:6px;background:${color};opacity:0.5;"></div>
        <div style="position:absolute;bottom:2px;right:2px;width:6px;height:1px;background:${color};opacity:0.5;"></div>
        <div style="position:absolute;bottom:2px;right:2px;width:1px;height:6px;background:${color};opacity:0.5;"></div>
        ${getIcon(icon, iconSize, color)}
        ${stackBadge}
        <div class="hud-upg-tooltip" style="
          position:absolute;bottom:${size + 8}px;left:50%;transform:translateX(-50%);
          background:#120a04;
          border:1px solid ${color}55;
          border-top:2px solid ${rarityColor};
          border-radius:4px;
          padding:7px 10px;
          white-space:nowrap;
          pointer-events:none;z-index:300;
          box-shadow:0 4px 16px rgba(0,0,0,0.7);
          min-width:140px;
        ">
          <!-- Rarity row -->
          <div style="
            font:bold 7px ${T.font};letter-spacing:1.5px;
            color:${rarityColor};margin-bottom:4px;
          ">${rarityLabel}</div>
          <!-- Skill name -->
          <div style="
            font:bold 10px ${T.font};color:${T.bg};
            letter-spacing:0.5px;margin-bottom:4px;
            display:flex;align-items:center;gap:6px;
          ">
            ${label}
            ${stacks > 1 ? `<span style="color:${color};font:bold 9px ${T.font};">×${stacks}</span>` : ''}
          </div>
          <!-- Description -->
          <div style="
            font:9px ${T.font};color:${T.iron};
            line-height:1.5;max-width:180px;white-space:normal;
          ">${description}</div>
        </div>
      </div>`
  }

  private updateUpgradesSection(): void {
    const p = this.game.player

    const playerEntries: { icon: string; label: string; description: string; rarity: string; stacks: number }[] = []
    for (const [id, stacks] of p.appliedPlayerSkills) {
      const def = PLAYER_SKILL_POOL.find(s => s.id === id)
      if (def) playerEntries.push({ icon: def.icon, label: def.label, description: def.description, rarity: def.rarity, stacks })
    }

    const playerHash = playerEntries.map(e => `${e.icon}${e.stacks}`).join(',')
    const hashChanged = playerHash !== this.lastPlayerUpgHash

    if (hashChanged) {
      this.lastPlayerUpgHash = playerHash

      const playerRowEl = this.el.querySelector('#hud-upg-player-row') as HTMLElement | null
      if (playerRowEl) playerRowEl.innerHTML = this.buildFixedSlots(playerEntries, T.amber)

      const expandBtn = this.el.querySelector('#hud-upg-expand-btn') as HTMLElement | null
      if (expandBtn) {
        expandBtn.style.display = playerEntries.length > 3 ? 'flex' : 'none'
        expandBtn.onclick = () => this.toggleUpgModal()
      }
    }

    if (this.upgModalOpen) {
      const modalPlayerRow = this.el.querySelector('#hud-upg-modal-player-row') as HTMLElement | null
      if (modalPlayerRow) {
        modalPlayerRow.innerHTML = playerEntries.length > 0
          ? playerEntries.map(e => this.buildUpgSlotHtml(e, T.amber, true)).join('')
          : `<span style="color:${T.iron};font:9px ${T.font};">None yet</span>`
      }
    }
  }

  // Build exactly 3 slots: fill from the 3 most recent entries, rest are empty
  private buildFixedSlots(entries: { icon: string; label: string; description: string; rarity: string; stacks: number }[], color: string): string {
    const shown = entries.slice(-3)   // last 3 (most recent)
    const result: string[] = []
    // Pad from left with empty slots so filled slots are right-aligned
    for (let i = shown.length; i < 3; i++) {
      result.push(this.buildUpgSlotHtml(null, color))
    }
    for (const e of shown) {
      result.push(this.buildUpgSlotHtml(e, color))
    }
    return result.join('')
  }

  private toggleUpgModal(): void {
    const modal = this.el.querySelector('#hud-upg-modal') as HTMLElement | null
    if (!modal) return
    this.upgModalOpen = !this.upgModalOpen
    modal.style.display = this.upgModalOpen ? 'block' : 'none'
  }

  triggerWaveAnnounce(waveNum: number, isBoss: boolean): void {
    const el = this.announceEl
    el.textContent = isBoss ? 'BOSS WAVE' : `WAVE ${waveNum}`
    el.style.color = isBoss ? T.blood : T.amber
    el.style.textShadow = isBoss
      ? `0 0 30px rgba(204,26,26,0.8), 0 4px 0 ${T.rust}`
      : `0 0 30px rgba(232,160,48,0.8), 0 4px 0 ${T.rust}`
    el.classList.remove('announcing', 'clearing')
    void el.offsetWidth // force reflow
    el.classList.add('announcing')
    el.addEventListener('animationend', () => { el.style.display = 'none' }, { once: true })
  }

  triggerWaveClear(waveNum: number): void {
    const el = this.announceEl
    el.textContent = `WAVE ${waveNum} CLEAR`
    el.style.color = '#4CAF50'
    el.style.textShadow = '0 0 20px rgba(76,175,80,0.6)'
    el.style.fontSize = '56px'
    el.classList.remove('announcing', 'clearing')
    void el.offsetWidth
    el.classList.add('clearing')
    el.addEventListener('animationend', () => { el.style.display = 'none'; el.style.fontSize = '' }, { once: true })
  }

  triggerLevelUp(): void {
    const lvlEl = this.el.querySelector('#hud-level-label') as HTMLElement | null
    if (!lvlEl) return
    lvlEl.classList.remove('level-flash')
    void lvlEl.offsetWidth
    lvlEl.classList.add('level-flash')
    setTimeout(() => lvlEl.classList.remove('level-flash'), 1500)
  }

  showMessage(msg: string, color = T.bg, durationMs = 2000): void {
    this.messages.push({ text: msg, color, expiry: Date.now() + durationMs })
  }

  private updateMessages(): void {
    const now = Date.now()
    this.messages = this.messages.filter(m => m.expiry > now)
    this.msgEl.innerHTML = this.messages
      .map(m => `<div style="
        color:${m.color};font:bold 12px ${T.font};
        background:rgba(20,12,8,0.88);
        padding:3px 12px;border-radius:3px;
        border-left:3px solid ${T.orange};
      ">${m.text}</div>`)
      .join('')
  }
}
