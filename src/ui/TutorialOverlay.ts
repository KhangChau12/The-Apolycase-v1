import { T } from './theme'
import { getIcon } from './icons'

interface TutorialPage {
  title: string
  icon: string
  accent: string
  render: () => string
}

export class TutorialOverlay {
  private el: HTMLElement
  private page = 0
  private onClose: () => void

  private readonly pages: TutorialPage[] = [
    {
      title: 'OBJECTIVE',
      icon: 'shield',
      accent: T.blood,
      render: () => `
        <div style="${S.section(T.blood)}">
          ${S.sectionHeader(T.blood, getIcon('shield', 13, T.blood), 'MISSION')}
          ${S.row(getIcon('map', 14, T.blood), 'HOME BASE', 'Defend the base at the center of the map')}
          ${S.sep()}
          ${S.row(getIcon('heart', 14, T.blood), 'BASE HP', 'If HP reaches 0 → Game Over')}
          ${S.sep()}
          ${S.row(getIcon('arrow-right', 14, T.blood), 'ZOMBIES', 'Spawn from the map edges and march toward the base')}
        </div>
        <div style="${S.note(T.blood)}">
          ${getIcon('zap', 12, T.blood)}
          <span>The base emits an <b style="color:${T.amber}">AURA</b> — automatically slows and damages nearby zombies.</span>
        </div>
      `,
    },
    {
      title: 'MOVEMENT & COMBAT',
      icon: 'crosshair',
      accent: T.hpHigh,
      render: () => `
        <div style="${S.section(T.hpHigh)}">
          ${S.sectionHeader(T.hpHigh, getIcon('crosshair', 13, T.hpHigh), 'CONTROLS')}
          ${S.row(getIcon('activity', 14, T.hpHigh), 'WASD', 'Move')}
          ${S.sep()}
          ${S.row(getIcon('circle-dot', 14, T.hpHigh), 'Mouse', 'Aim')}
          ${S.sep()}
          ${S.row(getIcon('bomb', 14, T.hpHigh), 'Left Click (hold)', 'Shoot')}
          ${S.sep()}
          ${S.row(getIcon('refresh-cw', 14, T.hpHigh), 'R', 'Manual reload')}
          ${S.sep()}
          ${S.row(getIcon('layers', 14, T.hpHigh), '1 – 9', 'Switch weapon slot')}
        </div>
        <div style="${S.section(T.hpHigh)}">
          ${S.sectionHeader(T.hpHigh, getIcon('package', 13, T.hpHigh), 'DROPS')}
          <div style="color:${T.bg};font:11px/1.7 ${T.font};">
            Kill zombies to receive resource drops.<br>
            <span style="color:${T.iron};">Walk over drops to pick them up automatically.</span>
          </div>
        </div>
      `,
    },
    {
      title: 'RESOURCES',
      icon: 'coins',
      accent: T.gold,
      render: () => `
        <div style="${S.section(T.gold)}">
          ${S.sectionHeader(T.gold, getIcon('coins', 13, T.gold), 'RESOURCES')}
          ${S.resource(getIcon('coins', 14, T.gold), 'COINS', T.gold, 'Every kill', 'Buy weapons and upgrades in the Shop')}
          ${S.sep()}
          ${S.resource(getIcon('hexagon', 14, T.ironGrey), 'IRON', T.ironGrey, 'Every kill', 'Build and upgrade towers')}
          ${S.sep()}
          ${S.resource(getIcon('cpu', 14, T.coreBlue), 'ENERGY CORE', T.coreBlue, 'Every kill (rarer)', 'Required for advanced towers')}
          ${S.sep()}
          ${S.resource(getIcon('gem', 14, T.crystalCyan), 'CRYSTAL', T.crystalCyan, 'BOSS ONLY', 'Unlock nodes in the Base Skill Tree')}
        </div>
        <div style="${S.note(T.crystalCyan)}">
          ${getIcon('star', 12, T.crystalCyan)}
          <span>Crystal <b style="color:${T.crystalCyan}">only drops from Boss waves</b> (wave 5, 10, 15…). Use it wisely.</span>
        </div>
      `,
    },
    {
      title: 'WAVES & BREAKS',
      icon: 'activity',
      accent: T.amber,
      render: () => `
        <div style="${S.section(T.amber)}">
          ${S.sectionHeader(T.amber, getIcon('activity', 13, T.amber), 'WAVE LOOP')}
          ${S.row(getIcon('arrow-right', 14, T.amber), 'Kill all zombies', 'Ends the wave and starts the Break Phase')}
          ${S.sep()}
          ${S.row(getIcon('star', 14, T.gold), 'Wave 5, 10, 15…', 'BOSS WAVE — 2000 HP, drops Crystal')}
          ${S.sep()}
          ${S.row(getIcon('map', 14, T.hpHigh), 'After boss dies', 'Territory expands automatically (free)')}
        </div>
        <div style="${S.section(T.amber)}">
          ${S.sectionHeader(T.amber, getIcon('package', 13, T.amber), 'BREAK PHASE (15 seconds)')}
          ${S.row(getIcon('layers', 14, T.amber), 'Shop panel opens', 'Buy weapons, upgrade stats, upgrade towers')}
          ${S.sep()}
          ${S.row(getIcon('plus-circle', 14, T.amber), 'Right-click', 'Build new towers (works mid-wave too)')}
          ${S.sep()}
          ${S.row(getIcon('arrow-right', 14, T.iron), 'SKIP / timer ends', 'Start the next wave')}
        </div>
      `,
    },
    {
      title: 'TOWERS',
      icon: 'layers',
      accent: T.orange,
      render: () => `
        <div style="${S.section(T.orange)}">
          ${S.sectionHeader(T.orange, getIcon('layers', 13, T.orange), 'BUILDING')}
          ${S.row(getIcon('circle-dot', 14, T.orange), 'Right-click on map', 'Opens the Build Menu')}
          ${S.sep()}
          ${S.row(getIcon('map', 14, T.orange), 'Inside territory', 'Towers must be placed within the orange ring')}
          ${S.sep()}
          ${S.row(getIcon('zap', 14, T.orange), 'Any time', 'Build mid-wave or during break')}
        </div>
        <div style="${S.section(T.orange)}">
          ${S.sectionHeader(T.orange, getIcon('layers', 13, T.orange), 'TOWER TYPES')}
          ${S.towerRow('shield', T.ironGrey, 'Barricade', '3⬡ · 0◈', 'Blocks zombie path')}
          ${S.sep()}
          ${S.towerRow('flame', T.ember, 'Fire Tower', '25⬡ · 8◈', 'Continuous burn AoE')}
          ${S.sep()}
          ${S.towerRow('zap', T.coreBlue, 'Electric Tower', '20⬡ · 12◈', 'Chains to 4 targets')}
          ${S.sep()}
          ${S.towerRow('refresh-cw', T.hpHigh, 'Repair Tower', '15⬡ · 10◈', 'Spawns repair worker drones')}
          ${S.sep()}
          ${S.towerRow('crosshair', T.amber, 'Machine Gun', '30⬡ · 6◈', 'Rapid-fire single target')}
        </div>
      `,
    },
    {
      title: 'PROGRESSION',
      icon: 'star',
      accent: T.crystalCyan,
      render: () => `
        <div style="${S.section(T.amber)}">
          ${S.sectionHeader(T.amber, getIcon('user', 13, T.amber), 'PLAYER LEVELING')}
          ${S.row(getIcon('zap', 14, T.amber), 'Kill zombies', 'Earn XP and fill the level bar')}
          ${S.sep()}
          ${S.row(getIcon('star', 14, T.amber), 'On level-up', 'Choose 1 of 3 skill cards')}
          ${S.sep()}
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center;">
            <span style="${S.rarityBadge(T.ironGrey)}">COMMON</span>
            <span style="${S.rarityBadge(T.coreBlue)}">RARE</span>
            <span style="${S.rarityBadge(T.gold)}">LEGENDARY ✦</span>
            <span style="color:${T.iron};font:9px ${T.font};">Legendary unlocks from wave 5+</span>
          </div>
        </div>
        <div style="${S.section(T.crystalCyan)}">
          ${S.sectionHeader(T.crystalCyan, getIcon('gem', 13, T.crystalCyan), 'BASE SKILL TREE')}
          ${S.row(getIcon('gem', 14, T.crystalCyan), 'Crystal', 'Spend it to unlock nodes in the skill tree')}
          ${S.sep()}
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
            <span style="${S.branchBadge(T.amber)}">ACTIVE</span>
            <span style="${S.branchBadge('#4CAF50')}">SUMMON</span>
            <span style="${S.branchBadge(T.coreBlue)}">TECHNOLOGY</span>
          </div>
          <div style="color:${T.iron};font:9px ${T.font};margin-top:6px;">
            Access via the "BASE TREE" button in the HUD or Break Panel
          </div>
        </div>
      `,
    },
  ]

  constructor(onClose: () => void) {
    this.onClose = onClose
    this.el = document.getElementById('tutorial-overlay')!
    this.render()
  }

  private render(): void {
    const p = this.pages[this.page]
    const isLast = this.page === this.pages.length - 1

    const dots = this.pages.map((_, i) => `
      <div style="
        width:${i === this.page ? 14 : 6}px;height:6px;border-radius:3px;
        background:${i === this.page ? p.accent : 'rgba(120,100,80,0.3)'};
        transition:all 0.2s;
      "></div>
    `).join('')

    this.el.innerHTML = `
      <div style="
        background:rgba(20,12,8,0.97);
        border:1px solid ${T.rust};
        border-top:3px solid ${p.accent};
        border-radius:4px;
        padding:28px 28px 24px;
        max-width:520px;width:100%;
        display:flex;flex-direction:column;gap:18px;
        box-shadow:0 0 60px rgba(0,0,0,0.5),0 0 30px ${p.accent}18;
      ">

        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:3px;height:22px;background:${p.accent};border-radius:2px;box-shadow:0 0 8px ${p.accent};flex-shrink:0;"></div>
            ${getIcon(p.icon, 16, p.accent)}
            <span style="color:${p.accent};font:bold 18px ${T.font};letter-spacing:2px;">${p.title}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <button id="tut-skip" style="
              background:none;border:none;cursor:pointer;
              color:${T.iron};font:10px ${T.font};letter-spacing:1px;
              padding:4px 6px;opacity:0.6;
            ">SKIP ›</button>
            <div style="display:flex;gap:4px;align-items:center;">${dots}</div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          ${p.render()}
        </div>

        <div style="display:flex;gap:10px;justify-content:space-between;align-items:center;margin-top:2px;">
          <div>
            ${this.page > 0
              ? `<button id="tut-prev" style="${btnSecondary()}">← Back</button>`
              : '<span></span>'
            }
          </div>
          ${isLast
            ? `<button id="tut-next" style="${btnStart()}">
                ${getIcon('sword', 15, T.bg)}
                <span>START GAME</span>
                ${getIcon('chevron-right', 15, T.bg)}
              </button>`
            : `<button id="tut-next" style="${btnPrimary(p.accent)}">
                NEXT ${getIcon('chevron-right', 13, T.bg)}
              </button>`
          }
        </div>

      </div>
    `

    this.el.querySelector('#tut-skip')?.addEventListener('click', () => this.hide())
    this.el.querySelector('#tut-prev')?.addEventListener('click', () => { this.page--; this.render() })
    this.el.querySelector('#tut-next')?.addEventListener('click', () => {
      if (this.page < this.pages.length - 1) { this.page++; this.render() }
      else { this.hide() }
    })
  }

  private hide(): void {
    this.el.classList.add('hidden')
    this.onClose()
  }
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const S = {
  section: (accent: string) =>
    `background:rgba(0,0,0,0.25);border:1px solid rgba(44,36,22,0.5);` +
    `border-left:3px solid ${accent};border-radius:4px;padding:12px 14px;` +
    `display:flex;flex-direction:column;gap:0;`,

  sectionHeader: (color: string, iconHtml: string, title: string) =>
    `<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;` +
    `padding-bottom:6px;border-bottom:1px solid ${color}33;">` +
    `${iconHtml}<span style="color:${color};font:bold 10px ${T.font};letter-spacing:2px;">${title}</span>` +
    `</div>`,

  row: (iconHtml: string, key: string, desc: string) =>
    `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;">` +
    `<span style="display:flex;align-items:center;justify-content:center;` +
    `background:rgba(0,0,0,0.3);border-radius:3px;padding:4px;min-width:24px;flex-shrink:0;">` +
    `${iconHtml}</span>` +
    `<span style="display:flex;flex:1;align-items:baseline;gap:8px;flex-wrap:wrap;">` +
    `<span style="color:${T.bg};font:bold 10px ${T.font};white-space:nowrap;">${key}</span>` +
    `<span style="color:${T.iron};font:9px ${T.font};">${desc}</span>` +
    `</span></div>`,

  resource: (iconHtml: string, name: string, color: string, source: string, use: string) =>
    `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;">` +
    `<span style="display:flex;align-items:center;justify-content:center;` +
    `background:rgba(0,0,0,0.3);border-radius:3px;padding:4px;min-width:24px;flex-shrink:0;">` +
    `${iconHtml}</span>` +
    `<span style="flex:1;">` +
    `<span style="color:${color};font:bold 10px ${T.font};">${name}</span>` +
    `<span style="color:${T.iron};font:9px ${T.font};"> — ${source}</span><br>` +
    `<span style="color:${T.iron};font:9px ${T.font};">${use}</span>` +
    `</span></div>`,

  towerRow: (icon: string, color: string, name: string, cost: string, desc: string) =>
    `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;">` +
    `<span style="display:flex;align-items:center;justify-content:center;` +
    `background:rgba(0,0,0,0.3);border-radius:3px;padding:4px;min-width:24px;flex-shrink:0;">` +
    getIcon(icon, 13, color) +
    `</span>` +
    `<span style="flex:1;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">` +
    `<span style="color:${T.bg};font:bold 10px ${T.font};">${name}</span>` +
    `<span style="color:${T.iron};font:9px ${T.font};">${desc}</span>` +
    `</span>` +
    `<span style="color:${T.ironGrey};font:9px ${T.font};white-space:nowrap;">${cost}</span>` +
    `</div>`,

  sep: () =>
    `<div style="height:1px;background:rgba(44,36,22,0.3);margin:1px 0;"></div>`,

  note: (color: string) =>
    `background:${color}12;border:1px solid ${color}33;border-radius:4px;` +
    `padding:9px 12px;display:flex;align-items:flex-start;gap:8px;` +
    `font:10px/1.6 ${T.font};color:${T.iron};`,

  rarityBadge: (color: string) =>
    `background:${color}22;border:1px solid ${color}55;border-radius:3px;` +
    `padding:2px 8px;color:${color};font:bold 9px ${T.font};letter-spacing:1px;`,

  branchBadge: (color: string) =>
    `background:${color}22;border:1px solid ${color}55;border-radius:3px;` +
    `padding:2px 8px;color:${color};font:bold 9px ${T.font};letter-spacing:1px;`,
}

function btnSecondary(): string {
  return `background:rgba(139,58,42,0.18);border:1px solid ${T.rust};` +
    `color:${T.bg};font:bold 11px ${T.font};padding:8px 18px;` +
    `border-radius:3px;cursor:pointer;letter-spacing:1px;`
}

function btnPrimary(accent: string): string {
  return `background:${accent};border:1px solid ${accent};` +
    `color:${T.bg};font:bold 11px ${T.font};padding:9px 22px;` +
    `border-radius:3px;cursor:pointer;letter-spacing:1px;` +
    `display:inline-flex;align-items:center;gap:6px;`
}

function btnStart(): string {
  return `background:${T.blood};border:2px solid ${T.blood};` +
    `color:${T.bg};font:bold 14px ${T.font};padding:13px 28px;` +
    `border-radius:3px;cursor:pointer;letter-spacing:2px;` +
    `display:inline-flex;align-items:center;gap:8px;` +
    `box-shadow:0 0 20px rgba(204,26,26,0.4);`
}
