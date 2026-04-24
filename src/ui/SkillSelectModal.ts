import { SkillId, SKILL_DEFS } from '../systems/SkillManager'
import { T } from './theme'

export class SkillSelectModal {
  private el: HTMLElement

  constructor(_game: unknown) {
    this.el = document.getElementById('skill-modal')!
    this.el.classList.add('hidden')
  }

  show(options: SkillId[], onSelect: (id: SkillId) => void): void {
    const defs = options.map(id => SKILL_DEFS.find(s => s.id === id)!)

    this.el.innerHTML = `
      <div style="
        background:rgba(20,14,8,0.96);
        border:2px solid ${T.crystalCyan};
        border-radius:3px;
        padding:28px;max-width:480px;width:100%;
        display:flex;flex-direction:column;gap:16px;
        box-shadow: 0 0 40px rgba(136,238,255,0.1);
      ">
        <div style="
          color:${T.crystalCyan};
          font:bold 20px ${T.font};
          text-align:center;
          letter-spacing:2px;
          text-shadow: 0 0 20px rgba(136,238,255,0.4);
        ">TERRITORY BONUS</div>
        <div style="color:${T.iron};font:11px ${T.font};text-align:center;letter-spacing:1px;">CHOOSE 1 SPECIAL SKILL TO UNLOCK</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${defs.map(def => `
            <button class="skill-choice" data-id="${def.id}" style="
              background:rgba(20,28,36,0.8);
              border:1px solid rgba(119,136,255,0.25);
              color:${T.bg};
              font:13px ${T.font};padding:14px 16px;border-radius:2px;cursor:pointer;
              text-align:left;display:flex;flex-direction:column;gap:4px;
            ">
              <span style="color:${T.crystalCyan};font:bold 14px ${T.font};letter-spacing:0.5px;">${def.label}</span>
              <span style="color:${T.ironGrey};font:11px ${T.font};">${def.description}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `
    this.el.classList.remove('hidden')

    this.el.querySelectorAll('.skill-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id as SkillId
        this.hide()
        onSelect(id)
      })
    })
  }

  hide(): void {
    this.el.classList.add('hidden')
  }
}
