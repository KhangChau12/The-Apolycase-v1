import { InputManager } from './InputManager'
import { Camera } from './Camera'
import { Player } from '../entities/Player'
import { Zombie } from '../entities/Zombie'
import { HomeBase } from '../entities/HomeBase'
import { Tower } from '../towers/Tower'
import { WorkerEntity } from '../entities/WorkerEntity'
import { GarrisonUnit } from '../entities/GarrisonUnit'
import type { PendingSoldierBullet } from '../entities/GarrisonUnit'
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
import { BaseSkillTreeModal } from '../ui/BaseSkillTreeModal'
import { EffectsManager } from '../effects/EffectsManager'
import { T } from '../ui/theme'
import { DropItem } from '../entities/DropItem'
import { Bullet } from '../entities/Bullet'
import { spawnWave } from '../systems/Spawner'
import { dist, angleTo } from '../utils/math'
import { PLAYER_SKILL_POOL } from '../data/playerSkillPool'
import { loadCanvasIcons, drawCanvasIcon } from '../ui/canvasIcons'
import { GARRISON_PROFILES } from '../data/garrisonData'

const WORLD_W = 3000
const WORLD_H = 3000
export const BASE_X = WORLD_W / 2
export const BASE_Y = WORLD_H / 2

const BULLET_STREAK: Record<string, { len: number; w: number; color: string; glow: string }> = {
  pistol:       { len: 14, w: 1.5, color: 'rgba(255,225,140,1.0)',  glow: 'rgba(255,200,100,0.55)' },
  shotgun:      { len: 10, w: 2.0, color: 'rgba(255,185,70,1.0)',   glow: 'rgba(255,160,50,0.55)'  },
  assaultRifle: { len: 20, w: 1.5, color: 'rgba(255,235,150,1.0)',  glow: 'rgba(255,215,120,0.55)' },
  soldierDrone: { len: 10, w: 1.2, color: 'rgba(136,220,255,1.0)',  glow: 'rgba(68,136,255,0.65)'  },
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
  garrisonUnits: GarrisonUnit[] = []
  readonly effects: EffectsManager

  hud!: HUD
  private breakPanel!: BreakPanel
  private gameOverScreen!: GameOverScreen
  private skillModal!: SkillSelectModal
  private buildContextMenu!: BuildContextMenu
  private towerInspectMenu!: TowerInspectMenu
  baseSkillTreeModal!: BaseSkillTreeModal

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
    this.baseSkillTreeModal = new BaseSkillTreeModal(this)

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
    this.spawnGarrison()
    this.base.resetWaveFlags()
    this.startWave()
  }

  private spawnGarrison(): void {
    if (!this.base.garrisonEnabled) return
    this.garrisonUnits = []
    const count = this.base.garrisonUnitCount
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const x = BASE_X + Math.cos(angle) * 65
      const y = BASE_Y + Math.sin(angle) * 65
      this.garrisonUnits.push(new GarrisonUnit(x, y, 'soldier', GARRISON_PROFILES.soldier, this.base.garrisonHpMult, this.base.garrisonDamageMult))
    }
    if (this.base.garrisonHeavyEnabled) {
      this.garrisonUnits.push(new GarrisonUnit(BASE_X - 70, BASE_Y, 'heavy', GARRISON_PROFILES.heavy, this.base.garrisonHpMult, this.base.garrisonDamageMult))
    }
    if (this.base.garrisonMedicEnabled) {
      this.garrisonUnits.push(new GarrisonUnit(BASE_X, BASE_Y + 70, 'medic', GARRISON_PROFILES.medic, this.base.garrisonHpMult, 1))
    }
    if (this.base.garrisonTitanEnabled && this.waveManager.waveIndex % 3 === 0) {
      this.garrisonUnits.push(new GarrisonUnit(BASE_X + 70, BASE_Y - 70, 'titan', GARRISON_PROFILES.titan, this.base.garrisonHpMult, this.base.garrisonDamageMult))
    }
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

  openBaseSkillTree(): void {
    this.breakPanel.hide()
    this.baseSkillTreeModal.show(this.base, this.resources, () => {
      if (this.phase === 'break') this.breakPanel.show()
    })
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
    this.pushOutOfBase(this.player)
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
    this.pushOutOfBase(this.player)
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
      this.pushOutOfBase(z)
    }
    this.applyZombieSeparation()

    // bullet ↔ zombie collision
    for (const b of this.bullets) {
      if (!b.alive) continue
      for (const z of this.zombies) {
        if (!z.alive) continue
        if (dist(b.x, b.y, z.x, z.y) < z.radius + b.radius) {
          if (b.hitZombies.has(z)) continue
          b.hitZombies.add(z)
          const hitAngle = b.angle
          // AP Rounds: ignore 50% of armor for armored/boss
          let rawDmg = b.damage
          if (b.armorPiercing && (z.archetype === 'armored' || z.archetype === 'boss')) {
            rawDmg *= 1.5  // net result: 50% armor becomes 25% (effectively halved)
          }
          // Death Mark: double damage on enemies below 20% HP
          const dmg = b.deathMark && z.hp < z.maxHp * 0.2 ? rawDmg * 2 : rawDmg
          z.takeDamage(dmg)
          // Machine gun slow
          if (b.machineGunSlow) z.slowFactor = Math.max(z.slowFactor, 0.1)
          // Lifesteal: heal player based on damage dealt
          if (b.owner === 'player' && b.lifesteal > 0) {
            this.player.onBulletHit(dmg)
          }
          if (b.isBurning) {
            z.burnTimer = b.burnDps > 0 ? 3 : 0
            z.burnDps = b.burnDps
          }
          if (b.isExplosive) {
            const splashR = b.splashRadius
            const splashDmg = b.damage * b.splashFraction
            for (const ez of this.zombies) {
              if (!ez.alive || ez === z) continue
              if (dist(b.x, b.y, ez.x, ez.y) < splashR) {
                ez.takeDamage(splashDmg)
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
    for (const w of this.workers) w.update(dt, this.towers, this.base, this.zombies)
    this.workers = this.workers.filter(w => w.homeNode.alive)

    // garrison
    for (const u of this.garrisonUnits) {
      u.update(dt, this.zombies, this.towers, this.player, this.base)

      // Soldier burst bullets
      if (u.pendingSoldierBullets.length > 0) {
        for (const pb of u.pendingSoldierBullets) {
          this._spawnSoldierBullet(pb)
        }
        u.pendingSoldierBullets = []
      }

      // Heavy/Titan stomp splash AOE
      if (u.pendingStompSplash) {
        const s = u.pendingStompSplash
        u.pendingStompSplash = null
        const glowColor = u.profile.glowColor
        this.effects.spawnShockwaveDebris(s.x, s.y, glowColor)

        if (s.isPrimary && s.primaryTarget && s.primaryTarget.alive) {
          s.primaryTarget.takeDamage(s.primaryDamage ?? s.damage)
          if (!s.primaryTarget.alive) this.onZombieDead(s.primaryTarget)
        }

        for (const z of this.zombies) {
          if (!z.alive) continue
          if (s.isPrimary && z === s.primaryTarget) continue
          if (dist(s.x, s.y, z.x, z.y) > s.radius) continue
          const dmg = s.isPrimary ? s.damage * 0.6 : s.damage
          z.takeDamage(dmg)
          if (s.slowAmount > 0) z.slowFactor = Math.max(z.slowFactor, s.slowAmount)
          if (!z.alive) this.onZombieDead(z)
        }
      }

      // Legacy titan splash compat — cleared by new system, nullify if somehow still set
      u.titanSplashPending = null

      // Medic heal particles
      if (u.pendingHealParticle) {
        const p = u.pendingHealParticle
        u.pendingHealParticle = null
        this.effects.spawnHealParticles(p.x, p.y)
      }

      // Zombie hits garrison
      for (const z of this.zombies) {
        if (!z.alive || !u.alive) continue
        if (dist(u.x, u.y, z.x, z.y) < u.profile.radius + z.radius) {
          u.takeDamage(z.damage * dt, this.base)
        }
      }

      // Emergency respawn
      if (!u.alive && !u.hasRespawned && this.base.emergencyRespawnEnabled) {
        u.hasRespawned = true
        u.respawnTimer = 10
      }
      if (!u.alive && u.respawnTimer > 0) {
        u.respawnTimer -= dt
        if (u.respawnTimer <= 0) {
          u.hp = Math.round(u.maxHp * 0.5)
          u.alive = true
        }
      }
    }
    this.garrisonUnits = this.garrisonUnits.filter(u => u.alive || u.respawnTimer > 0)

    // Warlord's Command: teleport garrison when base HP < 40%
    if (this.base.warlordCallEnabled && !this.base.warlordUsedThisWave &&
        this.base.hp / this.base.maxHp < 0.4 && this.garrisonUnits.some(u => u.alive)) {
      this.base.warlordUsedThisWave = true
      const alive = this.garrisonUnits.filter(u => u.alive)
      alive.forEach((u, i) => {
        const angle = (i / alive.length) * Math.PI * 2
        u.x = BASE_X + Math.cos(angle) * 50
        u.y = BASE_Y + Math.sin(angle) * 50
      })
      this.hud.showMessage("Warlord's Command! Garrison teleported!", T.gold)
    }

    // Base active attacks
    if (this.base.fireboltEnabled && this.base.fireboltTimer >= this.base.fireboltCooldownMax) {
      this.base.fireboltTimer = 0
      const nearest = this.findNearestZombie(BASE_X, BASE_Y, 400)
      if (nearest) {
        const angle = angleTo(BASE_X, BASE_Y, nearest.x, nearest.y)
        const fb = new Bullet(BASE_X, BASE_Y, angle, 200, 40, 'tower')
        fb.isFireball = true; fb.isBurning = true; fb.burnDps = 6; fb.radius = 14
        this.bullets.push(fb)
      }
    }

    if (this.base.pendingArcDischarge) {
      this.base.pendingArcDischarge = false
      const inRange = this.zombies.filter(z => z.alive && dist(BASE_X, BASE_Y, z.x, z.y) < this.base.auraRadius)
        .sort((a, b) => dist(BASE_X, BASE_Y, a.x, a.y) - dist(BASE_X, BASE_Y, b.x, b.y))
        .slice(0, 5)
      if (inRange.length > 0) {
        const chainPoints: { x: number; y: number }[] = [{ x: BASE_X, y: BASE_Y }]
        for (const z of inRange) {
          z.takeDamage(35)
          chainPoints.push({ x: z.x, y: z.y })
          if (!z.alive) this.onZombieDead(z)
        }
        this.effects.spawnLightningChain(chainPoints)
      }
    }

    if (this.base.pendingMortarBarrage) {
      this.base.pendingMortarBarrage = false
      const targets = this.zombies.filter(z => z.alive && this.territory.isInsideTerritory(z.x, z.y, BASE_X, BASE_Y))
      for (let i = 0; i < 3 && targets.length > 0; i++) {
        const idx = Math.floor(Math.random() * targets.length)
        const t = targets.splice(idx, 1)[0]
        // AoE 50px splash, 80 damage
        for (const z of this.zombies) {
          if (!z.alive || dist(t.x, t.y, z.x, z.y) > 50) continue
          z.takeDamage(80)
          if (!z.alive) this.onZombieDead(z)
        }
        this.effects.spawnRadialBurst(t.x, t.y)
        this.shake(1.5, 0.1)
      }
    }

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
        this.territory.expand()
        this.hud.showMessage(`Boss defeated! +1 Crystal ✦ · Territory expanded to ${this.territory.radius}px`, T.gold, 3500)
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
    this.player.onKill()
    this.drops.push(new DropItem(z.x, z.y, z.getDrops()))
    this.effects.spawnBloodSplatter(z.x, z.y, killAngle, z.archetype)
    this.player.addXp(z.xpReward, () => {
      this.hud.triggerLevelUp()
      this.showPlayerLevelUpModal()
    })
  }

  private showPlayerLevelUpModal(): void {
    const rolledIds = this.skills.rollPlayerOptions(3, this.waveManager.waveIndex, this.player.appliedPlayerSkills)
    if (rolledIds.length === 0) return
    const options = rolledIds
      .map(id => PLAYER_SKILL_POOL.find(s => s.id === id)!)
      .filter(Boolean)
      .map(s => ({ id: s.id, label: s.label, description: s.description, icon: s.icon, rarity: s.rarity }))
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
    this.renderGarrisonUnits(ctx)
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

    // Territory — hexagon (flat-top, aligned with base hull)
    ctx.save()
    const tr = this.territory.radius
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6
      const px = BASE_X + Math.cos(a) * tr, py = BASE_Y + Math.sin(a) * tr
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(139,58,42,0.04)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(196,98,45,0.35)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()

    this.renderHomeBase(ctx)
  }

  private renderHomeBase(ctx: CanvasRenderingContext2D): void {
    const b = this.base
    const pct = b.hp / b.maxHp
    const baseColor = T.hpColor(pct)
    const isOverlord = b.overlordAuraEnabled
    const accentRgb = isOverlord ? '136,238,255' : '232,160,48'
    const accentHex = isOverlord ? '#88EEFF' : '#E8A030'
    const t = b.pulseTimer
    const pulse  = Math.sin(t * 1.8)       // slow heartbeat
    const pulse2 = Math.sin(t * 3.6 + 1)   // faster inner flicker
    const rot = b.rotationAngle

    // ── 0. Aura field ───────────────────────────────────────────────
    const auraR = b.auraRadius
    ctx.save()
    // Ambient radial gradient fill
    const auraGrad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, auraR)
    auraGrad.addColorStop(0,   `rgba(${accentRgb},0.09)`)
    auraGrad.addColorStop(0.5, `rgba(${accentRgb},0.04)`)
    auraGrad.addColorStop(1,   `rgba(${accentRgb},0.00)`)
    ctx.beginPath()
    ctx.arc(b.x, b.y, auraR, 0, Math.PI * 2)
    ctx.fillStyle = auraGrad
    ctx.fill()
    // Outer aura ring
    ctx.strokeStyle = `rgba(${accentRgb},0.18)`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(b.x, b.y, auraR, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    ctx.save()
    ctx.translate(b.x, b.y)

    // ── 1. Defense perimeter ring — slow counter-rotation ───────────
    // 12 evenly-spaced short brackets around r=62
    const defR = 62
    ctx.strokeStyle = `rgba(${accentRgb},0.25)`
    ctx.lineWidth = 1.5
    for (let i = 0; i < 12; i++) {
      const a = -rot * 0.4 + (i / 12) * Math.PI * 2
      const ox = Math.cos(a), oy = Math.sin(a)
      // bracket: arc-ish tick (two short angled lines meeting)
      const ia = a - 0.14, oa = a + 0.14
      ctx.beginPath()
      ctx.moveTo(Math.cos(ia) * (defR - 5), Math.sin(ia) * (defR - 5))
      ctx.lineTo(Math.cos(a) * (defR + 2), Math.sin(a) * (defR + 2))
      ctx.lineTo(Math.cos(oa) * (defR - 5), Math.sin(oa) * (defR - 5))
      ctx.stroke()
      // 4 of 12 are "lit" — brighter node dots
      if (i % 3 === 0) {
        ctx.fillStyle = `rgba(${accentRgb},0.55)`
        ctx.beginPath()
        ctx.arc(ox * defR, oy * defR, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // ── 2. Outer hull — hexagon (r=50), aligned with territory ──────
    const hullR = 50
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6
      const px = Math.cos(a) * hullR, py = Math.sin(a) * hullR
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.closePath()
    // Dark metallic fill
    const hullGrad = ctx.createRadialGradient(0, -12, 0, 0, 0, hullR)
    hullGrad.addColorStop(0,   '#252018')
    hullGrad.addColorStop(0.7, '#120e08')
    hullGrad.addColorStop(1,   '#0a0805')
    ctx.fillStyle = hullGrad
    ctx.fill()
    ctx.strokeStyle = baseColor
    ctx.lineWidth = 3.5
    ctx.stroke()

    // ── 3. Energy conduit spokes — 6 lines from core to hull ────────
    ctx.strokeStyle = `rgba(${accentRgb},${0.18 + 0.08 * pulse})`
    ctx.lineWidth = 1
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 22, Math.sin(a) * 22)
      ctx.lineTo(Math.cos(a) * 43, Math.sin(a) * 43)
      ctx.stroke()
    }

    // ── 4. Core chamber — hexagon (r=22) with radial gradient ───────
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6 + rot * 0.9  // slow rotation
      const px = Math.cos(a) * 22, py = Math.sin(a) * 22
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.closePath()
    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 22)
    coreGrad.addColorStop(0,   `rgba(${accentRgb},${0.55 + 0.2 * pulse})`)
    coreGrad.addColorStop(0.45,`rgba(${accentRgb},0.15)`)
    coreGrad.addColorStop(1,   `rgba(${accentRgb},0.02)`)
    ctx.fillStyle = coreGrad
    ctx.fill()
    ctx.strokeStyle = `rgba(${accentRgb},${0.7 + 0.25 * pulse})`
    ctx.lineWidth = 1.8
    ctx.shadowColor = accentHex
    ctx.shadowBlur = 8 + 6 * pulse
    ctx.stroke()
    ctx.shadowBlur = 0

    // ── 7. Reactor core — small circle with strong glow ─────────────
    const reactorGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 12)
    reactorGrad.addColorStop(0,   `rgba(${accentRgb},${0.9 + 0.08 * pulse2})`)
    reactorGrad.addColorStop(0.4, `rgba(${accentRgb},0.45)`)
    reactorGrad.addColorStop(1,   `rgba(${accentRgb},0)`)
    ctx.shadowColor = accentHex
    ctx.shadowBlur = 18 + 8 * pulse
    ctx.beginPath()
    ctx.arc(0, 0, 11, 0, Math.PI * 2)
    ctx.fillStyle = reactorGrad
    ctx.fill()
    ctx.shadowBlur = 0

    // Hard core center dot
    ctx.fillStyle = '#FFFFFF'
    ctx.globalAlpha = 0.7 + 0.25 * pulse2
    ctx.beginPath()
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    // ── 8. Shield dome (if active) ──────────────────────────────────
    if (b.shieldHp > 0 && b.shieldPulseMaxHp > 0) {
      const shieldPct = b.shieldHp / b.shieldPulseMaxHp
      const shieldPulse = 0.5 + 0.3 * Math.abs(pulse)
      ctx.strokeStyle = `rgba(136,238,255,${shieldPct * shieldPulse})`
      ctx.lineWidth = 2
      ctx.shadowColor = '#88EEFF'
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(0, 0, 58, 0, Math.PI * 2)
      ctx.stroke()
      // second inner ring for depth
      ctx.strokeStyle = `rgba(136,238,255,${shieldPct * 0.2})`
      ctx.lineWidth = 6
      ctx.shadowBlur = 0
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    // ── 9. HP bar ───────────────────────────────────────────────────
    const barW = 84, barH = 6, barX = -barW / 2, barY = -76
    ctx.fillStyle = 'rgba(10,8,4,0.8)'
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2)
    ctx.fillStyle = `rgba(${accentRgb},0.15)`
    ctx.fillRect(barX, barY, barW, barH)
    ctx.fillStyle = baseColor
    ctx.shadowColor = baseColor; ctx.shadowBlur = 4
    ctx.fillRect(barX, barY, barW * pct, barH)
    ctx.shadowBlur = 0

    // ── 10. HP label ────────────────────────────────────────────────
    ctx.fillStyle = `rgba(${accentRgb},0.55)`
    ctx.font = `8px ${T.font}`
    ctx.textAlign = 'center'
    ctx.fillText(`${Math.ceil(b.hp)} / ${b.maxHp}`, 0, barY - 4)

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
    const isDrone = this.base.fortressProtocolEnabled
    for (const w of this.workers) w.render(ctx, isDrone)
  }

  private renderGarrisonUnits(ctx: CanvasRenderingContext2D): void {
    for (const u of this.garrisonUnits) {
      if (!u.alive) continue

      const r = u.profile.radius
      const glow = u.profile.glowColor
      const fill = u.profile.color
      const isFlashing = u.attackFlashTimer > 0

      // Body scale animation
      let scale = 1.0
      if (u.type === 'titan' && u.titanWindupActive) {
        const windupPct = 1 - (u.titanWindupTimer / u.titanWindupMax)
        scale = 1.0 - 0.25 * windupPct
      } else if (u.stompPulseTimer > 0) {
        const pulsePct = u.stompPulseTimer / u.stompPulseMax
        scale = 1.0 + 0.28 * pulsePct
      }

      // --- Draw body (rotated + scaled) ---
      ctx.save()
      ctx.translate(u.x, u.y)
      ctx.rotate(u.angle + Math.PI / 2)
      ctx.scale(scale, scale)
      ctx.shadowColor = glow
      ctx.shadowBlur = isFlashing ? 28 : 10
      if (u.type === 'soldier') {
        this._drawSoldierShape(ctx, r, fill, glow, isFlashing)
      } else if (u.type === 'heavy') {
        this._drawHeavyShape(ctx, r, fill, glow)
      } else if (u.type === 'medic') {
        this._drawMedicShape(ctx, r, fill, glow, u.healAuraTimer)
      } else if (u.type === 'titan') {
        this._drawTitanShape(ctx, r, fill, glow, isFlashing)
      }
      ctx.shadowBlur = 0
      ctx.restore()

      // --- Draw shockwave ring + HP bar (world-aligned, only translate) ---
      ctx.save()
      ctx.translate(u.x, u.y)

      if (u.stompPulseTimer > 0) {
        const progress = 1 - u.stompPulseTimer / u.stompPulseMax
        const ringR = r * (1.5 + progress * 3.5)
        const alpha = (1 - progress) * 0.75
        ctx.strokeStyle = glow
        ctx.lineWidth = Math.max(0.5, 2.5 - progress * 2)
        ctx.globalAlpha = alpha
        ctx.shadowColor = glow
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(0, 0, ringR, 0, Math.PI * 2)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }

      // HP bar
      const hpPct = u.hp / u.maxHp
      const barW = r * 2.2
      const barY = -r - 12
      ctx.fillStyle = 'rgba(10,10,10,0.75)'
      ctx.fillRect(-barW / 2, barY, barW, 5)
      ctx.fillStyle = T.hpColor(hpPct)
      ctx.fillRect(-barW / 2, barY, barW * hpPct, 5)

      ctx.restore()
    }
  }

  private _drawSoldierShape(ctx: CanvasRenderingContext2D, r: number, fill: string, glow: string, flashing: boolean): void {
    // Main body — sleek triangle (pointed up)
    ctx.fillStyle = fill
    ctx.strokeStyle = glow
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.moveTo(0, -r)
    ctx.lineTo(r * 0.55, r * 0.7)
    ctx.lineTo(-r * 0.55, r * 0.7)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Wing nubs (mechanical details)
    ctx.fillStyle = glow
    ctx.globalAlpha = 0.7
    ctx.fillRect(-r * 0.88, -r * 0.05, r * 0.33, r * 0.28)
    ctx.fillRect(r * 0.55, -r * 0.05, r * 0.33, r * 0.28)
    ctx.globalAlpha = 1

    // Cockpit core
    ctx.fillStyle = flashing ? '#FFFFFF' : glow
    ctx.shadowColor = glow
    ctx.shadowBlur = flashing ? 14 : 6
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }

  private _drawHeavyShape(ctx: CanvasRenderingContext2D, r: number, fill: string, glow: string): void {
    // Pentagon body
    ctx.fillStyle = fill
    ctx.strokeStyle = glow
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Bolt circles at corners
    ctx.fillStyle = glow
    ctx.globalAlpha = 0.8
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2
      ctx.beginPath()
      ctx.arc(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, r * 0.1, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Inner panel (mechanical detail)
    ctx.strokeStyle = glow
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.45
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2
      if (i === 0) ctx.moveTo(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52)
      else ctx.lineTo(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52)
    }
    ctx.closePath()
    ctx.stroke()
    ctx.globalAlpha = 1

    // Center core
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2)
    ctx.fill()
  }

  private _drawMedicShape(ctx: CanvasRenderingContext2D, r: number, fill: string, glow: string, auraTimer: number): void {
    // Pulsing aura ring (drawn first, behind body)
    const auraAlpha = 0.28 + 0.18 * Math.sin(auraTimer * 4)
    const auraR = r + 7 + 3 * Math.sin(auraTimer * 3)
    ctx.strokeStyle = glow
    ctx.lineWidth = 2
    ctx.globalAlpha = auraAlpha
    ctx.shadowColor = glow
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(0, 0, auraR, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1

    // Circle body
    ctx.fillStyle = fill
    ctx.strokeStyle = glow
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Cross symbol inside (bright green)
    ctx.fillStyle = glow
    ctx.shadowColor = glow
    ctx.shadowBlur = 6
    ctx.fillRect(-r * 0.2, -r * 0.62, r * 0.4, r * 1.24)
    ctx.fillRect(-r * 0.62, -r * 0.2, r * 1.24, r * 0.4)
    ctx.shadowBlur = 0
  }

  private _drawTitanShape(ctx: CanvasRenderingContext2D, r: number, fill: string, glow: string, flashing: boolean): void {
    // Outer dim ring (aura)
    ctx.strokeStyle = glow
    ctx.lineWidth = 1.5
    ctx.globalAlpha = 0.25
    ctx.beginPath()
    ctx.arc(0, 0, r + 8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1

    // Hexagon body
    ctx.fillStyle = fill
    ctx.strokeStyle = glow
    ctx.lineWidth = 2.5
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Inner hexagon detail
    ctx.strokeStyle = glow
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6
      if (i === 0) ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55)
      else ctx.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55)
    }
    ctx.closePath()
    ctx.stroke()
    ctx.globalAlpha = 1

    // Spoke lines from center to inner hex vertices
    ctx.strokeStyle = glow
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.35
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Center core
    const coreColor = flashing ? '#FFFFFF' : glow
    ctx.fillStyle = coreColor
    ctx.shadowColor = glow
    ctx.shadowBlur = flashing ? 20 : 8
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }

  private _spawnSoldierBullet(pb: PendingSoldierBullet): void {
    const speed = 800
    // Sum damage of all alive soldiers and divide by burst (3 shots × 2 bullets = 6 bullet events per cooldown)
    const totalSoldierDmg = this.garrisonUnits
      .filter(u => u.type === 'soldier' && u.alive)
      .reduce((sum, u) => sum + u.damage, 0) || 15
    const perShotDmg = totalSoldierDmg / 1.5 / 3 / 2

    for (const angle of [pb.angle, pb.angle2]) {
      const b = new Bullet(pb.x, pb.y, angle, speed, perShotDmg, 'tower')
      b.isExplosive = true
      b.splashRadius = 40
      b.splashFraction = 0.5
      b.weaponClass = 'soldierDrone'
      this.bullets.push(b)
    }
  }

  private pushOutOfBase(obj: { x: number; y: number; radius?: number }): void {
    const solidR = 52  // matches rendered hull r=50 + small margin
    const objR = obj.radius ?? 8
    const minDist = solidR + objR
    const dx = obj.x - BASE_X
    const dy = obj.y - BASE_Y
    const d2 = dx * dx + dy * dy
    if (d2 < minDist * minDist && d2 > 0) {
      const d = Math.sqrt(d2)
      const push = minDist - d
      obj.x += (dx / d) * push
      obj.y += (dy / d) * push
    }
  }

  private applyZombieSeparation(): void {
    const alive = this.zombies.filter(z => z.alive)
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const minDist = a.radius + b.radius + 2
        const d2 = dx * dx + dy * dy
        if (d2 >= minDist * minDist || d2 === 0) continue
        const d = Math.sqrt(d2)
        const overlap = (minDist - d) * 0.5
        const nx = dx / d, ny = dy / d
        a.x -= nx * overlap
        a.y -= ny * overlap
        b.x += nx * overlap
        b.y += ny * overlap
      }
    }
  }

  private findNearestZombie(x: number, y: number, range: number): Zombie | null {
    let best: Zombie | null = null
    let bestDist = range
    for (const z of this.zombies) {
      if (!z.alive) continue
      const d = dist(x, y, z.x, z.y)
      if (d < bestDist) { bestDist = d; best = z }
    }
    return best
  }

  // ── Zombies ───────────────────────────────────────────────────────

  private renderZombies(ctx: CanvasRenderingContext2D): void {
    for (const z of this.zombies) {
      if (!z.alive) continue
      ctx.save()
      ctx.translate(z.x, z.y)

      // Per-archetype body (rotated to movement direction)
      ctx.rotate(z.angle + Math.PI / 2)
      switch (z.archetype) {
        case 'regular': this._drawZombieRegular(ctx, z.radius, z.tier, z.wobbleTimer); break
        case 'fast':    this._drawZombieFast(ctx, z.radius, z.tier, z.wobbleTimer, z.slowFactor); break
        case 'tank':    this._drawZombieTank(ctx, z.radius, z.tier, z.wobbleTimer); break
        case 'armored': this._drawZombieArmored(ctx, z.radius, z.tier, z.wobbleTimer); break
        case 'boss':    this._drawZombieBoss(ctx, z.radius); break
      }
      ctx.rotate(-(z.angle + Math.PI / 2))

      // Attack flash — red arc slash
      if (z.attackFlashTimer > 0) {
        const slashAlpha = Math.min(1, z.attackFlashTimer / 0.12)
        ctx.strokeStyle = `rgba(255,34,0,${slashAlpha})`
        ctx.lineWidth = 2.5
        ctx.shadowColor = '#FF2200'
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.arc(0, 0, z.radius + 5, -Math.PI / 3, Math.PI / 3)
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      ctx.shadowBlur = 0

      // HP bar
      const hpPct = z.hp / z.maxHp
      const barY = -z.radius - 9
      ctx.fillStyle = 'rgba(44,36,22,0.75)'
      ctx.fillRect(-z.radius, barY, z.radius * 2, 5)
      ctx.fillStyle = T.hpColor(hpPct)
      ctx.fillRect(-z.radius, barY, z.radius * 2 * hpPct, 5)

      // Tier indicator: N amber diamonds above HP bar
      if (z.tier > 0) {
        const diamondSize = 3.5
        const gap = 7
        const totalW = z.tier * gap - gap + diamondSize * 2
        const startX = -totalW / 2 + diamondSize
        ctx.fillStyle = T.amber
        ctx.shadowColor = T.amber
        ctx.shadowBlur = 4
        for (let i = 0; i < z.tier; i++) {
          const dx = startX + i * gap
          const dy = barY - 7
          ctx.beginPath()
          ctx.moveTo(dx,                   dy - diamondSize)
          ctx.lineTo(dx + diamondSize,     dy)
          ctx.lineTo(dx,                   dy + diamondSize)
          ctx.lineTo(dx - diamondSize,     dy)
          ctx.closePath()
          ctx.fill()
        }
        ctx.shadowBlur = 0
      }

      // BOSS label badge
      if (z.archetype === 'boss') {
        const by = -z.radius - 22
        ctx.fillStyle = 'rgba(20,0,0,0.75)'
        ctx.fillRect(-16, by - 9, 32, 12)
        ctx.strokeStyle = '#CC1A1A'
        ctx.lineWidth = 1
        ctx.strokeRect(-16, by - 9, 32, 12)
        ctx.fillStyle = '#FF4444'
        ctx.font = `bold 8px ${T.font}`
        ctx.textAlign = 'center'
        ctx.fillText('BOSS', 0, by)
      }

      ctx.restore()
    }
  }

  // ── Per-archetype zombie draw helpers ─────────────────────────────

  private _drawZombieRegular(ctx: CanvasRenderingContext2D, r: number, tier: number, wobble: number): void {
    // Tier-based glow
    const glowColors = ['', '#4a8a20', '#88FF44', '#BBFF66']
    const glowBlurs  = [0, 6, 10, 14]
    if (tier > 0) {
      ctx.shadowColor = glowColors[Math.min(tier, 3)]
      ctx.shadowBlur  = glowBlurs[Math.min(tier, 3)]
    }

    // Body: filled circle
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = '#2a1a0a'
    ctx.fill()
    ctx.strokeStyle = tier >= 2 ? '#88FF44' : '#5C2A1A'
    ctx.lineWidth = tier >= 3 ? 2 : 1.5
    ctx.stroke()
    ctx.shadowBlur = 0

    // Tier 3: outer spike ring
    if (tier >= 3) {
      ctx.strokeStyle = '#BBFF66'
      ctx.lineWidth = 1.2
      ctx.globalAlpha = 0.7
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(Math.cos(a) * (r + 3), Math.sin(a) * (r + 3))
        ctx.lineTo(Math.cos(a) * (r + 9), Math.sin(a) * (r + 9))
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    // Head nub
    ctx.beginPath()
    ctx.arc(0, -r * 0.85, r * 0.34, 0, Math.PI * 2)
    ctx.fillStyle = '#3a2010'
    ctx.fill()

    // Arm stubs
    ctx.strokeStyle = '#4a2a14'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-r * 0.55, -r * 0.1)
    ctx.lineTo(-r * 0.95, r * 0.35)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(r * 0.55, -r * 0.1)
    ctx.lineTo(r * 0.95, r * 0.35)
    ctx.stroke()

    // Eyes (blink every ~1.5s using wobble)
    const blink = Math.sin(wobble * 4.2) > 0.92
    if (!blink) {
      const eyeColor = tier >= 2 ? '#CCFF44' : '#88FF44'
      ctx.fillStyle = eyeColor
      if (tier >= 1) { ctx.shadowColor = eyeColor; ctx.shadowBlur = 5 }
      ctx.beginPath(); ctx.arc(-r * 0.26, -r * 0.85, r * 0.14, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc( r * 0.26, -r * 0.85, r * 0.14, 0, Math.PI * 2); ctx.fill()
      ctx.shadowBlur = 0
    }
  }

  private _drawZombieFast(ctx: CanvasRenderingContext2D, r: number, tier: number, wobble: number, _slow: number): void {
    const glowColors = ['', '#44CC44', '#AAFF44', '#FFFF44']
    const glowBlurs  = [0, 8, 12, 16]
    if (tier > 0) {
      ctx.shadowColor = glowColors[Math.min(tier, 3)]
      ctx.shadowBlur  = glowBlurs[Math.min(tier, 3)]
    }

    // Movement speed trail (3 fading ghost circles behind)
    if (wobble > 0) {
      const trailAlphas = [0.13, 0.07, 0.03]
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = trailAlphas[i]
        ctx.fillStyle = '#4CAF50'
        ctx.beginPath()
        ctx.arc(0, r * (1.2 + i * 1.0), r * (0.85 - i * 0.15), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    // Body: elongated triangle (tall/narrow)
    ctx.beginPath()
    ctx.moveTo(0,      -r * 1.2)
    ctx.lineTo(-r * 0.55,  r * 0.7)
    ctx.lineTo( r * 0.55,  r * 0.7)
    ctx.closePath()
    ctx.fillStyle = '#0a1a08'
    ctx.fill()
    ctx.strokeStyle = tier >= 2 ? '#AAFF44' : '#4CAF50'
    ctx.lineWidth = tier >= 3 ? 2 : 1.5
    ctx.stroke()
    ctx.shadowBlur = 0

    // Speed fins (swept back)
    const finCount = tier >= 2 ? 2 : 1
    ctx.strokeStyle = tier >= 3 ? '#FFFF44' : '#4CAF50'
    ctx.lineWidth = 1.2
    ctx.globalAlpha = 0.65
    for (let f = 0; f < finCount; f++) {
      const offset = (f + 1) * r * 0.25
      ctx.beginPath()
      ctx.moveTo(-r * 0.45, -r * 0.2 + offset)
      ctx.lineTo(-r * 0.85,  r * 0.6 + offset)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo( r * 0.45, -r * 0.2 + offset)
      ctx.lineTo( r * 0.85,  r * 0.6 + offset)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Eye slash
    ctx.strokeStyle = tier >= 2 ? '#FFFF44' : '#CCFF44'
    ctx.lineWidth = 1.8
    ctx.shadowColor = '#88FF44'; ctx.shadowBlur = 5
    ctx.beginPath()
    ctx.moveTo(-r * 0.3, -r * 0.55)
    ctx.lineTo( r * 0.3, -r * 0.7)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  private _drawZombieTank(ctx: CanvasRenderingContext2D, r: number, tier: number, _wobble: number): void {
    const glowColors = ['', '#991010', '#CC3030', '#FF2200']
    const glowBlurs  = [0, 8, 12, 16]
    if (tier > 0) {
      ctx.shadowColor = glowColors[Math.min(tier, 3)]
      ctx.shadowBlur  = glowBlurs[Math.min(tier, 3)]
    }

    // Tier 3: outer corona pulse
    if (tier >= 3) {
      const pulseAlpha = 0.3 + 0.2 * Math.sin(Date.now() / 200)
      ctx.strokeStyle = `rgba(255,34,0,${pulseAlpha})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(0, 0, r + 7, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Shoulder pads
    const padW = tier >= 3 ? r * 0.58 : r * 0.48
    ctx.fillStyle = '#2a0a0a'
    ctx.strokeStyle = tier >= 2 ? '#CC3030' : '#8B1A1A'
    ctx.lineWidth = 1.2
    ctx.fillRect(-r - padW, -r * 0.4, padW, r * 0.6)
    ctx.strokeRect(-r - padW, -r * 0.4, padW, r * 0.6)
    ctx.fillRect( r,         -r * 0.4, padW, r * 0.6)
    ctx.strokeRect(r,         -r * 0.4, padW, r * 0.6)

    // Tier 2+: double armor ring
    if (tier >= 2) {
      ctx.strokeStyle = '#CC3030'
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Body: rounded square
    ctx.beginPath()
    const cr = 4
    ctx.moveTo(-r + cr, -r)
    ctx.lineTo( r - cr, -r)
    ctx.arcTo(  r, -r, r,  -r + cr, cr)
    ctx.lineTo( r,  r - cr)
    ctx.arcTo(  r,  r, r - cr, r, cr)
    ctx.lineTo(-r + cr,  r)
    ctx.arcTo( -r,  r, -r,  r - cr, cr)
    ctx.lineTo(-r, -r + cr)
    ctx.arcTo( -r, -r, -r + cr, -r, cr)
    ctx.closePath()
    ctx.fillStyle = '#1a0808'
    ctx.fill()
    ctx.strokeStyle = tier >= 2 ? '#CC3030' : '#8B1A1A'
    ctx.lineWidth = tier >= 3 ? 2.5 : 2
    ctx.stroke()
    ctx.shadowBlur = 0

    // Spine ridge
    ctx.strokeStyle = '#5a1010'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(0, -r * 0.75)
    ctx.lineTo(0,  r * 0.75)
    ctx.stroke()

    // Tier 1+: bolt dots at corners
    if (tier >= 1) {
      ctx.fillStyle = '#8B1A1A'
      for (const [bx, by] of [[-r*0.6, -r*0.6], [r*0.6, -r*0.6], [-r*0.6, r*0.6], [r*0.6, r*0.6]] as [number,number][]) {
        ctx.beginPath(); ctx.arc(bx, by, 2.5, 0, Math.PI * 2); ctx.fill()
      }
    }

    // Mouth: jagged saw (3 teeth)
    ctx.strokeStyle = '#8B1A1A'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(-r * 0.5, r * 0.6)
    ctx.lineTo(-r * 0.25, r * 0.35)
    ctx.lineTo(0,          r * 0.6)
    ctx.lineTo( r * 0.25,  r * 0.35)
    ctx.lineTo( r * 0.5,   r * 0.6)
    ctx.stroke()
  }

  private _drawZombieArmored(ctx: CanvasRenderingContext2D, r: number, tier: number, _wobble: number): void {
    const glowColors = ['', '#3A5A80', '#5A88CC', '#88EEFF']
    const glowBlurs  = [0, 8, 12, 16]
    if (tier > 0) {
      ctx.shadowColor = glowColors[Math.min(tier, 3)]
      ctx.shadowBlur  = glowBlurs[Math.min(tier, 3)]
    }

    // Tier 3: chrome fill + electric arc trim
    const bodyFill = tier >= 3 ? '#1a2030' : '#0a0a1a'

    // Tier 2+: double-plate outer outline
    if (tier >= 2) {
      ctx.strokeStyle = tier >= 3 ? '#88EEFF' : '#5A6A80'
      ctx.lineWidth = 1.2
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2
        const px = Math.cos(a) * (r + 5), py = Math.sin(a) * (r + 5)
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Pentagon body
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2
      const px = Math.cos(a) * r, py = Math.sin(a) * r
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = bodyFill
    ctx.fill()
    ctx.strokeStyle = tier >= 2 ? '#5A88CC' : '#5A6A80'
    ctx.lineWidth = tier >= 3 ? 2.5 : 2
    ctx.stroke()
    ctx.shadowBlur = 0

    // Plate lines (3 horizontal across body)
    ctx.strokeStyle = tier >= 3 ? '#7788AA' : '#3A4A60'
    ctx.lineWidth = 1.2
    for (let i = -1; i <= 1; i++) {
      const y = i * r * 0.3
      const hw = Math.sqrt(Math.max(0, r * r - y * y)) * 0.85
      ctx.beginPath(); ctx.moveTo(-hw, y); ctx.lineTo(hw, y); ctx.stroke()
    }

    // Visor slit
    const visorAlpha = tier >= 3 ? 0.9 : 0.45
    ctx.fillStyle = `rgba(136,238,255,${visorAlpha})`
    if (tier >= 2) { ctx.shadowColor = '#88EEFF'; ctx.shadowBlur = 6 }
    ctx.fillRect(-r * 0.35, -r * 0.72, r * 0.7, r * 0.18)
    ctx.shadowBlur = 0

    // Tier 2+: shoulder ridge lines
    if (tier >= 2) {
      ctx.strokeStyle = '#5A88CC'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(-r * 0.6, -r * 0.55); ctx.lineTo(-r * 0.95, -r * 0.3)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo( r * 0.6, -r * 0.55); ctx.lineTo( r * 0.95, -r * 0.3)
      ctx.stroke()
    }

    // Tier 3: electric arc decorations
    if (tier >= 3) {
      ctx.strokeStyle = '#88EEFF'
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.6
      ctx.beginPath()
      ctx.moveTo(-r * 0.4, r * 0.2)
      ctx.lineTo(-r * 0.1, r * 0.45)
      ctx.lineTo(-r * 0.3, r * 0.6)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo( r * 0.4, r * 0.2)
      ctx.lineTo( r * 0.1, r * 0.45)
      ctx.lineTo( r * 0.3, r * 0.6)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }

  private _drawZombieBoss(ctx: CanvasRenderingContext2D, r: number): void {
    const t = Date.now() / 1000
    const pulse = Math.sin(t * 6.7)

    // Pulsing aura
    ctx.shadowColor = '#CC1A1A'
    ctx.shadowBlur = 14 + 8 * Math.abs(pulse)

    // Outer fin spikes (6 spikes at hex angles)
    ctx.strokeStyle = '#FF3300'
    ctx.lineWidth = 2
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * (r + 8),  Math.sin(a) * (r + 8))
      ctx.lineTo(Math.cos(a) * (r + 18), Math.sin(a) * (r + 18))
      ctx.stroke()
    }

    // Rotating outer ring (r+6): 8 tick marks
    const rotAngle = t * 0.3
    ctx.strokeStyle = '#8B1A1A'
    ctx.lineWidth = 1.5
    for (let i = 0; i < 8; i++) {
      const a = rotAngle + (i / 8) * Math.PI * 2
      const cx = Math.cos(a), cy = Math.sin(a)
      ctx.beginPath()
      ctx.moveTo(cx * (r + 3), cy * (r + 3))
      ctx.lineTo(cx * (r + 7), cy * (r + 7))
      ctx.stroke()
    }

    // Hexagon body
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6
      const px = Math.cos(a) * r, py = Math.sin(a) * r
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = '#1a0000'
    ctx.fill()
    ctx.strokeStyle = '#CC1A1A'
    ctx.lineWidth = 3.5
    ctx.stroke()

    // Inner nested hexagons (0.7×, 0.45×)
    for (const [scale, alpha, strokeC] of [[0.7, 0.5, '#8B1A1A'], [0.45, 0.7, '#CC1A1A']] as [number,number,string][]) {
      ctx.globalAlpha = alpha
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6
        const px = Math.cos(a) * r * scale, py = Math.sin(a) * r * scale
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.strokeStyle = strokeC
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0

    // Eye cluster: 3 red dots in triangle formation
    ctx.fillStyle = '#FF2200'
    ctx.shadowColor = '#FF2200'
    ctx.shadowBlur = 8
    for (const [ex, ey] of [[0, -r*0.28], [-r*0.2, r*0.12], [r*0.2, r*0.12]] as [number,number][]) {
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.1, 0, Math.PI * 2); ctx.fill()
    }
    ctx.shadowBlur = 0

    // Pulsing outer ring
    const ringAlpha = 0.45 + 0.35 * Math.abs(pulse)
    ctx.strokeStyle = `rgba(204,26,26,${ringAlpha})`
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(0, 0, r + 6, 0, Math.PI * 2)
    ctx.stroke()
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
