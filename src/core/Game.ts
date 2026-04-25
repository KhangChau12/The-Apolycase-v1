import { InputManager } from './InputManager'
import { Camera } from './Camera'
import { Player } from '../entities/Player'
import { Zombie } from '../entities/Zombie'
import { HomeBase } from '../entities/HomeBase'
import { Tower } from '../towers/Tower'
import { WorkerEntity } from '../entities/WorkerEntity'
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
import { PLAYER_SKILL_POOL } from '../data/playerSkillPool'
import { BASE_SKILL_POOL } from '../data/baseSkillPool'
import { loadCanvasIcons, drawCanvasIcon } from '../ui/canvasIcons'

const WORLD_W = 3000
const WORLD_H = 3000
export const BASE_X = WORLD_W / 2
export const BASE_Y = WORLD_H / 2

const BULLET_STREAK: Record<string, { len: number; w: number; color: string; glow: string }> = {
  pistol:       { len: 14, w: 1.5, color: 'rgba(255,225,140,1.0)',  glow: 'rgba(255,200,100,0.55)' },
  shotgun:      { len: 10, w: 2.0, color: 'rgba(255,185,70,1.0)',   glow: 'rgba(255,160,50,0.55)'  },
  assaultRifle: { len: 20, w: 1.5, color: 'rgba(255,235,150,1.0)',  glow: 'rgba(255,215,120,0.55)' },
  smg:          { len: 12, w: 1.2, color: 'rgba(255,215,120,1.0)',  glow: 'rgba(255,190,90,0.50)'  },
  sniperRifle:  { len: 38, w: 1.0, color: 'rgba(255,250,210,1.0)',  glow: 'rgba(255,240,170,0.60)' },
}
const DEFAULT_STREAK = { len: 12, w: 1.5, color: 'rgba(255,185,70,1.0)', glow: 'rgba(255,160,50,0.55)' }

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
  workers: WorkerEntity[] = []
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
  barrierMode = false
  pendingTowerType: TowerType | null = null
  paused = false
  inspectedTower: Tower | null = null

  screenW = window.innerWidth
  screenH = window.innerHeight

  private shakeDuration = 0
  private shakeMaxDuration = 0
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

    loadCanvasIcons([
      { icon: 'flame',      color: '#FF6820' },
      { icon: 'zap',        color: '#88eeff' },
      { icon: 'wrench',     color: '#4CAF50' },
      { icon: 'crosshair',  color: '#E8A030' },
      { icon: 'shield',     color: '#8B3A2A' },
    ])

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
    // Only override if new shake is stronger
    if (intensity >= this.shakeIntensity) {
      this.shakeIntensity = intensity
      this.shakeDuration = duration
      this.shakeMaxDuration = duration
    }
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
    const pool = this.base.appliedBaseSkills
    const available = BASE_SKILL_POOL.filter(s => (pool.get(s.id) ?? 0) < s.maxStacks)
    const options = [...available].sort(() => Math.random() - 0.5).slice(0, 3)
      .map(s => ({ id: s.id, label: s.label, description: s.description, icon: s.icon }))
    this.breakPanel.hide()
    this.skillModal.showGeneric(options, (id) => {
      this.base.applyBaseSkill(id as import('../data/baseSkillPool').BaseSkillId)
      this.breakPanel.show()
    }, 'TERRITORY EXPANDED', 'CHOOSE 1 BASE UPGRADE', T.crystalCyan)
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
    const tower = new Tower(worldX, worldY, profile)
    tower.spawnTime = Date.now()
    this.towers.push(tower)
    if (type === 'repairTower') {
      for (let wi = 0; wi < 3; wi++) this.workers.push(new WorkerEntity(tower))
    }
    this.shake(2, 0.15)
    this.hud.showMessage(`${profile.label} placed`, '#8f8')
  }

  private bindCanvasEvents(): void {
    // Left click: place tower if buildMode or barrierMode active
    this.canvas.addEventListener('click', (e) => {
      if (this.buildContextMenu.visible) return
      if (this.paused) return
      const world = this.camera.toWorld(e.clientX, e.clientY)
      if (this.barrierMode) {
        this.placeTower(world.x, world.y, 'barricade')
        return
      }
      if (!this.buildMode || !this.pendingTowerType) return
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

    // Escape cancels build/barrier mode / closes upgrade panel and tower inspect
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyB' && this.phase !== 'gameover' && !this.paused) {
        this.barrierMode = !this.barrierMode
        this.buildMode = false
        this.pendingTowerType = null
        this.hud.showMessage(
          this.barrierMode ? 'Barrier mode ON · Click to place (⬡3) · B or Esc to cancel' : 'Barrier mode OFF',
          this.barrierMode ? T.orange : T.iron,
        )
      }
      if (e.code === 'Escape') {
        this.buildMode = false
        this.barrierMode = false
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
    if (this.shakeDuration > 0) this.shakeDuration -= dt
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
    for (const b of this.bullets) {
      if (b.alive && b.isFireball) this.effects.spawnFireTrail(b.x, b.y, b.angle)
    }
    this.bullets = this.bullets.filter(b => b.alive)

    for (const z of this.zombies) {
      z.update(dt, this.base, this.towers, this)
    }

    // bullet ↔ zombie collision
    for (const b of this.bullets) {
      if (!b.alive) continue
      for (const z of this.zombies) {
        if (!z.alive) continue
        if (dist(b.x, b.y, z.x, z.y) < z.radius + b.radius) {
          if (b.hitZombies.has(z)) continue
          b.hitZombies.add(z)
          const hitAngle = b.angle
          z.takeDamage(b.damage)
          if (b.isBurning) {
            z.burnTimer = b.burnDps > 0 ? 3 : 0
            z.burnDps = b.burnDps
          }
          if (b.isExplosive) {
            for (const ez of this.zombies) {
              if (!ez.alive || ez === z) continue
              if (dist(b.x, b.y, ez.x, ez.y) < 60) {
                ez.takeDamage(b.damage * 0.5)
                if (!ez.alive) this.onZombieDead(ez, hitAngle)
              }
            }
            this.effects.spawnRadialBurst(b.x, b.y)
          }
          this.effects.spawnHitSpark(z.x, z.y, hitAngle)
          if (!z.alive) this.onZombieDead(z, hitAngle)
          // Fireball and penetrating bullets pass through; others die on first hit
          if (!b.isFireball && !b.isPenetrating) {
            b.alive = false
            break
          }
        }
      }
    }

    // burn DoT
    for (const z of this.zombies) {
      if (!z.alive || z.burnTimer <= 0) continue
      z.takeDamage(z.burnDps * dt)
      z.burnTimer -= dt
      if (!z.alive) this.onZombieDead(z)
    }

    // towers
    for (const t of this.towers) {
      t.update(dt, this.zombies, this.base, this.bullets, this.effects)
    }
    this.towers = this.towers.filter(t => t.alive)
    // workers
    for (const w of this.workers) w.update(dt, this.towers)
    this.workers = this.workers.filter(w => w.homeNode.alive)

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
    this.player.addXp(z.xpReward, () => {
      this.hud.triggerLevelUp()
      this.showPlayerLevelUpModal()
    })
  }

  private showPlayerLevelUpModal(): void {
    const pool = this.player.appliedPlayerSkills
    const available = PLAYER_SKILL_POOL.filter(s => (pool.get(s.id) ?? 0) < s.maxStacks)
    if (available.length === 0) return
    // Pick 3 random options (no duplicates)
    const shuffled = [...available].sort(() => Math.random() - 0.5).slice(0, 3)
    const options = shuffled.map(s => ({ id: s.id, label: s.label, description: s.description, icon: s.icon }))
    this.paused = true
    this.skillModal.showGeneric(options, (id) => {
      this.player.applyLevelUpSkill(id as import('../data/playerSkillPool').PlayerSkillId)
      this.paused = false
    }, 'LEVEL UP!', 'CHOOSE 1 PASSIVE SKILL', T.amber)
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
      // Exponential decay: shake peaks immediately and dies off fast
      const progress = this.shakeMaxDuration > 0 ? this.shakeDuration / this.shakeMaxDuration : 0
      const decayed = this.shakeIntensity * Math.pow(progress, 0.4)
      ctx.translate(
        (Math.random() - 0.5) * decayed * 2,
        (Math.random() - 0.5) * decayed * 2,
      )
    }

    ctx.clearRect(-20, -20, this.screenW + 40, this.screenH + 40)
    ctx.fillStyle = T.bg
    ctx.fillRect(0, 0, this.screenW, this.screenH)

    ctx.save()
    ctx.translate(-this.camera.x, -this.camera.y)

    this.renderWorld(ctx)
    this.renderTowers(ctx)
    this.renderWorkers(ctx)
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
      barricade:      { fill: '#2a1a0a', stroke: '#8B3A2A' },
      fireTower:      { fill: '#1a0800', stroke: '#FF6820' },
      electricTower:  { fill: '#0a0e1a', stroke: '#88eeff' },
      repairTower:    { fill: '#0a1810', stroke: '#4CAF50' },
      machineGunTower:{ fill: '#1a100a', stroke: '#E8A030' },
    }
    const rangeRingColor: Record<string, string> = {
      barricade:      'rgba(139,58,42,0.12)',
      fireTower:      'rgba(255,104,32,0.12)',
      electricTower:  'rgba(136,238,255,0.12)',
      repairTower:    'rgba(76,175,80,0.12)',
      machineGunTower:'rgba(232,160,48,0.12)',
    }

    const TOWER_SVG_ICON: Record<string, string> = {
      barricade:       'shield',
      fireTower:       'flame',
      electricTower:   'zap',
      repairTower:     'wrench',
      machineGunTower: 'crosshair',
    }

    const drawIcon = (ctx: CanvasRenderingContext2D, type: string, stroke: string) => {
      const iconName = TOWER_SVG_ICON[type]
      if (iconName) {
        // Use pre-rendered SVG image — drawn at 18×18 centered on tower
        ctx.save()
        ctx.globalAlpha = 0.92
        drawCanvasIcon(ctx, iconName, stroke, 0, 0, 18)
        ctx.restore()
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

      // Spawn scale animation: 1.4 → 1.0 over 150ms, cubic ease-out
      const SPAWN_MS = 150
      const elapsed = t.spawnTime > 0 ? Date.now() - t.spawnTime : SPAWN_MS
      const spawnT = Math.min(elapsed / SPAWN_MS, 1)
      const spawnScale = 1.4 - 0.4 * (1 - Math.pow(1 - spawnT, 3))
      if (spawnScale > 1.001) ctx.scale(spawnScale, spawnScale)

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

  private renderWorkers(ctx: CanvasRenderingContext2D): void {
    for (const w of this.workers) w.render(ctx)
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

      ctx.rotate(z.angle + Math.PI / 2)
      ctx.beginPath()
      this.drawZombieShape(ctx, z.archetype, z.radius)
      ctx.fill()
      ctx.stroke()
      ctx.rotate(-(z.angle + Math.PI / 2))

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

  private getZombiePolygonSides(archetype: string): number {
    switch (archetype) {
      case 'fast':    return 3
      case 'tank':    return 4
      case 'armored': return 5
      case 'boss':    return 6
      default:        return 8
    }
  }

  private drawZombieShape(ctx: CanvasRenderingContext2D, archetype: string, radius: number): void {
    const sides = this.getZombiePolygonSides(archetype)
    if (sides >= 8) {
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      return
    }
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2
      const px = Math.cos(a) * radius
      const py = Math.sin(a) * radius
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
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
    ctx.save()
    switch (this.player.currentWeapon.class) {
      case 'pistol':       this.drawWeaponPistol(ctx); break
      case 'shotgun':      this.drawWeaponShotgun(ctx); break
      case 'assaultRifle': this.drawWeaponAR(ctx); break
      case 'smg':          this.drawWeaponSMG(ctx); break
      case 'sniperRifle':  this.drawWeaponSniper(ctx); break
    }
    ctx.restore()
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
      if (b.isFireball) {
        ctx.save()
        const t = Date.now()
        const wobble = Math.sin(t / 80) * 0.18
        const backAngle = b.angle + Math.PI

        // Fiery tail — elongated teardrops behind the ball
        for (let ti = 1; ti <= 4; ti++) {
          const dist2 = ti * (b.radius * 0.85)
          const tx = b.x + Math.cos(backAngle) * dist2
          const ty = b.y + Math.sin(backAngle) * dist2
          const tr = b.radius * (1 - ti * 0.2) * (0.7 + 0.15 * Math.sin(t / 60 + ti))
          if (tr <= 0) break
          ctx.globalAlpha = (1 - ti * 0.22) * 0.85
          ctx.shadowColor = '#FF4400'
          ctx.shadowBlur = 10
          ctx.fillStyle = ti <= 2 ? '#FF5500' : '#FF3300'
          ctx.save()
          ctx.translate(tx, ty)
          ctx.rotate(b.angle + wobble * (ti % 2 === 0 ? 1 : -1))
          ctx.beginPath()
          ctx.ellipse(0, 0, tr * 0.65, tr, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }

        ctx.globalAlpha = 1

        // Outer fire layer
        ctx.shadowColor = '#FF4400'
        ctx.shadowBlur = 22
        ctx.fillStyle = '#FF5500'
        ctx.save()
        ctx.translate(b.x, b.y)
        ctx.rotate(wobble)
        ctx.beginPath()
        ctx.arc(0, 0, b.radius * 1.25, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        // Mid fire layer
        ctx.shadowBlur = 14
        ctx.fillStyle = '#FF8820'
        ctx.save()
        ctx.translate(b.x, b.y)
        ctx.rotate(-wobble * 1.3)
        ctx.beginPath()
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        // Hot core
        ctx.shadowColor = '#FFEE44'
        ctx.shadowBlur = 8
        ctx.fillStyle = '#FFEE44'
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()
        continue
      }
      // Light streak — two-pass (glow + core)
      const sk = (b.weaponClass && BULLET_STREAK[b.weaponClass]) ? BULLET_STREAK[b.weaponClass] : DEFAULT_STREAK
      const tailX = b.x - Math.cos(b.angle) * sk.len
      const tailY = b.y - Math.sin(b.angle) * sk.len
      ctx.lineCap = 'round'
      // Glow pass
      ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = sk.glow
      ctx.lineWidth = sk.w * 3
      ctx.shadowColor = sk.color
      ctx.shadowBlur = 5
      ctx.stroke()
      // Core pass
      ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = sk.color
      ctx.lineWidth = sk.w
      ctx.shadowBlur = 0
      ctx.stroke()
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

  // ── Build preview ghost when buildMode or barrierMode active ───────

  private renderBuildPreview(ctx: CanvasRenderingContext2D): void {
    const isBarrier = this.barrierMode
    const isTower = this.buildMode && this.pendingTowerType
    if (!isBarrier && !isTower) return
    const world = this.camera.toWorld(this.input.mouse.x, this.input.mouse.y)
    const inTerritory = this.territory.isInsideTerritory(world.x, world.y, BASE_X, BASE_Y)
    ctx.save()
    ctx.translate(world.x, world.y)
    ctx.globalAlpha = 0.55
    if (isBarrier) {
      ctx.fillStyle = inTerritory ? 'rgba(139,58,42,0.35)' : 'rgba(180,40,40,0.25)'
      ctx.strokeStyle = inTerritory ? T.rust : '#f44'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.rect(-14, -14, 28, 28)
      ctx.fill()
      ctx.stroke()
      // horizontal bars icon
      ctx.strokeStyle = inTerritory ? T.amber : '#f88'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(-9, -5); ctx.lineTo(9, -5)
      ctx.moveTo(-9, 0);  ctx.lineTo(9, 0)
      ctx.moveTo(-9, 5);  ctx.lineTo(9, 5)
      ctx.stroke()
      // cost label
      ctx.globalAlpha = 0.9
      ctx.fillStyle = T.amber
      ctx.font = `bold 9px ${T.font}`
      ctx.textAlign = 'center'
      ctx.fillText('⬡3', 0, 28)
    } else {
      ctx.fillStyle = inTerritory ? '#2a4a2a' : '#4a1a1a'
      ctx.strokeStyle = inTerritory ? '#4f8' : '#f44'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.rect(-14, -14, 28, 28)
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
  }

  // ── Build hint bar (shown mid-game) ───────────────────────────────

  private renderBuildHint(ctx: CanvasRenderingContext2D): void {
    if (this.phase !== 'playing') return
    const active = this.buildMode || this.barrierMode
    const text = this.barrierMode
      ? 'Barrier mode — Click to place (⬡3) · B or Esc to cancel'
      : this.buildMode
        ? `Placing ${this.pendingTowerType ?? '?'} — Left Click to place · Esc to cancel`
        : 'Right Click → Build Tower  ·  B → Barricade'
    ctx.save()
    ctx.fillStyle = 'rgba(20,12,8,0.85)'
    ctx.fillRect(0, this.screenH - 92, this.screenW, 2)
    ctx.fillStyle = active ? T.orange : T.iron
    ctx.font = `12px ${T.font}`
    ctx.textAlign = 'right'
    ctx.fillText(text, this.screenW - 16, this.screenH - 100)
    if (active) {
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

  // ── Weapon shape renderers (ctx already translated+rotated to player) ──

  private drawWeaponPistol(ctx: CanvasRenderingContext2D): void {
    // Slide / body
    ctx.fillStyle = '#bbb'
    ctx.fillRect(8, -2, 10, 4)
    // Barrel
    ctx.fillStyle = '#ddd'
    ctx.fillRect(14, -1.5, 10, 3)
    // Grip
    ctx.fillStyle = '#5a3a1a'
    ctx.fillRect(10, 2, 5, 6)
  }

  private drawWeaponShotgun(ctx: CanvasRenderingContext2D): void {
    // Receiver (wide)
    ctx.fillStyle = '#5a3a20'
    ctx.fillRect(8, -3, 14, 6)
    // Long barrel
    ctx.fillStyle = '#999'
    ctx.fillRect(14, -2, 18, 4)
    // Forend pump
    ctx.fillStyle = '#7a5030'
    ctx.fillRect(20, 2, 7, 3)
  }

  private drawWeaponAR(ctx: CanvasRenderingContext2D): void {
    // Upper receiver (long)
    ctx.fillStyle = '#555'
    ctx.fillRect(6, -3, 20, 5)
    // Barrel extension
    ctx.fillStyle = '#888'
    ctx.fillRect(22, -1.5, 10, 3)
    // Box magazine
    ctx.fillStyle = '#333'
    ctx.fillRect(12, 2, 7, 9)
    // Stock stub
    ctx.fillStyle = '#444'
    ctx.fillRect(4, -1.5, 4, 3)
  }

  private drawWeaponSMG(ctx: CanvasRenderingContext2D): void {
    // Compact body
    ctx.fillStyle = '#4a4a4a'
    ctx.fillRect(8, -3, 12, 6)
    // Short barrel
    ctx.fillStyle = '#777'
    ctx.fillRect(16, -1.5, 8, 3)
    // Vertical magazine
    ctx.fillStyle = '#333'
    ctx.fillRect(13, 3, 5, 9)
    // Forward grip
    ctx.fillStyle = '#5a3a1a'
    ctx.fillRect(9, 3, 4, 6)
  }

  private drawWeaponSniper(ctx: CanvasRenderingContext2D): void {
    // Very long barrel
    ctx.fillStyle = '#888'
    ctx.fillRect(8, -1.5, 30, 3)
    // Receiver body
    ctx.fillStyle = '#4a4a3a'
    ctx.fillRect(8, -3, 14, 6)
    // Scope body
    ctx.fillStyle = '#222'
    ctx.fillRect(11, -7, 10, 4)
    // Scope lens (front circle)
    ctx.fillStyle = '#4a88cc'
    ctx.beginPath()
    ctx.arc(11, -5, 1.8, 0, Math.PI * 2)
    ctx.fill()
    // Stock
    ctx.fillStyle = '#5a4a2a'
    ctx.fillRect(5, -1.5, 5, 3)
  }
}
