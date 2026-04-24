import { InputManager } from './InputManager'
import { Camera } from './Camera'
import { Player } from '../entities/Player'
import { Zombie } from '../entities/Zombie'
import { HomeBase } from '../entities/HomeBase'
import { Tower } from '../towers/Tower'
import { TOWER_PROFILES, TowerType } from '../towers/TowerTypes'
import { WaveManager } from '../systems/WaveManager'
import { ResourceManager } from '../systems/ResourceManager'
import { TerritoryManager } from '../systems/TerritoryManager'
import { SkillManager } from '../systems/SkillManager'
import { HUD } from '../ui/HUD'
import { BreakPanel } from '../ui/BreakPanel'
import { GameOverScreen } from '../ui/GameOverScreen'
import { SkillSelectModal } from '../ui/SkillSelectModal'
import { TutorialOverlay } from '../ui/TutorialOverlay'
import { BuildContextMenu } from '../ui/BuildContextMenu'
import { TowerInspectMenu } from '../ui/TowerInspectMenu'
import { EffectsManager } from '../effects/EffectsManager'
import { T } from '../ui/theme'
import { DropItem } from '../entities/DropItem'
import { Bullet } from '../entities/Bullet'
import { spawnWave } from '../systems/Spawner'
import { dist } from '../utils/math'

const WORLD_W = 3000
const WORLD_H = 3000
export const BASE_X = WORLD_W / 2
export const BASE_Y = WORLD_H / 2

export type GamePhase = 'playing' | 'break' | 'gameover'

export class Game {
  private ctx: CanvasRenderingContext2D
  private lastTime = 0
  private running = false

  readonly input: InputManager
  readonly camera: Camera
  readonly player: Player
  readonly base: HomeBase
  readonly waveManager: WaveManager
  readonly resources: ResourceManager
  readonly territory: TerritoryManager
  readonly skills: SkillManager

  zombies: Zombie[] = []
  towers: Tower[] = []
  bullets: Bullet[] = []
  drops: DropItem[] = []
  readonly effects: EffectsManager

  hud!: HUD
  private breakPanel!: BreakPanel
  private gameOverScreen!: GameOverScreen
  private skillModal!: SkillSelectModal
  private buildContextMenu!: BuildContextMenu
  private towerInspectMenu!: TowerInspectMenu

  phase: GamePhase = 'playing'
  buildMode = false
  pendingTowerType: TowerType | null = null
  paused = false
  inspectedTower: Tower | null = null

  screenW = window.innerWidth
  screenH = window.innerHeight

  private shakeDuration = 0
  private shakeIntensity = 0

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!
    this.resizeCanvas()
    window.addEventListener('resize', () => this.resizeCanvas())

    this.effects = new EffectsManager()
    this.input = new InputManager()
    this.camera = new Camera(this.screenW, this.screenH)
    this.player = new Player(BASE_X, BASE_Y - 80)
    this.base = new HomeBase(BASE_X, BASE_Y)
    this.waveManager = new WaveManager()
    this.resources = new ResourceManager()
    this.territory = new TerritoryManager()
    this.skills = new SkillManager()

    this.hud = new HUD(this)
    this.breakPanel = new BreakPanel(this)
    this.gameOverScreen = new GameOverScreen(this)
    this.skillModal = new SkillSelectModal(this)
    void this.skillModal
    this.buildContextMenu = new BuildContextMenu(this)
    this.towerInspectMenu = new TowerInspectMenu(this)

    this.resources.add({ coins: 50, iron: 40, energyCore: 5 })
    this.enterBreak(10, false)
    this.hud.showMessage('Prepare your defenses. Wave 1 starts in 10s', T.amber, 2200)
    this.bindCanvasEvents()

    // Tutorial is shown first; game loop starts only after player closes it
    new TutorialOverlay(() => this.start())
  }

  private resizeCanvas(): void {
    this.screenW = window.innerWidth
    this.screenH = window.innerHeight
    this.canvas.width = this.screenW
    this.canvas.height = this.screenH
  }

  start(): void {
    this.running = true
    requestAnimationFrame(t => this.loop(t))
  }

  stop(): void {
    this.running = false
  }

  shake(intensity: number, duration: number): void {
    this.shakeIntensity = intensity
    this.shakeDuration = duration
  }

  private startWave(): void {
    this.waveManager.startNextWave()
    const batch = spawnWave(this.waveManager.waveIndex, this.waveManager.isBossWave, WORLD_W, WORLD_H)
    this.zombies.push(...batch)
    // Announce the wave (HUD may not exist yet on very first call from constructor)
    if (this.hud) {
      this.hud.triggerWaveAnnounce(this.waveManager.waveIndex, this.waveManager.isBossWave)
      if (this.waveManager.isBossWave) this.shake(6, 0.5)
    }
  }

  enterBreak(duration = this.waveManager.breakDuration, showPanel = true): void {
    this.paused = false
    this.phase = 'break'
    this.waveManager.enterBreak(duration)
    if (showPanel) this.breakPanel.show()
    else this.breakPanel.hide()
  }

  exitBreak(): void {
    this.paused = false
    this.breakPanel.hide()
    this.phase = 'playing'
    this.startWave()
  }

  skipBreak(): void {
    this.waveManager.skipBreak()
    this.exitBreak()
  }

  toggleUpgradePanel(): void {
    if (this.phase === 'gameover') return
    const willOpen = !this.breakPanel.isVisible
    this.breakPanel.toggle()
    // Pause simulation when panel opens mid-wave; resume when it closes
    if (this.phase === 'playing') {
      this.paused = willOpen
    }
  }

  expandTerritory(): void {
    const cost = this.territory.crystalCostForNextExpansion(this.resources.res.crystal)
    if (!this.resources.spend({ crystal: cost })) return
    this.territory.expand()
    const options = this.skills.unlockSlot()
    this.breakPanel.hide()
    this.skillModal.show(options, (chosen) => {
      const slot = this.skills.unlockedSlots - 1
      this.skills.equip(slot, chosen)
      this.breakPanel.show()
    })
    this.hud.showMessage(`Territory expanded! Radius: ${this.territory.radius}`, '#8ef')
  }

  placeTower(worldX: number, worldY: number, type: TowerType): void {
    const profile = TOWER_PROFILES[type]
    if (!this.resources.canAfford({ iron: profile.costIron, energyCore: profile.costCore })) {
      this.hud.showMessage('Not enough resources!', '#f88')
      return
    }
    if (!this.territory.isInsideTerritory(worldX, worldY, BASE_X, BASE_Y)) {
      this.hud.showMessage('Must place inside territory!', '#f88')
      return
    }
    this.resources.spend({ iron: profile.costIron, energyCore: profile.costCore })
    this.towers.push(new Tower(worldX, worldY, profile))
    this.hud.showMessage(`${profile.label} placed`, '#8f8')
  }

  private bindCanvasEvents(): void {
    // Left click: place tower if buildMode active (from BreakPanel flow)
    this.canvas.addEventListener('click', (e) => {
      if (this.buildContextMenu.visible) return
      if (!this.buildMode || !this.pendingTowerType) return
      const world = this.camera.toWorld(e.clientX, e.clientY)
      this.placeTower(world.x, world.y, this.pendingTowerType)
    })

    // Right click: inspect tower if clicked on one, otherwise build context menu
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      if (this.phase === 'gameover') return
      const world = this.camera.toWorld(e.clientX, e.clientY)
      const TOWER_HIT_RADIUS = 20
      const hitTower = this.towers.find(t => dist(t.x, t.y, world.x, world.y) < TOWER_HIT_RADIUS)
      if (hitTower) {
        this.buildContextMenu.hide()
        this.towerInspectMenu.show(e.clientX, e.clientY, hitTower, this.towers.indexOf(hitTower))
      } else {
        this.towerInspectMenu.hide()
        this.buildContextMenu.show(e.clientX, e.clientY, world.x, world.y)
      }
    })

    // Escape cancels build mode / closes upgrade panel and tower inspect
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        this.buildMode = false
        this.pendingTowerType = null
        this.buildContextMenu.hide()
        this.towerInspectMenu.hide()
        if (this.phase === 'playing' && this.breakPanel.isVisible) {
          this.breakPanel.hide()
          this.paused = false
        }
      }
      if (e.code === 'KeyU') {
        this.toggleUpgradePanel()
      }
    })
  }

  private loop(timestamp: number): void {
    if (!this.running) return
    const rawDt = Math.min((timestamp - this.lastTime) / 1000, 0.05)
    this.lastTime = timestamp

    if (!this.paused) {
      if (this.phase === 'playing') {
        this.update(rawDt)
      } else if (this.phase === 'break') {
        this.updateBreak(rawDt)
      }
    } else {
      // Still update HUD while paused so resources / messages refresh
      this.hud.update()
    }

    this.render()
    requestAnimationFrame(t => this.loop(t))
  }

  // During break: player moves freely, camera follows, drops expire, HUD ticks
  private updateBreak(dt: number): void {
    this.waveManager.update(dt)

    // Player can still move and aim during break
    this.player.update(dt, this.input, this.camera, this)
    this.camera.follow(this.player.x, this.player.y, WORLD_W, WORLD_H)

    // Bullets should keep traveling during break.
    for (const b of this.bullets) b.update(dt)
    this.bullets = this.bullets.filter(b => b.alive)

    // Drops still expire
    for (const d of this.drops) d.update(dt)
    this.tryPickupDrops()
    this.drops = this.drops.filter(d => !d.picked)

    // Particles fade out
    this.effects.update(dt)

    // Base regen continues
    this.base.update(dt)

    this.hud.update()

    if (this.waveManager.breakTimeLeft === 0) {
      this.exitBreak()
    }
  }

  private update(dt: number): void {
    if (this.shakeDuration > 0) this.shakeDuration -= dt

    const prevInvincible = this.player.invincibleTimer
    this.player.update(dt, this.input, this.camera, this)
    if (this.player.invincibleTimer > prevInvincible) {
      this.effects.triggerDamageFlash()
    }
    this.camera.follow(this.player.x, this.player.y, WORLD_W, WORLD_H)

    for (const b of this.bullets) b.update(dt)
    this.bullets = this.bullets.filter(b => b.alive)

    for (const z of this.zombies) {
      z.update(dt, this.base, this.towers, this)
    }

    // bullet ↔ zombie collision
    for (const b of this.bullets) {
      if (!b.alive) continue
      for (const z of this.zombies) {
        if (!z.alive) continue
        if (dist(b.x, b.y, z.x, z.y) < z.radius) {
          const hitAngle = b.angle
          z.takeDamage(b.damage)
          b.alive = false
          this.effects.spawnHitSpark(z.x, z.y, hitAngle)
          if (!z.alive) this.onZombieDead(z, hitAngle)
          break
        }
      }
    }

    // towers
    for (const t of this.towers) {
      t.update(dt, this.zombies, this.base, this.bullets, this.skills)
    }
    this.towers = this.towers.filter(t => t.alive)

    // base aura: heal allies, DOT zombies
    this.base.applyAura(dt, this.zombies, this.towers, this.player)
    // handle zombies killed by base aura DOT
    for (const z of this.zombies) {
      if (!z.alive && z.auraKill) {
        z.auraKill = false
        this.onZombieDead(z)
      }
    }

    for (const d of this.drops) d.update(dt)
    this.tryPickupDrops()
    this.drops = this.drops.filter(d => !d.picked)

    this.effects.update(dt)

    this.base.update(dt)

    // wave clear check
    if (this.zombies.filter(z => z.alive).length === 0 && this.waveManager.phase !== 'break') {
      this.zombies = []
      this.hud.triggerWaveClear(this.waveManager.waveIndex)
      if (this.waveManager.isBossWave) {
        this.resources.add({ crystal: 1 })
        this.hud.showMessage('Boss defeated! +1 Crystal ✦', T.gold)
        this.shake(10, 0.5)
        this.effects.triggerExplosionFlash()
      }
      this.enterBreak()
    }

    if (this.base.isDead) {
      this.phase = 'gameover'
      this.gameOverScreen.show()
    }

    this.hud.update()
  }

  private onZombieDead(z: Zombie, killAngle = 0): void {
    this.player.kills++
    this.drops.push(new DropItem(z.x, z.y, z.getDrops()))
    this.effects.spawnBloodSplatter(z.x, z.y, killAngle, z.archetype)
    const prevLevel = this.player.stats.level
    this.player.addXp(z.xpReward)
    if (this.player.stats.level > prevLevel) {
      this.hud.triggerLevelUp()
    }
  }

  private tryPickupDrops(): void {
    const pr = this.player.stats.pickupRange
    // Attract range is 3× pickup range — items glide toward player when within it
    const attractRange = pr * 3
    const px = this.player.x
    const py = this.player.y

    for (const d of this.drops) {
      if (d.picked) continue
      const dd = dist(px, py, d.x, d.y)
      if (dd < attractRange) d.attractTo(px, py)
      if (dd < pr) {
        this.resources.add({ coins: d.coins, iron: d.iron, energyCore: d.energyCore })
        if (d.crystal) this.resources.add({ crystal: 1 })
        if (d.ammo > 0) {
          this.player.reserveAmmo += d.ammo
          this.hud.showMessage(`+${d.ammo} ammo`, '#ee8', 800)
        }
        d.picked = true
        const parts: string[] = []
        if (d.iron > 0)   parts.push(`+${d.iron}⬡`)
        if (d.coins > 0)  parts.push(`+${d.coins}¢`)
        if (parts.length) this.hud.showMessage(parts.join('  '), '#ccc', 800)
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  private render(): void {
    const ctx = this.ctx
    ctx.save()

    if (this.shakeDuration > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.shakeIntensity * 2,
        (Math.random() - 0.5) * this.shakeIntensity * 2,
      )
    }

    ctx.clearRect(-20, -20, this.screenW + 40, this.screenH + 40)
    ctx.fillStyle = T.bg
    ctx.fillRect(0, 0, this.screenW, this.screenH)

    ctx.save()
    ctx.translate(-this.camera.x, -this.camera.y)

    this.renderWorld(ctx)
    this.renderTowers(ctx)
    this.renderDrops(ctx)
    this.renderBullets(ctx)
    this.renderZombies(ctx)
    this.renderPlayer(ctx)
    this.effects.renderWorld(ctx)
    this.renderBuildPreview(ctx)

    ctx.restore()
    ctx.restore()

    this.effects.renderScreen(ctx, this.screenW, this.screenH)
    this.renderMinimap(ctx)
    this.renderBuildHint(ctx)
  }

  // ── World ─────────────────────────────────────────────────────────

  private renderWorld(ctx: CanvasRenderingContext2D): void {
    // World fill
    ctx.fillStyle = T.bg
    ctx.fillRect(0, 0, WORLD_W, WORLD_H)

    // Grid lines
    ctx.strokeStyle = 'rgba(44,36,22,0.07)'
    ctx.lineWidth = 1
    for (let x = 0; x <= WORLD_W; x += 100) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); ctx.stroke()
    }
    for (let y = 0; y <= WORLD_H; y += 100) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.stroke()
    }

    ctx.strokeStyle = T.rust
    ctx.lineWidth = 5
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H)

    // Territory
    ctx.save()
    ctx.beginPath()
    ctx.arc(BASE_X, BASE_Y, this.territory.radius, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(139,58,42,0.04)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(196,98,45,0.35)'
    ctx.lineWidth = 2
    ctx.setLineDash([10, 8])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()

    // Home Base
    const b = this.base
    const pct = b.hp / b.maxHp
    const baseColor = T.hpColor(pct)
    ctx.save()
    ctx.beginPath()
    ctx.arc(b.x, b.y, 36, 0, Math.PI * 2)
    ctx.fillStyle = '#1a0e06'
    ctx.fill()
    ctx.strokeStyle = baseColor
    ctx.lineWidth = 4
    ctx.stroke()
    ctx.fillStyle = 'rgba(44,36,22,0.6)'
    ctx.fillRect(b.x - 40, b.y - 52, 80, 8)
    ctx.fillStyle = baseColor
    ctx.fillRect(b.x - 40, b.y - 52, 80 * pct, 8)
    ctx.fillStyle = T.bg
    ctx.font = `bold 12px ${T.font}`
    ctx.textAlign = 'center'
    ctx.fillText('BASE', b.x, b.y + 4)
    ctx.restore()

    // Base aura glow — warm amber
    const auraR = this.base.auraRadius
    const pulse = 0.04 + 0.02 * Math.sin(Date.now() / 600)
    ctx.save()
    ctx.beginPath()
    ctx.arc(b.x, b.y, auraR, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(232,160,48,${pulse})`
    ctx.fill()
    ctx.strokeStyle = `rgba(232,160,48,0.15)`
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 6])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  // ── Tower aura glow ───────────────────────────────────────────────

  // ── Towers ────────────────────────────────────────────────────────

  private renderTowers(ctx: CanvasRenderingContext2D): void {
    const styleMap: Record<string, { fill: string; stroke: string }> = {
      guard:      { fill: '#1a100a', stroke: '#C4622D' },
      barricade:  { fill: '#2a1a0a', stroke: '#8B3A2A' },
      shockPylon: { fill: '#0a0e1a', stroke: '#7788FF' },
      sniperPost: { fill: '#1a0e00', stroke: '#E8A030' },
      repairNode: { fill: '#0a1810', stroke: '#4CAF50' },
    }
    const rangeRingColor: Record<string, string> = {
      guard:      'rgba(196,98,45,0.12)',
      barricade:  'rgba(139,58,42,0.12)',
      shockPylon: 'rgba(119,136,255,0.12)',
      sniperPost: 'rgba(232,160,48,0.12)',
      repairNode: 'rgba(76,175,80,0.12)',
    }

    // Tower type icons drawn in canvas (crosshair, wall, lightning, scope, plus)
    const drawIcon = (ctx: CanvasRenderingContext2D, type: string, stroke: string) => {
      ctx.strokeStyle = stroke
      ctx.lineWidth = 1.5
      ctx.beginPath()
      if (type === 'guard') {
        // Crosshair
        ctx.moveTo(-5, 0); ctx.lineTo(5, 0)
        ctx.moveTo(0, -5); ctx.lineTo(0, 5)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(0, 0, 3, 0, Math.PI * 2)
        ctx.stroke()
      } else if (type === 'barricade') {
        // Horizontal bars
        ctx.moveTo(-6, -3); ctx.lineTo(6, -3)
        ctx.moveTo(-6, 0);  ctx.lineTo(6, 0)
        ctx.moveTo(-6, 3);  ctx.lineTo(6, 3)
        ctx.stroke()
      } else if (type === 'shockPylon') {
        // Lightning bolt
        ctx.moveTo(2, -6); ctx.lineTo(-2, 0); ctx.lineTo(2, 0); ctx.lineTo(-2, 6)
        ctx.stroke()
      } else if (type === 'sniperPost') {
        // Scope / long barrel
        ctx.moveTo(-7, 0); ctx.lineTo(7, 0)
        ctx.moveTo(3, -3); ctx.lineTo(3, 3)
        ctx.stroke()
      } else if (type === 'repairNode') {
        // Plus sign
        ctx.moveTo(-5, 0); ctx.lineTo(5, 0)
        ctx.moveTo(0, -5); ctx.lineTo(0, 5)
        ctx.stroke()
      }
    }

    for (const t of this.towers) {
      // Draw range ring for inspected tower
      if (t === this.inspectedTower && t.profile.range > 0) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(t.x, t.y, t.profile.range, 0, Math.PI * 2)
        ctx.fillStyle = rangeRingColor[t.profile.type] ?? 'rgba(255,255,255,0.08)'
        ctx.fill()
        ctx.strokeStyle = styleMap[t.profile.type]?.stroke ?? '#fff'
        ctx.lineWidth = 1.5
        ctx.globalAlpha = 0.6
        ctx.setLineDash([6, 4])
        ctx.stroke()
        ctx.setLineDash([])
        ctx.restore()
      }

      ctx.save()
      ctx.translate(t.x, t.y)
      const s = styleMap[t.profile.type] ?? { fill: '#1a100a', stroke: T.orange }
      const hpPct = t.hp / t.maxHp

      // Powered glow for level 2+
      if (t.level >= 2) {
        ctx.shadowColor = s.stroke
        ctx.shadowBlur = 8 + 4 * Math.sin(Date.now() / 400)
      }

      // Highlight border when inspected
      if (t === this.inspectedTower) {
        ctx.shadowColor = s.stroke
        ctx.shadowBlur = 14
      }

      ctx.fillStyle = s.fill
      ctx.strokeStyle = s.stroke
      ctx.lineWidth = t === this.inspectedTower ? 3 : 2
      ctx.beginPath()
      ctx.rect(-14, -14, 28, 28)
      ctx.fill()
      ctx.stroke()

      ctx.shadowBlur = 0

      // HP bar
      ctx.fillStyle = 'rgba(44,36,22,0.7)'
      ctx.fillRect(-14, -22, 28, 4)
      ctx.fillStyle = T.hpColor(hpPct)
      ctx.fillRect(-14, -22, 28 * hpPct, 4)

      // Type icon
      drawIcon(ctx, t.profile.type, s.stroke)

      if (t.level > 1) {
        ctx.fillStyle = T.amber
        ctx.font = `bold 9px ${T.font}`
        ctx.textAlign = 'center'
        ctx.fillText(`L${t.level}`, 0, 12)
      }

      ctx.restore()
    }
  }

  // ── Zombies ───────────────────────────────────────────────────────

  private renderZombies(ctx: CanvasRenderingContext2D): void {
    const fillColors: Record<string, string> = {
      regular: '#3a1a0a',
      fast:    '#1a2a10',
      tank:    '#2a1010',
      armored: '#1a1a2a',
      boss:    '#1a0000',
    }
    const strokeColors: Record<string, string> = {
      regular: '#8B3A2A',
      fast:    '#4CAF50',
      tank:    '#CC1A1A',
      armored: '#7A7060',
      boss:    '#CC1A1A',
    }
    for (const z of this.zombies) {
      if (!z.alive) continue
      ctx.save()
      ctx.translate(z.x, z.y)

      const isBoss = z.archetype === 'boss'
      ctx.fillStyle = fillColors[z.archetype] ?? '#2a1a0a'
      ctx.strokeStyle = strokeColors[z.archetype] ?? T.rust
      ctx.lineWidth = isBoss ? 4 : 1.5

      if (isBoss) {
        ctx.shadowColor = '#CC1A1A'
        ctx.shadowBlur = 16
      }

      ctx.beginPath()
      ctx.arc(0, 0, z.radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      if (isBoss) {
        // Outer pulsing ring
        ctx.shadowBlur = 0
        const ringAlpha = 0.5 + 0.3 * Math.sin(Date.now() / 200)
        ctx.strokeStyle = `rgba(204,26,26,${ringAlpha})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(0, 0, z.radius + 6, 0, Math.PI * 2)
        ctx.stroke()
        // BOSS label
        ctx.fillStyle = '#CC1A1A'
        ctx.font = `bold 9px ${T.font}`
        ctx.textAlign = 'center'
        ctx.fillText('BOSS', 0, -z.radius - 12)
      }

      ctx.shadowBlur = 0

      // HP bar
      const hpPct = z.hp / z.maxHp
      ctx.fillStyle = 'rgba(44,36,22,0.7)'
      ctx.fillRect(-z.radius, -z.radius - 8, z.radius * 2, 5)
      ctx.fillStyle = T.hpColor(hpPct)
      ctx.fillRect(-z.radius, -z.radius - 8, z.radius * 2 * hpPct, 5)

      ctx.restore()
    }
  }

  // ── Player ────────────────────────────────────────────────────────

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.angle)
    ctx.fillStyle = '#1a1008'
    ctx.strokeStyle = T.amber
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = T.ember
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(10, 0); ctx.lineTo(22, 0)
    ctx.stroke()
    ctx.restore()

    if (p.invincibleTimer > 0 && Math.floor(p.invincibleTimer * 10) % 2 === 0) {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.beginPath()
      ctx.arc(0, 0, 16, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(232,160,48,0.7)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()
    }
  }

  // ── Bullets / Drops / Particles ───────────────────────────────────

  private renderBullets(ctx: CanvasRenderingContext2D): void {
    for (const b of this.bullets) {
      // Trailing dot
      ctx.fillStyle = 'rgba(255,107,53,0.35)'
      ctx.beginPath()
      ctx.arc(b.x - Math.cos(b.angle) * 4, b.y - Math.sin(b.angle) * 4, 2, 0, Math.PI * 2)
      ctx.fill()
      // Main bullet
      ctx.fillStyle = T.ember
      ctx.beginPath()
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private renderDrops(ctx: CanvasRenderingContext2D): void {
    for (const d of this.drops) {
      if (d.picked) continue
      ctx.save()
      ctx.translate(d.x, d.y)
      const color = d.crystal
        ? T.crystalCyan
        : d.energyCore > 0 ? T.coreBlue
        : d.ammo > 0       ? T.amber
        : d.iron > 0       ? T.ironGrey
        : T.gold
      ctx.shadowColor = color
      ctx.shadowBlur = 4 + 2 * Math.sin(Date.now() / 300)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(0, 0, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.restore()
    }
  }

  // ── Build preview ghost when buildMode active (from BreakPanel) ───

  private renderBuildPreview(ctx: CanvasRenderingContext2D): void {
    if (!this.buildMode || !this.pendingTowerType) return
    const world = this.camera.toWorld(this.input.mouse.x, this.input.mouse.y)
    const inTerritory = this.territory.isInsideTerritory(world.x, world.y, BASE_X, BASE_Y)
    ctx.save()
    ctx.translate(world.x, world.y)
    ctx.globalAlpha = 0.5
    ctx.fillStyle = inTerritory ? '#2a4a2a' : '#4a1a1a'
    ctx.strokeStyle = inTerritory ? '#4f8' : '#f44'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.rect(-14, -14, 28, 28)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  // ── Build hint bar (shown mid-game) ───────────────────────────────

  private renderBuildHint(ctx: CanvasRenderingContext2D): void {
    if (this.phase !== 'playing') return
    const text = this.buildMode
      ? `Placing ${this.pendingTowerType ?? '?'} — Left Click to place · Esc to cancel`
      : 'Right Click → Build Tower'
    ctx.save()
    ctx.fillStyle = 'rgba(20,12,8,0.85)'
    ctx.fillRect(0, this.screenH - 92, this.screenW, 2)
    ctx.fillStyle = this.buildMode ? T.orange : T.iron
    ctx.font = `12px ${T.font}`
    ctx.textAlign = 'right'
    ctx.fillText(text, this.screenW - 16, this.screenH - 100)
    if (this.buildMode) {
      ctx.fillStyle = T.ember
      ctx.fillRect(0, this.screenH - 92, this.screenW, 2)
    }
    ctx.restore()
  }

  // ── Minimap ───────────────────────────────────────────────────────

  private renderMinimap(ctx: CanvasRenderingContext2D): void {
    const mw = 160, mh = 160
    const mx = this.screenW - mw - 12
    const my = 12
    const sx = mw / WORLD_W
    const sy = mh / WORLD_H

    ctx.save()
    ctx.fillStyle = 'rgba(28,20,12,0.88)'
    ctx.fillRect(mx, my, mw, mh)
    ctx.strokeStyle = T.rust
    ctx.lineWidth = 2
    ctx.strokeRect(mx, my, mw, mh)

    // Territory ring
    ctx.beginPath()
    ctx.arc(mx + BASE_X * sx, my + BASE_Y * sy, this.territory.radius * sx, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(196,98,45,0.6)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Base dot
    ctx.fillStyle = T.amber
    ctx.fillRect(mx + BASE_X * sx - 2, my + BASE_Y * sy - 2, 4, 4)

    // Tower dots
    ctx.fillStyle = T.orange
    for (const t of this.towers) {
      ctx.fillRect(mx + t.x * sx - 1.5, my + t.y * sy - 1.5, 3, 3)
    }

    // Zombie dots
    ctx.fillStyle = T.blood
    for (const z of this.zombies) {
      if (!z.alive) continue
      ctx.fillRect(mx + z.x * sx - 1, my + z.y * sy - 1, 2, 2)
    }

    // Player dot
    ctx.fillStyle = T.bg
    ctx.fillRect(mx + this.player.x * sx - 2, my + this.player.y * sy - 2, 4, 4)

    // MAP label
    ctx.fillStyle = T.iron
    ctx.font = `bold 8px ${T.font}`
    ctx.textAlign = 'left'
    ctx.fillText('MAP', mx + 4, my + 10)

    ctx.restore()
  }
}
