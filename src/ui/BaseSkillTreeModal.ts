import { T } from './theme'
import { getIcon } from './icons'
import { BASE_SKILL_TREE, BASE_SKILL_TREE_EDGES, BASE_SKILL_TREE_MAP, SkillBranch } from '../data/baseSkillTree'
import type { HomeBase } from '../entities/HomeBase'
import type { ResourceManager } from '../systems/ResourceManager'
import type { Game } from '../core/Game'

const BRANCH_COLOR: Record<SkillBranch, string> = {
  root:   T.crystalCyan,
  active: T.amber,
  summon: '#4CAF50',
  tech:   T.coreBlue,
}

const RARITY_COLOR: Record<string, string> = {
  common:    T.ironGrey,
  rare:      T.coreBlue,
  legendary: T.gold,
}

const NODE_R   = 30   // node circle radius
const CANVAS_W = 2400
const CANVAS_H = 1800
const ROOT_X   = 1200
const ROOT_Y   = 700

export class BaseSkillTreeModal {
  private el: HTMLElement
  private svgEl!: SVGSVGElement
  private containerEl!: HTMLElement
  private wrapperEl!: HTMLElement
  private base!: HomeBase
  private resources!: ResourceManager
  private onCloseCallback?: () => void

  // Pan state
  private panX = 0
  private panY = 0
  private isDragging = false
  private dragStartX = 0
  private dragStartY = 0

  // Bound event handlers (for cleanup)
  private _onMouseMove: (e: MouseEvent) => void
  private _onMouseUp: () => void

  constructor(private game: Game) {
    this._onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return
      this.panX = e.clientX - this.dragStartX
      this.panY = e.clientY - this.dragStartY
      this.applyPan()
    }
    this._onMouseUp = () => {
      if (!this.isDragging) return
      this.isDragging = false
      if (this.wrapperEl) this.wrapperEl.style.cursor = 'grab'
    }

    this.el = document.createElement('div')
    this.el.id = 'base-skill-tree-modal'
    this.el.className = 'hidden'
    this.el.style.cssText = `
      position:fixed;inset:0;z-index:300;
      background:rgba(8,5,2,0.97);
      display:flex;flex-direction:column;
      overflow:hidden;
    `
    document.body.appendChild(this.el)
    this.buildShell()
  }

  private buildShell(): void {
    this.el.innerHTML = `
      <style>
        #bst-node-wrap { user-select:none; }
        .bst-node-circle { transition: box-shadow 0.15s, border-color 0.15s, background 0.15s; }
        @keyframes bst-owned-pulse {
          0%   { opacity: 0.7; transform: scale(1);    }
          50%  { opacity: 0.25; transform: scale(1.18); }
          100% { opacity: 0.7; transform: scale(1);    }
        }
        .bst-owned-ring {
          animation: bst-owned-pulse 2.4s ease-in-out infinite;
        }
      </style>

      <!-- Header -->
      <div style="
        display:flex;align-items:center;justify-content:space-between;
        padding:12px 20px 10px;
        border-bottom:1px solid rgba(139,58,42,0.4);
        background:rgba(14,9,5,0.99);
        flex-shrink:0;
        z-index:10;position:relative;
      ">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:3px;height:20px;background:${T.crystalCyan};border-radius:2px;box-shadow:0 0 8px ${T.crystalCyan};"></div>
          <div>
            <div style="color:${T.crystalCyan};font:bold 14px ${T.font};letter-spacing:2px;">BASE SKILL TREE</div>
            <div id="bst-crystal-info" style="color:${T.iron};font:9px ${T.font};margin-top:1px;"></div>
          </div>
        </div>

        <!-- Legend -->
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
          ${(['common','rare','legendary'] as const).map(r => `
            <div style="display:flex;align-items:center;gap:4px;">
              <div style="width:8px;height:8px;border-radius:50%;background:${RARITY_COLOR[r]};box-shadow:0 0 4px ${RARITY_COLOR[r]};"></div>
              <span style="color:${T.iron};font:8px ${T.font};letter-spacing:0.8px;">${r.toUpperCase()}</span>
            </div>
          `).join('')}
          <div style="width:1px;height:16px;background:rgba(139,58,42,0.3);"></div>
          ${(['active','summon','tech'] as const).map(b => `
            <div style="display:flex;align-items:center;gap:4px;">
              <div style="width:10px;height:2px;background:${BRANCH_COLOR[b]};border-radius:1px;"></div>
              <span style="color:${T.iron};font:8px ${T.font};letter-spacing:0.8px;">${b.toUpperCase()}</span>
            </div>
          `).join('')}
          <div style="width:1px;height:16px;background:rgba(139,58,42,0.3);"></div>
          <span style="color:${T.iron};font:8px ${T.font};opacity:0.6;">Drag to pan</span>
        </div>

        <!-- Close -->
        <button id="bst-close" style="
          background:transparent;border:1px solid rgba(139,58,42,0.4);
          color:${T.iron};font:bold 13px ${T.font};
          width:30px;height:30px;border-radius:4px;cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          flex-shrink:0;
        ">✕</button>
      </div>

      <!-- Tree canvas wrapper — drag area -->
      <div id="bst-wrapper" style="
        flex:1;
        overflow:hidden;
        position:relative;
        cursor:grab;
      ">
        <div id="bst-container" style="
          position:absolute;
          width:${CANVAS_W}px;
          height:${CANVAS_H}px;
          transform-origin:0 0;
        ">
          <svg id="bst-svg" style="
            position:absolute;inset:0;
            width:100%;height:100%;
            pointer-events:none;overflow:visible;
          " viewBox="0 0 ${CANVAS_W} ${CANVAS_H}"></svg>
        </div>
      </div>
    `

    this.wrapperEl   = this.el.querySelector('#bst-wrapper') as HTMLElement
    this.containerEl = this.el.querySelector('#bst-container') as HTMLElement
    this.svgEl       = this.el.querySelector('#bst-svg') as unknown as SVGSVGElement

    // Close button
    this.el.querySelector('#bst-close')!.addEventListener('click', () => this.hide())
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && !this.el.classList.contains('hidden')) this.hide()
    })

    // Drag-to-pan
    this.wrapperEl.addEventListener('mousedown', (e) => {
      // Don't start drag on node clicks
      const target = e.target as HTMLElement
      if (target.closest('.bst-node-wrap')) {
        // Only drag if clicking the empty background around the node icon area
        // Let node click handlers deal with unlocking
      }
      this.isDragging = true
      this.dragStartX = e.clientX - this.panX
      this.dragStartY = e.clientY - this.panY
      this.wrapperEl.style.cursor = 'grabbing'
      e.preventDefault()
    })
    window.addEventListener('mousemove', this._onMouseMove)
    window.addEventListener('mouseup', this._onMouseUp)
  }

  show(base: HomeBase, resources: ResourceManager, onClose?: () => void): void {
    this.base = base
    this.resources = resources
    this.onCloseCallback = onClose
    // Auto-unlock root node (free, always available)
    if (!this.base.appliedBaseSkills.has('baseCore')) {
      this.base.applyBaseSkill('baseCore')
    }
    this.el.classList.remove('hidden')
    this.centerOnRoot()
    this.render()
  }

  hide(): void {
    this.el.classList.add('hidden')
    this.onCloseCallback?.()
  }

  private centerOnRoot(): void {
    const vw = this.wrapperEl.clientWidth  || window.innerWidth
    const vh = this.wrapperEl.clientHeight || (window.innerHeight - 60)
    this.panX = vw / 2 - ROOT_X
    this.panY = vh / 2 - ROOT_Y
    this.applyPan()
  }

  private applyPan(): void {
    this.containerEl.style.transform = `translate(${this.panX}px, ${this.panY}px)`
  }

  private render(): void {
    this.renderCrystalInfo()
    this.renderEdges()
    this.renderNodes()
  }

  private renderCrystalInfo(): void {
    const el = this.el.querySelector('#bst-crystal-info') as HTMLElement | null
    if (el) {
      el.innerHTML = `${getIcon('gem', 11, T.crystalCyan)} <span style="color:${T.crystalCyan};font-weight:bold;">${this.resources.res.crystal}</span> crystals available`
    }
  }

  private renderEdges(): void {
    const existing = this.svgEl.querySelectorAll('.bst-edge')
    existing.forEach(e => e.remove())

    for (const [parentId, childId] of BASE_SKILL_TREE_EDGES) {
      const parent = BASE_SKILL_TREE_MAP.get(parentId)
      const child  = BASE_SKILL_TREE_MAP.get(childId)
      if (!parent || !child) continue

      const parentOwned = this.base.appliedBaseSkills.has(parentId)
      const childOwned  = this.base.appliedBaseSkills.has(childId)
      const branchColor = BRANCH_COLOR[child.branch] ?? T.iron

      // Bezier curve path
      const px = parent.x, py = parent.y
      const cx = child.x,  cy = child.y
      const isVertical = Math.abs(cy - py) > Math.abs(cx - px)
      let d: string
      if (isVertical) {
        const midY = (py + cy) / 2
        d = `M ${px} ${py} C ${px} ${midY}, ${cx} ${midY}, ${cx} ${cy}`
      } else {
        const midX = (px + cx) / 2
        d = `M ${px} ${py} C ${midX} ${py}, ${midX} ${cy}, ${cx} ${cy}`
      }

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', d)
      path.setAttribute('fill', 'none')
      path.setAttribute('class', 'bst-edge')

      if (parentOwned && childOwned) {
        path.setAttribute('stroke', branchColor)
        path.setAttribute('stroke-width', '2.5')
        path.setAttribute('stroke-opacity', '0.75')
      } else if (parentOwned) {
        path.setAttribute('stroke', branchColor)
        path.setAttribute('stroke-width', '1.5')
        path.setAttribute('stroke-opacity', '0.4')
        path.setAttribute('stroke-dasharray', '6 5')
      } else {
        path.setAttribute('stroke', 'rgba(80,60,40,0.2)')
        path.setAttribute('stroke-width', '1.5')
        path.setAttribute('stroke-opacity', '0.18')
      }

      this.svgEl.appendChild(path)
    }
  }

  private renderNodes(): void {
    this.containerEl.querySelectorAll('.bst-node-wrap').forEach(e => e.remove())

    for (const node of BASE_SKILL_TREE) {
      const owned      = this.base.appliedBaseSkills.has(node.id)
      const stacks     = this.base.appliedBaseSkills.get(node.id) ?? 0
      const maxed      = stacks >= node.maxStacks
      const prereqMet  = node.requiresSkill.every(r => this.base.appliedBaseSkills.has(r))
      const canAfford  = this.resources.res.crystal >= node.crystalCost
      const unlockable = prereqMet && !maxed && canAfford && !owned

      const rarityColor = RARITY_COLOR[node.rarity] ?? T.iron
      const branchColor = BRANCH_COLOR[node.branch] ?? T.iron

      // Visual state
      let nodeColor: string
      let borderColor: string
      let glow: string
      let iconColor: string

      if (owned) {
        nodeColor   = `${rarityColor}22`
        borderColor = rarityColor
        glow        = node.rarity === 'legendary'
          ? `0 0 0 3px ${rarityColor}55, 0 0 22px ${rarityColor}AA, 0 0 44px ${rarityColor}44, inset 0 0 12px ${rarityColor}33`
          : `0 0 0 3px ${rarityColor}44, 0 0 14px ${rarityColor}88, 0 0 28px ${rarityColor}33`
        iconColor   = rarityColor
      } else if (unlockable) {
        nodeColor   = `rgba(40,28,18,0.95)`
        borderColor = `${rarityColor}CC`
        glow        = `0 0 14px ${rarityColor}77, 0 0 28px ${rarityColor}22`
        iconColor   = `${rarityColor}EE`
      } else if (prereqMet && !canAfford) {
        nodeColor   = `rgba(30,20,10,0.85)`
        borderColor = `${rarityColor}44`
        glow        = 'none'
        iconColor   = `${rarityColor}55`
      } else {
        // Locked
        nodeColor   = `rgba(18,12,6,0.65)`
        borderColor = `rgba(55,44,30,0.3)`
        glow        = 'none'
        iconColor   = `rgba(70,60,45,0.4)`
      }

      const cannotReason = maxed
        ? 'MAXED OUT'
        : !prereqMet
          ? 'Prerequisites not met'
          : !canAfford
            ? `Need ${node.crystalCost} crystals`
            : ''

      const PAD = 10
      const wrap = document.createElement('div')
      wrap.className = 'bst-node-wrap'
      wrap.style.cssText = `
        position:absolute;
        left:${node.x - NODE_R - PAD}px;
        top:${node.y - NODE_R - PAD}px;
        width:${(NODE_R + PAD) * 2}px;
        cursor:${unlockable ? 'pointer' : (owned ? 'default' : 'not-allowed')};
        user-select:none;
      `

      wrap.innerHTML = `
        <!-- Circle -->
        <div class="bst-node-circle" style="
          width:${NODE_R * 2}px;height:${NODE_R * 2}px;
          margin:${PAD}px;
          border-radius:50%;
          background:${nodeColor};
          border:2.5px solid ${borderColor};
          box-shadow:${glow};
          display:flex;align-items:center;justify-content:center;
          position:relative;
        ">
          ${getIcon(node.icon, 18, iconColor)}

          ${owned ? `
            <div class="bst-owned-ring" style="
              position:absolute;inset:-6px;
              border-radius:50%;
              border:2px solid ${rarityColor};
              pointer-events:none;
            "></div>
          ` : ''}

          ${unlockable ? `
            <div style="
              position:absolute;top:-7px;left:-7px;
              width:15px;height:15px;
              background:${T.hpHigh};border-radius:50%;
              display:flex;align-items:center;justify-content:center;
              box-shadow:0 0 8px ${T.hpHigh};
            ">${getIcon('plus-circle', 9, '#000')}</div>
          ` : ''}

          ${node.crystalCost > 0 ? `
            <div style="
              position:absolute;bottom:-7px;right:-7px;
              background:rgba(8,5,2,0.98);
              border:1.5px solid ${unlockable ? T.crystalCyan : (owned ? `${rarityColor}66` : 'rgba(55,44,30,0.5)')};
              border-radius:4px;padding:1px 5px;
              display:flex;align-items:center;gap:2px;
              font:bold 8px ${T.font};
              color:${unlockable ? T.crystalCyan : (owned ? T.ironGrey : 'rgba(90,75,55,0.6)')};
              white-space:nowrap;pointer-events:none;
            ">
              ${getIcon('gem', 7, unlockable ? T.crystalCyan : (owned ? T.ironGrey : 'rgba(90,75,55,0.5)'))}${node.crystalCost}
            </div>
          ` : ''}

          ${node.maxStacks > 1 && stacks > 0 && !maxed ? `
            <div style="
              position:absolute;top:-7px;right:-7px;
              background:${T.rust};color:${T.bg};
              font:bold 8px ${T.font};
              border-radius:3px;padding:1px 4px;line-height:1.6;pointer-events:none;
            ">×${stacks}</div>
          ` : ''}
        </div>

        <!-- Label -->
        <div style="
          text-align:center;
          font:${node.rarity === 'legendary' ? 'bold ' : ''}9px ${T.font};
          color:${owned ? branchColor : (prereqMet ? T.bg : T.iron)};
          opacity:${prereqMet || owned ? '1' : '0.45'};
          line-height:1.3;max-width:${(NODE_R + PAD) * 2}px;
          padding:0 2px;white-space:normal;letter-spacing:0.2px;
        ">${node.label}</div>

        <!-- Tooltip — rendered above node in absolute space -->
        <div class="bst-tooltip" style="
          display:none;
          position:absolute;
          bottom:calc(100% + 10px);
          left:50%;transform:translateX(-50%);
          background:#0c0703;
          border:1px solid ${rarityColor}55;
          border-top:2px solid ${rarityColor};
          border-radius:6px;padding:10px 13px;
          min-width:180px;max-width:230px;
          z-index:600;
          pointer-events:none;
          box-shadow:0 4px 24px rgba(0,0,0,0.95);
          white-space:normal;
        ">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
            ${getIcon(node.icon, 12, rarityColor)}
            <span style="color:${rarityColor};font:bold 7px ${T.font};letter-spacing:1.5px;">${node.rarity.toUpperCase()}</span>
            <span style="color:${branchColor};font:bold 7px ${T.font};letter-spacing:1px;opacity:0.7;">${node.branch.toUpperCase()}</span>
          </div>
          <div style="color:${T.bg};font:bold 11px ${T.font};margin-bottom:5px;line-height:1.2;">${node.label}</div>
          <div style="color:${T.ironGrey};font:9px ${T.font};line-height:1.5;margin-bottom:6px;">${node.description}</div>
          ${node.maxStacks > 1 ? `
            <div style="color:${T.iron};font:8px ${T.font};margin-bottom:4px;">
              Stack: <span style="color:${T.bg};font-weight:bold;">${stacks}/${node.maxStacks}</span>
            </div>
          ` : ''}
          ${node.crystalCost > 0 ? `
            <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
              ${getIcon('gem', 9, T.crystalCyan)}
              <span style="color:${T.crystalCyan};font:bold 9px ${T.font};">${node.crystalCost} crystal</span>
            </div>
          ` : ''}
          ${node.requiresSkill.length > 0 ? `
            <div style="color:${T.iron};font:8px ${T.font};margin-bottom:4px;opacity:0.7;">
              Requires: ${node.requiresSkill.map(r => BASE_SKILL_TREE_MAP.get(r)?.label ?? r).join(', ')}
            </div>
          ` : ''}
          ${cannotReason ? `
            <div style="
              color:${T.blood};font:bold 8px ${T.font};
              border-top:1px solid rgba(139,58,42,0.3);
              padding-top:5px;margin-top:2px;
            ">${cannotReason}</div>
          ` : ''}
          ${unlockable ? `
            <div style="
              display:flex;align-items:center;gap:4px;
              border-top:1px solid rgba(76,175,80,0.35);
              padding-top:5px;margin-top:2px;
              color:${T.hpHigh};font:bold 8px ${T.font};
            ">${getIcon('check', 9, T.hpHigh)} Click to unlock</div>
          ` : ''}
        </div>
      `

      // Hover: show tooltip + amplify glow on unlockable nodes
      const circle = wrap.querySelector('.bst-node-circle') as HTMLElement | null
      wrap.addEventListener('mouseenter', () => {
        const tt = wrap.querySelector('.bst-tooltip') as HTMLElement | null
        if (tt) tt.style.display = 'block'
        if (circle && unlockable) {
          circle.style.boxShadow = `0 0 24px ${rarityColor}BB, 0 0 48px ${rarityColor}44`
          circle.style.borderColor = rarityColor
        }
      })
      wrap.addEventListener('mouseleave', () => {
        const tt = wrap.querySelector('.bst-tooltip') as HTMLElement | null
        if (tt) tt.style.display = 'none'
        if (circle && unlockable) {
          circle.style.boxShadow = glow
          circle.style.borderColor = borderColor
        }
      })

      // Click to unlock
      if (unlockable) {
        wrap.addEventListener('click', (e) => {
          e.stopPropagation()
          if (!this.resources.spend({ crystal: node.crystalCost })) return
          this.base.applyBaseSkill(node.id)
          this.render()
          this.game.hud.showMessage(`${node.label} unlocked!`, rarityColor, 2500)
        })
      }

      this.containerEl.appendChild(wrap)
    }
  }
}
