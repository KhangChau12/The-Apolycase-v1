import { T } from './theme'

export class TutorialOverlay {
  private el: HTMLElement
  private page = 0
  private onClose: () => void

  private readonly pages = [
    {
      title: 'OBJECTIVE',
      color: T.coreBlue,
      lines: [
        'Protect the HOME BASE at the center of the map.',
        'If the base reaches 0 HP → Game Over.',
        '',
        'Zombies spawn from the edges and march toward your base.',
        'Kill them before they reach it.',
      ],
    },
    {
      title: 'MOVEMENT & COMBAT',
      color: '#4CAF50',
      lines: [
        'WASD  — Move your character',
        'Mouse — Aim',
        'Left Click (hold) — Shoot',
        'R — Reload manually',
        '',
        'Kills drop Iron ⬡, Energy Core ◈, and Coins ¢.',
        'Walk over drops to pick them up automatically.',
      ],
    },
    {
      title: 'WAVES & BREAKS',
      color: T.amber,
      lines: [
        'Survive each wave by killing all zombies.',
        'Every 5th wave spawns a BOSS — defeat it to earn Crystal ✦.',
        '',
        'After each wave: 15-second BREAK PHASE.',
        '→ Move freely and build towers while the shop is open.',
        '→ Spend Crystal to expand territory and unlock skills.',
        '',
        'Press SKIP or wait for the next wave to begin.',
      ],
    },
    {
      title: 'BUILDING TOWERS',
      color: T.orange,
      lines: [
        'RIGHT CLICK anywhere on the map → Build Menu opens.',
        'Pick a tower → it places immediately at that spot.',
        'Press Escape to close the build menu.',
        '',
        'You can build ANY TIME — mid-wave or during breaks.',
        'Towers cost Iron ⬡ and Energy Core ◈.',
        'Towers must be placed inside your territory (orange ring).',
        '',
        'The BASE AURA heals nearby allies and damages zombies.',
      ],
    },
    {
      title: 'UPGRADES & SHOP',
      color: T.crystalCyan,
      lines: [
        'During BREAK PHASE, open the shop panel:',
        '→ Buy weapons and ammo',
        '→ Upgrade character stats (HP, Speed, Damage, Armor…)',
        '→ Upgrade towers (Level 1 → 2 → 3)',
        '→ Repair base and heal yourself',
        '',
        'Expand territory with Crystal ✦ to unlock Special Skills.',
        'Skills are chosen from 3 random options each expansion.',
      ],
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

    this.el.innerHTML = `
      <div style="
        background:rgba(20,14,8,0.97);
        border:1px solid ${T.rust};
        border-top:3px solid ${p.color};
        border-radius:3px;
        padding:32px;max-width:520px;width:100%;
        display:flex;flex-direction:column;gap:20px;
        box-shadow: 0 0 40px rgba(0,0,0,0.5);
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="color:${p.color};font:bold 20px ${T.font};letter-spacing:2px;">${p.title}</div>
          <div style="color:${T.iron};font:11px ${T.font};letter-spacing:1px;">${this.page + 1} / ${this.pages.length}</div>
        </div>

        <div style="display:flex;flex-direction:column;gap:4px;">
          ${p.lines.map(l => l === ''
            ? '<div style="height:6px;"></div>'
            : `<div style="color:${T.bg};font:12px/1.8 ${T.font};">${l}</div>`
          ).join('')}
        </div>

        <div style="display:flex;gap:10px;justify-content:space-between;align-items:center;">
          <div>
            ${this.page > 0
              ? `<button id="tut-prev" style="${tutBtn(T.rust)}">← Back</button>`
              : '<span></span>'
            }
          </div>
          <button id="tut-next" style="${tutBtn(isLast ? T.rust : T.orange)}">
            ${isLast ? '▶ START GAME' : 'NEXT →'}
          </button>
        </div>
      </div>
    `

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

function tutBtn(bg: string): string {
  return `
    background:${bg};border:1px solid rgba(44,36,22,0.5);
    color:${T.bg};font:bold 12px ${T.font};
    padding:9px 22px;border-radius:2px;cursor:pointer;letter-spacing:1px;
  `
}
