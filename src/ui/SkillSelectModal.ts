import { T } from './theme'
import { getIcon } from './icons'
import type { SkillRarity } from '../data/playerSkillPool'

export interface GenericSkillOption {
  id: string
  label: string
  description: string
  icon: string
  rarity?: SkillRarity
}

const RARITY_COLOR: Record<SkillRarity, string> = {
  common: '#A89880',
  rare: '#7788FF',
  legendary: '#E8C84A',
}

const RARITY_LABEL: Record<SkillRarity, string> = {
  common: '',
  rare: 'RARE',
  legendary: 'LEGENDARY',
}

function rarityBorder(rarity: SkillRarity | undefined): string {
  if (!rarity || rarity === 'common') return 'rgba(168,152,128,0.4)'
  if (rarity === 'rare') return 'rgba(119,136,255,0.6)'
  return 'rgba(232,200,74,0.8)'
}

function rarityGlow(rarity: SkillRarity | undefined): string {
  if (rarity === 'legendary') return '0 0 18px #E8C84A44'
  if (rarity === 'rare') return '0 0 10px #7788FF22'
  return 'none'
}

function rarityBadge(rarity: SkillRarity | undefined): string {
  if (!rarity || rarity === 'common') return ''
  const color = RARITY_COLOR[rarity]
  const label = RARITY_LABEL[rarity]
  return `<span style="
    position:absolute;top:6px;right:38px;
    color:${color};
    font:bold 8px ${T.font};
    letter-spacing:1px;
    text-shadow:0 0 8px ${color}88;
    opacity:0.9;
  ">${label}</span>`
}

export class SkillSelectModal {
  private el: HTMLElement
  private keyHandler: ((e: KeyboardEvent) => void) | null = null

  constructor(_game: unknown) {
    this.el = document.getElementById('skill-modal')!
    this.el.classList.add('hidden')
  }

  showGeneric(
    options: GenericSkillOption[],
    onSelect: (id: string) => void,
    title = 'LEVEL UP',
    subtitle = 'CHOOSE 1 SKILL',
    accentColor = T.amber,
  ): void {
    this.el.innerHTML = `
      <div style="
        background:rgba(20,14,8,0.96);
        border:2px solid ${accentColor};
        border-radius:4px;
        padding:28px;max-width:480px;width:100%;
        display:flex;flex-direction:column;gap:16px;
        box-shadow: 0 0 40px rgba(0,0,0,0.5), 0 0 80px ${accentColor}22;
      ">
        <div style="
          color:${accentColor};
          font:bold 20px ${T.font};
          text-align:center;
          letter-spacing:2px;
          text-shadow: 0 0 20px ${accentColor}66;
        ">${title}</div>
        <div style="color:${T.iron};font:11px ${T.font};text-align:center;letter-spacing:1px;">${subtitle}</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${options.map((opt, i) => {
            const border = rarityBorder(opt.rarity)
            const glow = rarityGlow(opt.rarity)
            const badgeHtml = rarityBadge(opt.rarity)
            const iconColor = opt.rarity && opt.rarity !== 'common' ? RARITY_COLOR[opt.rarity] : accentColor
            return `
            <button class="skill-choice" data-id="${opt.id}" style="
              position:relative;
              background:rgba(20,28,36,0.8);
              border:1px solid ${border};
              box-shadow:${glow};
              color:${T.bg};
              font:13px ${T.font};padding:14px 16px;border-radius:3px;cursor:pointer;
              text-align:left;display:flex;align-items:center;gap:12px;
              transition:background 0.15s, border-color 0.15s, box-shadow 0.15s;
            "
            onmouseover="this.style.background='rgba(30,42,52,0.95)';this.style.borderColor='${accentColor}99';this.style.boxShadow='0 0 12px ${accentColor}33'"
            onmouseout="this.style.background='rgba(20,28,36,0.8)';this.style.borderColor='${border}';this.style.boxShadow='${glow}'"
            >
              ${badgeHtml}
              <span style="
                display:flex;align-items:center;justify-content:center;
                min-width:36px;height:36px;
                background:rgba(0,0,0,0.35);
                border-radius:4px;
                padding:4px;
              ">${getIcon(opt.icon, 22, iconColor)}</span>
              <span style="display:flex;flex-direction:column;gap:4px;flex:1;">
                <span style="color:${iconColor};font:bold 14px ${T.font};letter-spacing:0.5px;">${opt.label}</span>
                <span style="color:${T.ironGrey};font:11px ${T.font};">${opt.description}</span>
              </span>
              <span style="
                color:${accentColor}99;
                font:bold 11px ${T.font};
                min-width:20px;
                text-align:center;
                background:rgba(0,0,0,0.3);
                border-radius:3px;
                padding:2px 5px;
                border:1px solid ${accentColor}44;
              ">${i + 1}</span>
            </button>`
          }).join('')}
        </div>
      </div>
    `
    this.el.classList.remove('hidden')

    const buttons = Array.from(this.el.querySelectorAll('.skill-choice')) as HTMLElement[]
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id!
        this.hide()
        onSelect(id)
      })
    })

    // Keyboard shortcuts 1/2/3
    if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler)
    this.keyHandler = (e: KeyboardEvent) => {
      const idx = parseInt(e.key) - 1
      if (idx >= 0 && idx < buttons.length) {
        const id = buttons[idx].dataset.id!
        this.hide()
        onSelect(id)
      }
    }
    document.addEventListener('keydown', this.keyHandler)
  }

  hide(): void {
    this.el.classList.add('hidden')
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler)
      this.keyHandler = null
    }
  }
}
