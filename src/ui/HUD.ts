import { Game } from '../core/Game'
import { SKILL_DEFS } from '../systems/SkillManager'
import { T } from './theme'

interface Message { text: string; color: string; expiry: number }

const WEAPON_CLASS_ABBR: Record<string, string> = {
  pistol:       'PSTL',
  shotgun:      'SHOT',
  assaultRifle: 'AR',
  smg:          'SMG',
  sniperRifle:  'SNP',
}

export class HUD {
  private el: HTMLElement
  private messages: Message[] = []
  private msgEl!: HTMLElement
  private announceEl!: HTMLElement
  private bossWarningEl!: HTMLElement

  constructor(private game: Game) {
    this.el = document.getElementById('hud')!
    this.el.innerHTML = this.template()
    this.msgEl = this.el.querySelector('#hud-messages')!
    this.announceEl = this.el.querySelector('#hud-wave-announce')!
    this.bossWarningEl = this.el.querySelector('#hud-boss-warning')!
  }

  private template(): string {
    return `
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

      <!-- Cinematic bottom bar — full width, 90px -->
      <div id="hud-bottom-bar" style="
        position:absolute;bottom:0;left:0;right:0;height:90px;
        background:rgba(20,12,8,0.95);
        border-top:2px solid ${T.rust};
        display:grid;
        grid-template-columns:180px 1fr 130px auto auto;
        pointer-events:auto;
        overflow:hidden;
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
        </div>

        <!-- 2: Wave info -->
        <div style="
          display:flex;flex-direction:column;justify-content:center;
          padding:0 16px;
          border-right:1px solid rgba(139,58,42,0.3);
          position:relative;
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

        <!-- 3: Weapon slot -->
        <div style="
          display:flex;align-items:center;justify-content:center;gap:8px;
          padding:0 10px;
          border-right:1px solid rgba(139,58,42,0.3);
        ">
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
            <div id="hud-weapon-slot" style="
              width:54px;height:54px;background:#1a0e06;
              border:2px solid #3a2a1a;border-radius:4px;
              display:flex;flex-direction:column;
              align-items:center;justify-content:center;gap:1px;
            ">
              <span id="hud-weapon-abbr" style="color:${T.amber};font:bold 13px ${T.font};"></span>
              <span id="hud-weapon-ammo" style="color:${T.bg};font:10px ${T.font};"></span>
            </div>
            <span id="hud-weapon-name" style="
              color:${T.iron};font:8px ${T.font};
              max-width:60px;text-align:center;white-space:nowrap;
              overflow:hidden;text-overflow:ellipsis;
            "></span>
          </div>
          <!-- Reload bar -->
          <div id="hud-reload-bar-wrap" style="display:none;flex-direction:column;align-items:center;gap:2px;">
            <span style="color:${T.amber};font:9px ${T.font};">RELOAD</span>
            <div style="width:44px;height:4px;background:rgba(44,36,22,0.7);border-radius:2px;overflow:hidden;">
              <div id="hud-reload-fill" style="height:100%;background:${T.amber};border-radius:2px;width:0%;transition:width 0.05s;"></div>
            </div>
          </div>
        </div>

        <!-- 4: Skill slots -->
        <div style="
          display:flex;align-items:center;gap:5px;
          padding:0 10px;
          border-right:1px solid rgba(139,58,42,0.3);
        ">
          <div id="hud-skill-slots" style="display:flex;gap:5px;align-items:center;"></div>
        </div>

        <!-- 5: Level / XP / Resources -->
        <div style="
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
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <span id="res-coins"   style="color:${T.gold};font:bold 10px ${T.font};white-space:nowrap;"></span>
            <span id="res-iron"    style="color:${T.ironGrey};font:bold 10px ${T.font};white-space:nowrap;"></span>
            <span id="res-core"    style="color:${T.coreBlue};font:bold 10px ${T.font};white-space:nowrap;"></span>
            <span id="res-crystal" style="color:${T.crystalCyan};font:bold 10px ${T.font};white-space:nowrap;"></span>
          </div>
          <!-- Upgrade hint -->
          <div style="color:${T.iron};font:8px ${T.font};letter-spacing:0.5px;">
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
        const total = w.breakDuration
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

    // Weapon slot
    const abbr = WEAPON_CLASS_ABBR[p.currentWeapon.class] ?? '??'
    const slotEl = this.el.querySelector('#hud-weapon-slot') as HTMLElement | null
    if (slotEl) {
      const isEmpty = p.ammoInMag === 0
      slotEl.style.borderColor = p.reloading ? T.amber : isEmpty ? T.blood : '#3a2a1a'
    }
    const abbrEl = this.el.querySelector('#hud-weapon-abbr') as HTMLElement | null
    if (abbrEl) abbrEl.textContent = abbr
    const ammoEl = this.el.querySelector('#hud-weapon-ammo') as HTMLElement | null
    if (ammoEl) ammoEl.textContent = `${p.ammoInMag}/${p.reserveAmmo}`
    const nameEl = this.el.querySelector('#hud-weapon-name') as HTMLElement | null
    if (nameEl) nameEl.textContent = p.currentWeapon.label

    // Reload bar
    const reloadWrap = this.el.querySelector('#hud-reload-bar-wrap') as HTMLElement | null
    if (reloadWrap) {
      reloadWrap.style.display = p.reloading ? 'flex' : 'none'
      if (p.reloading) {
        const fillEl = reloadWrap.querySelector('#hud-reload-fill') as HTMLElement | null
        const elapsed = p.currentWeapon.reloadTime - p.reloadTimer
        const pct = Math.min(1, elapsed / p.currentWeapon.reloadTime) * 100
        if (fillEl) fillEl.style.width = `${pct}%`
      }
    }

    // Skill slots — rebuild only when count changes
    const slotsEl = this.el.querySelector('#hud-skill-slots') as HTMLElement | null
    if (slotsEl) {
      const slots = g.skills.equipped
      if (slotsEl.children.length !== Math.max(slots.length, 1)) {
        slotsEl.innerHTML = slots.length === 0
          ? `<div style="color:${T.iron};font:10px ${T.font};width:48px;text-align:center;">—</div>`
          : slots.map((sid, i) => {
              const def = sid ? SKILL_DEFS.find(s => s.id === sid) : null
              return `
                <div class="hud-skill-slot" data-idx="${i}" title="${def?.description ?? 'Empty slot'}" style="
                  width:44px;height:44px;background:#1a0e06;
                  border:2px solid ${def ? T.orange : '#2a1a0a'};
                  border-radius:4px;display:flex;flex-direction:column;
                  align-items:center;justify-content:center;gap:1px;cursor:default;
                ">
                  ${def
                    ? `<span style="color:${T.ember};font:bold 9px ${T.font};text-align:center;line-height:1.2;padding:2px;">${def.label.split(' ').map((w: string) => w[0]).join('')}</span>`
                    : `<span style="color:#3a2a1a;font:11px ${T.font};">—</span>`
                  }
                </div>`
            }).join('')
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
    if (rcEl) rcEl.textContent = `¢${res.coins}`
    if (riEl) riEl.textContent = `⬡${res.iron}`
    if (reEl) reEl.textContent = `◈${res.energyCore}`
    if (rxEl) rxEl.textContent = `✦${res.crystal}`

    this.updateMessages()
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
