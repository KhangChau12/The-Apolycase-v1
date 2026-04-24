import { SkillId, SKILL_DEFS } from '../systems/SkillManager'
import { T } from './theme'

export interface GenericSkillOption {
  id: string
  label: string
  description: string
  icon: string
}

export class SkillSelectModal {
  private el: HTMLElement

  constructor(_game: unknown) {
    this.el = document.getElementById('skill-modal')!
    this.el.classList.add('hidden')
  }

  show(options: SkillId[], onSelect: (id: SkillId) => void): void {
    const defs = options.map(id => SKILL_DEFS.find(s => s.id === id)!)
    this.showGeneric(
      defs.map(d => ({ id: d.id, label: d.label, description: d.description, icon: '★' })),
      id => onSelect(id as SkillId),
      'TERRITORY BONUS',
      'CHOOSE 1 SPECIAL SKILL TO UNLOCK',
      T.crystalCyan,
    )
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
        border-radius:3px;
        padding:28px;max-width:480px;width:100%;
        display:flex;flex-direction:column;gap:16px;
        box-shadow: 0 0 40px rgba(0,0,0,0.5);
      ">
        <div style="
          color:${accentColor};
          font:bold 20px ${T.font};
          text-align:center;
          letter-spacing:2px;
          text-shadow: 0 0 20px ${accentColor}66;
        ">${title}</div>
        <div style="color:${T.iron};font:11px ${T.font};text-align:center;letter-spacing:1px;">${subtitle}</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${options.map(opt => `
            <button class="skill-choice" data-id="${opt.id}" style="
              background:rgba(20,28,36,0.8);
              border:1px solid rgba(196,98,45,0.25);
              color:${T.bg};
              font:13px ${T.font};padding:14px 16px;border-radius:2px;cursor:pointer;
              text-align:left;display:flex;align-items:center;gap:12px;
            ">
              <span style="font-size:22px;min-width:28px;text-align:center;">${opt.icon}</span>
              <span style="display:flex;flex-direction:column;gap:4px;">
                <span style="color:${accentColor};font:bold 14px ${T.font};letter-spacing:0.5px;">${opt.label}</span>
                <span style="color:${T.ironGrey};font:11px ${T.font};">${opt.description}</span>
              </span>
            </button>
          `).join('')}
        </div>
      </div>
    `
    this.el.classList.remove('hidden')

    this.el.querySelectorAll('.skill-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id!
        this.hide()
        onSelect(id)
      })
    })
  }

  hide(): void {
    this.el.classList.add('hidden')
  }
}
