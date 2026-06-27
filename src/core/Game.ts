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
import { AudioManager } from './AudioManager'
import { T } from '../ui/theme'
import { DropItem } from '../entities/DropItem'
import { Bullet } from '../entities/Bullet'
import { spawnWave } from '../systems/Spawner'
import { dist, angleTo } from '../utils/math'
import { PLAYER_SKILL_POOL } from '../data/playerSkillPool'
import { loadCanvasIcons, drawCanvasIcon } from '../ui/canvasIcons'
import { GARRISON_PROFILES } from '../data/garrisonData'
import { SKELETON_FACTORIES, drawZombieComposite } from '../rendering/ZombieLimbs'
import { WINDUP_DURATIONS } from '../data/zombieAnimationData'

const WORLD_W = 3000
const WORLD_H = 3000
export const BASE_X = WORLD_W / 2
export const BASE_Y = WORLD_H / 2

const BULLET_STREAK: Record<string, { len: number; w: number; color: string; glow: string }> = {
  pistol:       { len: 14, w: 1.5, color: 'rgba(255,225,140,1.0)',  glow: 'rgba(255,200,100,0.55)' },
  shotgun:      { len: 10, w: 2.0, color: 'rgba(255,185,70,1.0)',   glow: 'rgba(255,160,50,0.55)'  },
  assaultRifle: { len: 20, w: 1.5, color: 'rgba(255,235,150,1.0)',  glow: 'rgba(255,215,120,0.55)' },
  soldierDrone:    { len: 10, w: 1.2, color: 'rgba(136,220,255,1.0)',  glow: 'rgba(68,136,255,0.65)'  },
  smg:             { len: 12, w: 1.2, color: 'rgba(255,215,120,1.0)',  glow: 'rgba(255,190,90,0.50)'  },
  sniperRifle:     { len: 38, w: 1.0, color: 'rgba(255,250,210,1.0)',  glow: 'rgba(255,240,170,0.60)' },
  grenadeLauncher: { len: 8,  w: 3.0, color: 'rgba(60,200,60,1.0)',   glow: 'rgba(80,255,80,0.60)'   },
  marksmanRifle:   { len: 28, w: 1.2, color: 'rgba(240,255,200,1.0)', glow: 'rgba(200,255,150,0.55)' },
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
  private ambientEmberTimer = 0
  readonly audio = new AudioManager()

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
    this.audio.init()
    const savedSfx = localStorage.getItem('sfx_enabled')
    if (savedSfx === '0') this.audio.setEnabled(false)
    this.running = true
    requestAnimationFrame(t => this.loop(t))
  }

  stop(): void {
    this.running = false
  }

  spawnZombieSlash(x: number, y: number, fromAngle: number, archetype: import('../entities/Zombie').ZombieArchetype): void {
    this.effects.spawnZombieSlash(x, y, fromAngle, archetype)
  }

  spawnAcidBlob(x: number, y: number, angle: number, damage: number): void {
    const blob = new Bullet(x, y, angle, 220, damage, 'tower')
    blob.isBurning = true
    blob.burnDps = 5
    blob.hitsBase = true
    blob.radius = 7
    this.bullets.push(blob)
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
      if (this.waveManager.isBossWave) {
        this.shake(6, 0.5)
        this.audio.playBossRoar()
      } else {
        this.audio.playWaveStart()
      }
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
    if (this.base.garrisonTitanEnabled) {
      this.garrisonUnits.push(new GarrisonUnit(BASE_X + 70, BASE_Y - 70, 'titan', GARRISON_PROFILES.titan, this.base.garrisonHpMult, this.base.garrisonDamageMult))
    }
    if (this.garrisonUnits.length > 0) {
      const hasTitan = this.garrisonUnits.some(u => u.type === 'titan')
      const label = hasTitan ? 'Garrison deployed — TITAN included!' : `Garrison deployed (${this.garrisonUnits.length} units)`
      this.hud.showMessage(label, '#4488FF', 2000)
      this.audio.playWaveStart()
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
    this.audio.playTowerPlace()
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
          this.barrierMode ? 'Barrier mode ON - Click to place (iron x3) - B or Esc to cancel' : 'Barrier mode OFF',
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
      if (e.code === 'KeyM') {
        const next = !this.audio.isEnabled
        this.audio.setEnabled(next)
        localStorage.setItem('sfx_enabled', next ? '1' : '0')
        this.hud.showMessage(next ? 'Sound ON' : 'Sound OFF', next ? T.amber : T.iron, 1200)
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

    // Ambient embers near base — spawn periodically for environmental life
    this.ambientEmberTimer -= dt
    if (this.ambientEmberTimer <= 0) {
      this.effects.spawnAmbientEmber(BASE_X, BASE_Y)
      this.ambientEmberTimer = 0.25 + Math.random() * 0.2
    }

    const prevInvincible = this.player.invincibleTimer
    this.player.update(dt, this.input, this.camera, this)
    this.pushOutOfBase(this.player)
    if (this.player.invincibleTimer > prevInvincible) {
      this.effects.triggerDamageFlash()
      this.audio.playPlayerHurt()
    }
    if (this.player.pendingDodge) {
      this.player.pendingDodge = false
      this.hud.showMessage('DODGE!', T.coreBlue, 700)
    }
    this.camera.follow(this.player.x, this.player.y, WORLD_W, WORLD_H)

    for (const b of this.bullets) b.update(dt)
    for (const b of this.bullets) {
      if (b.alive && b.isFireball) this.effects.spawnFireTrail(b.x, b.y, b.angle)
      // Acid blob: hits base directly
      if (b.alive && b.hitsBase && dist(b.x, b.y, BASE_X, BASE_Y) < 50) {
        this.base.takeDamage(b.damage)
        b.alive = false
      }
    }
    // Ricochet: expired bullets with canRicochet spawn a bounce bullet
    const ricochets: Bullet[] = []
    for (const b of this.bullets) {
      if (!b.alive && b.canRicochet && !b.hasRichocheted && b.owner === 'player') {
        const rb = new Bullet(b.x, b.y, Math.random() * Math.PI * 2, Math.sqrt(b.vx * b.vx + b.vy * b.vy) * 0.7, Math.floor(b.damage * 0.6), 'player')
        rb.hasRichocheted = true
        rb.canRicochet = false
        rb.weaponClass = b.weaponClass
        rb.isPenetrating = b.isPenetrating
        ricochets.push(rb)
      }
    }
    this.bullets.push(...ricochets)
    this.bullets = this.bullets.filter(b => b.alive)

        const baseHpBefore = this.base.hp
    for (const z of this.zombies) {
      z.update(dt, this.base, this.towers, this)
      this.pushOutOfBase(z)
    }
    this.applyZombieSeparation()
    // Shake camera when base takes significant damage this frame
    const baseHpDelta = baseHpBefore - this.base.hp
    if (baseHpDelta > 5) this.shake(Math.min(3, baseHpDelta * 0.06), 0.18)
    // Pre-impact rumble for boss wind-up near player
    for (const z of this.zombies) {
      if (z.archetype === 'boss' && z.windupActive) {
        const wp = 1 - (z.windupTimer / (z.windupMax || 0.4))
        if (wp > 0.7) this.shake(wp * 1.8, 0.05)
      }
    }
    // Healer zombie heal VFX: spawn green particles at heal target every 0.3s
    for (const z of this.zombies) {
      if (z.archetype !== "healer" || !z.healTarget || !z.healTarget.alive) continue
      if (z.healVisualTimer >= 0.3) {
        z.healVisualTimer = 0
        this.effects.spawnHealParticles(z.healTarget.x, z.healTarget.y)
      }
    }

    // bullet â†" zombie collision
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
          // Lifesteal + kinetic strike: pass zombie ref for streak tracking
          if (b.owner === 'player') {
            z.aggroHit(4)
            this.player.onBulletHit(dmg, z)
            if (this.player._kineticStunPending) {
              this.player._kineticStunPending = false
              z.stun(0.6)
            }
            // Acid Coating: apply burn DOT on hit
            if (this.player.acidCoatingEnabled) {
              z.burnTimer = Math.max(z.burnTimer, 2)
              z.burnDps = Math.max(z.burnDps, this.player.acidCoatingStacks * 3)
            }
            // Shotgun knockback: push zombie away from bullet travel direction
            if (b.knockback > 0 && z.alive) {
              const bLen = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
              if (bLen > 0) {
                z.x += (b.vx / bLen) * b.knockback
                z.y += (b.vy / bLen) * b.knockback
              }
            }
            // DSR target lock: track consecutive hits on same zombie
            if (b.weaponClass === 'marksmanRifle') {
              this.player.onDsrHit(z)
            }
          }
          // Poison tower bullet
          if (b.isPoisoned) {
            z.poisonStacks = Math.min(z.poisonStacks + 1, 3)
            z.poisonDps = b.poisonDps * z.poisonStacks
            z.poisonTimer = b.poisonDuration
          }
          if (b.isBurning && !b.isPoisoned) {
            z.burnTimer = Math.max(z.burnTimer, b.burnDps > 0 ? 3 : 0)
            z.burnDps = Math.max(z.burnDps, b.burnDps)
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
            // GL self-damage: player hit by own grenade explosion
            if (b.owner === 'player' && b.weaponClass === 'grenadeLauncher'
              && dist(b.x, b.y, this.player.x, this.player.y) < splashR) {
              const selfDmg = Math.ceil(b.damage * 0.15)
              this.player.stats.hp = Math.max(1, this.player.stats.hp - selfDmg)
              this.effects.triggerDamageFlash()
              this.hud.showMessage(`Self-damage! -${selfDmg}`, '#f88')
            }
            this.effects.spawnRadialBurst(b.x, b.y)
            this.audio.playExplosion()
          }
          this.audio.playZombieHit(z.archetype)
          this.effects.spawnHitSpark(z.x, z.y, hitAngle)
          // Damage numbers: show for all player bullets except rapid-fire SMG (too spammy)
          if (b.owner === 'player' && b.weaponClass !== 'smg' && (b.weaponClass !== 'shotgun' || b.isCrit)) {
            this.effects.spawnDamageNumber(z.x, z.y, dmg, b.isCrit)
          }
          if (b.isCrit) this.effects.spawnCritFlash(z.x, z.y)
          // Executioner: check if zombie will die and was below 30% HP
          if (!z.alive && b.owner === 'player' && z.hp + dmg < z.maxHp * 0.30) {
            this.player.triggerExecutioner()
          }
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
      const wasAlive = t.alive
      t.update(dt, this.zombies, this.base, this.bullets, this.effects)
      if (wasAlive && !t.alive) {
        // Tower destroyed: debris burst + shake
        this.effects.spawnShockwaveDebris(t.x, t.y, '#8B3A2A')
        this.shake(2, 0.2)
        this.hud.showMessage('Tower destroyed!', T.blood, 2000)
        this.audio.playExplosion(0.5)
      }
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
          const wasAlive = u.alive
          u.takeDamage(z.damage * dt, this.base)
          if (wasAlive && !u.alive) {
            this.effects.spawnShockwaveDebris(u.x, u.y, u.profile.glowColor)
          }
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
        u.warlordMult = 1.5
        this.effects.spawnShockwaveDebris(u.x, u.y, T.gold)
      })
      this.hud.showMessage("Warlord's Command! Garrison +50% damage!", T.gold)
      this.shake(1.5, 0.3)
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
        this.audio.playFirebolt()
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
        this.audio.playArcDischarge()
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
        this.audio.playMortarBarrage()
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

    // Counter Strike: fire retaliatory shot at attacker
    if (this.base.pendingCounterStrike) {
      const attacker = this.base.pendingCounterStrike as { x: number; y: number; alive?: boolean }
      this.base.pendingCounterStrike = null
      if (!('alive' in attacker) || attacker.alive) {
        const angle = angleTo(BASE_X, BASE_Y, attacker.x, attacker.y)
        const cb = new Bullet(BASE_X, BASE_Y, angle, 600, 30, 'tower')
        cb.isPenetrating = false
        this.bullets.push(cb)
        this.effects.spawnLightningChain([{ x: BASE_X, y: BASE_Y }, { x: attacker.x, y: attacker.y }])
      }
    }

    // Stun Pulse VFX: shockwave + lightning burst when pulse fires
    if (this.base.pendingStunPulse) {
      this.base.pendingStunPulse = false
      this.effects.spawnFrostPulse(BASE_X, BASE_Y, this.base.auraRadius * 0.8)
      this.shake(0.8, 0.15)
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
      this.audio.playWaveClear()
      if (this.waveManager.isBossWave) {
        this.resources.add({ crystal: 1 })
        this.territory.expand()
        this.hud.showMessage(`Boss defeated! +1 Crystal -- Territory expanded to ${this.territory.radius}px`, T.gold, 3500)
        this.effects.triggerExplosionFlash()
        this.effects.spawnTerritoryExpand(BASE_X, BASE_Y, this.territory.radius)
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
    const rawDrops = z.getDrops()
    const dropMult = 1 + this.player.stats.dropBonus + this.base.resourceDropBonus
    rawDrops.iron = Math.round(rawDrops.iron * dropMult)
    rawDrops.coins = Math.round(rawDrops.coins * dropMult)
    rawDrops.energyCore = Math.round(rawDrops.energyCore * dropMult)
    this.drops.push(new DropItem(z.x, z.y, rawDrops))
    this.effects.spawnBloodSplatter(z.x, z.y, killAngle, z.archetype)
    this.effects.spawnBloodPool(z.x, z.y, z.archetype)
    this.audio.playZombieDead(z.archetype)
    this.player.addXp(z.xpReward, () => {
      this.hud.triggerLevelUp()
      this.audio.playLevelUp()
      this.effects.spawnLevelUpBurst(this.player.x, this.player.y)
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
    // Attract range is 3x pickup range -- items glide toward player when within it
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
        this.audio.playPickup()
        const parts: string[] = []
        if (d.iron > 0)   parts.push(`+${d.iron} iron`)
        if (d.coins > 0)  parts.push(`+${d.coins} coins`)
        if (parts.length) this.hud.showMessage(parts.join('  '), '#ccc', 800)
      }
    }
  }

  // â"€â"€ Render â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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

  // â"€â"€ World â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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

    // Territory â€" hexagon (flat-top, aligned with base hull)
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

    // â"€â"€ 0. Aura field â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

    // â"€â"€ 1. Defense perimeter ring â€" slow counter-rotation â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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
      // 4 of 12 are "lit" â€" brighter node dots
      if (i % 3 === 0) {
        ctx.fillStyle = `rgba(${accentRgb},0.55)`
        ctx.beginPath()
        ctx.arc(ox * defR, oy * defR, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // â"€â"€ 2. Outer hull â€" hexagon (r=50), aligned with territory â"€â"€â"€â"€â"€â"€
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

    // â"€â"€ 3. Energy conduit spokes â€" 6 lines from core to hull â"€â"€â"€â"€â"€â"€â"€â"€
    ctx.strokeStyle = `rgba(${accentRgb},${0.18 + 0.08 * pulse})`
    ctx.lineWidth = 1
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 22, Math.sin(a) * 22)
      ctx.lineTo(Math.cos(a) * 43, Math.sin(a) * 43)
      ctx.stroke()
    }

    // â"€â"€ 4. Core chamber â€" hexagon (r=22) with radial gradient â"€â"€â"€â"€â"€â"€â"€
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

    // â"€â"€ 7. Reactor core â€" small circle with strong glow â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

    // â"€â"€ 8. Shield dome (if active) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

    // â"€â"€ 9. HP bar â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    // Divine Shield invulnerability pulse
    if (b.isInvulnerable) {
      const flicker = 0.7 + 0.3 * Math.abs(Math.sin(Date.now() / 60))
      ctx.strokeStyle = `rgba(255,255,240,${0.85 * flicker})`
      ctx.lineWidth = 3.5
      ctx.shadowColor = '#FFFFC0'
      ctx.shadowBlur = 28
      ctx.beginPath()
      ctx.arc(0, 0, 68, 0, Math.PI * 2)
      ctx.stroke()
      ctx.shadowBlur = 0
      const divGrad = ctx.createRadialGradient(0, 0, 30, 0, 0, 68)
      divGrad.addColorStop(0, 'rgba(255,255,200,0)')
      divGrad.addColorStop(0.6, 'rgba(255,255,200,0)')
      divGrad.addColorStop(1, `rgba(255,255,200,${0.18 * flicker})`)
      ctx.fillStyle = divGrad
      ctx.beginPath()
      ctx.arc(0, 0, 68, 0, Math.PI * 2)
      ctx.fill()
    }

    const barW = 84, barH = 6, barX = -barW / 2, barY = -76
    ctx.fillStyle = 'rgba(10,8,4,0.8)'
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2)
    ctx.fillStyle = `rgba(${accentRgb},0.15)`
    ctx.fillRect(barX, barY, barW, barH)
    ctx.fillStyle = baseColor
    ctx.shadowColor = baseColor; ctx.shadowBlur = 4
    ctx.fillRect(barX, barY, barW * pct, barH)
    ctx.shadowBlur = 0

    // â"€â"€ 10. HP label â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    ctx.fillStyle = `rgba(${accentRgb},0.55)`
    ctx.font = `8px ${T.font}`
    ctx.textAlign = 'center'
    ctx.fillText(`${Math.ceil(b.hp)} / ${b.maxHp}`, 0, barY - 4)

    ctx.restore()
  }

  // â"€â"€ Tower aura glow â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  // â"€â"€ Towers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  private renderTowers(ctx: CanvasRenderingContext2D): void {
    const styleMap: Record<string, { fill: string; stroke: string }> = {
      barricade:      { fill: '#2a1a0a', stroke: '#8B3A2A' },
      fireTower:      { fill: '#1a0800', stroke: '#FF6820' },
      electricTower:  { fill: '#0a0e1a', stroke: '#88eeff' },
      repairTower:    { fill: '#0a1810', stroke: '#4CAF50' },
      machineGunTower:{ fill: '#1a100a', stroke: '#E8A030' },
      freezeTower:    { fill: '#080e1a', stroke: '#88EEFF' },
      poisonTower:    { fill: '#0a140a', stroke: '#88CC44' },
    }
    const rangeRingColor: Record<string, string> = {
      barricade:      'rgba(139,58,42,0.12)',
      fireTower:      'rgba(255,104,32,0.12)',
      electricTower:  'rgba(136,238,255,0.12)',
      repairTower:    'rgba(76,175,80,0.12)',
      machineGunTower:'rgba(232,160,48,0.12)',
      freezeTower:    'rgba(136,238,255,0.10)',
      poisonTower:    'rgba(136,204,68,0.10)',
    }

    const TOWER_SVG_ICON: Record<string, string> = {
      barricade:       'shield',
      fireTower:       'flame',
      electricTower:   'zap',
      repairTower:     'wrench',
      machineGunTower: 'crosshair',
      freezeTower:     'zap',
      poisonTower:     'flame',
    }

    const drawIcon = (ctx: CanvasRenderingContext2D, type: string, stroke: string) => {
      const iconName = TOWER_SVG_ICON[type]
      if (iconName) {
        // Use pre-rendered SVG image â€" drawn at 18Ă—18 centered on tower
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

      // Spawn scale animation: 1.4 â†' 1.0 over 150ms, cubic ease-out
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

      // Freeze tower body glow flare when pulse fires (fades with ring)
      if (t.profile.type === 'freezeTower' && t.pulseRingTimer > 0 && t.pulseRingMax > 0) {
        const freshness = t.pulseRingTimer / t.pulseRingMax   // 1 = just fired, 0 = done
        ctx.shadowColor = '#88EEFF'
        ctx.shadowBlur = 10 + 22 * freshness
      }

      if (t.profile.type === 'fireTower') {
        this.drawFireTowerBody(ctx, s.stroke, t === this.inspectedTower, t.level)
      } else if (t.profile.type === 'electricTower') {
        this.drawElectricTowerBody(ctx, s.stroke, t === this.inspectedTower, t.level)
      } else if (t.profile.type === 'machineGunTower') {
        this.drawMachineGunTowerBody(ctx, s.stroke, t === this.inspectedTower, t.level, t.muzzleFlashAngle)
      } else if (t.profile.type === 'freezeTower') {
        this.drawFreezeTowerBody(ctx, s.stroke, t === this.inspectedTower, t.level)
      } else if (t.profile.type === 'poisonTower') {
        this.drawPoisonTowerBody(ctx, s.stroke, t === this.inspectedTower, t.level)
      } else if (t.profile.type === 'repairTower') {
        this.drawRepairTowerBody(ctx, s.stroke, t === this.inspectedTower, t.level)
      } else {
        ctx.fillStyle = s.fill
        ctx.strokeStyle = s.stroke
        ctx.lineWidth = t === this.inspectedTower ? 3 : 2
        ctx.beginPath()
        ctx.rect(-14, -14, 28, 28)
        ctx.fill()
        ctx.stroke()
      }

      ctx.shadowBlur = 0

      // HP bar
      ctx.fillStyle = 'rgba(44,36,22,0.7)'
      ctx.fillRect(-14, -22, 28, 4)
      ctx.fillStyle = T.hpColor(hpPct)
      ctx.fillRect(-14, -22, 28 * hpPct, 4)

      // Type icon (skip towers with custom body renderers)
      const hasCustomBody = t.profile.type === 'fireTower' || t.profile.type === 'electricTower'
        || t.profile.type === 'machineGunTower' || t.profile.type === 'freezeTower'
        || t.profile.type === 'poisonTower' || t.profile.type === 'repairTower'
      if (!hasCustomBody) {
        drawIcon(ctx, t.profile.type, s.stroke)
      }

      if (t.level > 1) {
        ctx.fillStyle = T.amber
        ctx.font = `bold 9px ${T.font}`
        ctx.textAlign = 'center'
        ctx.fillText(`L${t.level}`, 0, 12)
      }

      ctx.restore()

      // Cryo pulse ring expanding from freeze tower
      if (t.profile.type === 'freezeTower' && t.pulseRingTimer > 0 && t.pulseRingMax > 0) {
        const progress = 1 - t.pulseRingTimer / t.pulseRingMax
        const ringRadius = t.profile.range * (0.2 + progress * 0.9)
        const alpha = (1 - progress) * 0.7
        ctx.save()
        ctx.beginPath()
        ctx.arc(t.x, t.y, ringRadius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(136,238,255,${alpha})`
        ctx.lineWidth = 2.5
        ctx.shadowColor = '#88EEFF'
        ctx.shadowBlur = 8
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.restore()
      }

      // Muzzle flash: bright spike along fire angle when tower just fired
      if (t.muzzleFlashTimer > 0) {
        const flashAlpha = t.muzzleFlashTimer / 0.12
        const flashColor = s.stroke
        const nozzleX = t.x + Math.cos(t.muzzleFlashAngle) * 18
        const nozzleY = t.y + Math.sin(t.muzzleFlashAngle) * 18
        ctx.save()
        ctx.globalAlpha = flashAlpha * 0.9
        ctx.shadowColor = flashColor
        ctx.shadowBlur = 14
        ctx.strokeStyle = flashColor
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(nozzleX, nozzleY)
        ctx.lineTo(nozzleX + Math.cos(t.muzzleFlashAngle) * 12, nozzleY + Math.sin(t.muzzleFlashAngle) * 12)
        ctx.stroke()
        // Cross flare
        const perpA = t.muzzleFlashAngle + Math.PI / 2
        ctx.lineWidth = 1.5
        ctx.globalAlpha = flashAlpha * 0.5
        ctx.beginPath()
        ctx.moveTo(nozzleX + Math.cos(perpA) * 6, nozzleY + Math.sin(perpA) * 6)
        ctx.lineTo(nozzleX - Math.cos(perpA) * 6, nozzleY - Math.sin(perpA) * 6)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.restore()
      }
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
      const isWarlord = u.warlordMult > 1
      ctx.shadowColor = isWarlord ? T.gold : glow
      ctx.shadowBlur = isFlashing ? 28 : (isWarlord ? 18 : 10)
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

      // Warlord gold orbit ring
      if (isWarlord) {
        const pulse = 0.55 + 0.35 * Math.sin(Date.now() / 200 + u.x)
        ctx.strokeStyle = T.gold
        ctx.lineWidth = 1.5
        ctx.globalAlpha = pulse
        ctx.shadowColor = T.gold
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.arc(0, 0, r + 6, 0, Math.PI * 2)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }

      // Heavy slow field aura ring when frost stomp skill active
      if (u.type === 'heavy' && this.base.heavySlowFieldEnabled) {
        const frozenPulse = 0.08 + 0.05 * Math.sin(Date.now() / 400)
        ctx.strokeStyle = '#88CCFF'
        ctx.lineWidth = 1
        ctx.shadowColor = '#44AAFF'
        ctx.shadowBlur = 8
        ctx.globalAlpha = frozenPulse * 2
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.arc(0, 0, 120, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }

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
    // Main body â€" sleek triangle (pointed up)
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
    // Sum damage of all alive soldiers and divide by burst (3 shots Ă— 2 bullets = 6 bullet events per cooldown)
    const totalSoldierDmg = this.garrisonUnits
      .filter(u => u.type === 'soldier' && u.alive)
      .reduce((sum, u) => sum + u.damage * u.warlordMult, 0) || 15
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
    const solidR = 36  // inner core radius; outer ring is visual only, not a physical wall
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

  // â"€â"€ Zombies â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  private renderZombies(ctx: CanvasRenderingContext2D): void {
    for (const z of this.zombies) {
      if (!z.alive) continue
      ctx.save()
      ctx.translate(z.x, z.y)

      // Composite body (rotated to movement direction)
      ctx.rotate(z.angle + Math.PI / 2)

      const bossVTier = this.waveManager.waveIndex >= 11 ? 2 : this.waveManager.waveIndex >= 6 ? 1 : 0
      const renderTier = z.archetype === 'boss' ? bossVTier : z.tier
      const skeleton = SKELETON_FACTORIES[z.archetype](z.radius, renderTier)

      const windupPct = z.windupActive
        ? Math.max(0, 1 - z.windupTimer / (WINDUP_DURATIONS[z.archetype] || 0.2))
        : 0

      drawZombieComposite(ctx, skeleton, {
        radius: z.radius,
        animFrame: z.currentFrame,
        hitRecoilTimer: z.hitRecoilTimer,
        windupActive: z.windupActive,
        windupPct,
        glowColor: '',
        glowBlur: 0,
        wobble: z.wobbleTimer,
      })

      ctx.rotate(-(z.angle + Math.PI / 2))

      // Stun stars â€" 3 small white circles orbiting the zombie
      if (z.stunTimer > 0) {
        const starAlpha = z.stunTimer < 0.3 ? z.stunTimer / 0.3 : 1.0
        const rotOff = Date.now() / 400
        ctx.globalAlpha = starAlpha
        ctx.fillStyle = '#FFFFFF'
        ctx.shadowColor = '#AAAAFF'
        ctx.shadowBlur = 5
        for (let i = 0; i < 3; i++) {
          const a = rotOff + (i / 3) * Math.PI * 2
          const sx = Math.cos(a) * (z.radius + 10)
          const sy = Math.sin(a) * (z.radius + 10)
          ctx.beginPath()
          ctx.arc(sx, sy, 2.5, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }

      ctx.shadowBlur = 0

      // Boss wind-up telegraph: expanding danger ring when winding up to strike
      if (z.windupActive && windupPct > 0.1) {
        const isBoss = z.archetype === 'boss'
        const ringR = z.radius * (1 + windupPct * (isBoss ? 1.4 : 0.7))
        const alpha = windupPct * 0.75
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.strokeStyle = T.blood
        ctx.lineWidth = isBoss ? (3 + windupPct * 2) : (2.5 - windupPct)
        ctx.shadowColor = T.blood
        ctx.shadowBlur = isBoss ? 22 : 10
        ctx.beginPath()
        ctx.arc(0, 0, ringR, 0, Math.PI * 2)
        ctx.stroke()
        if (isBoss && windupPct > 0.6) {
          // Second outer ring for boss
          ctx.globalAlpha = alpha * 0.4
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(0, 0, ringR * 1.3, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.shadowBlur = 0
        ctx.restore()
      }

      // Death Mark indicator — red pulsing cross hairs on zombies below 20% HP when skill is active
      if (this.player.deathMarkEnabled && z.hp / z.maxHp < 0.2) {
        const dm = Date.now()
        const pulse = 0.5 + 0.5 * Math.abs(Math.sin(dm / 150))
        ctx.save()
        ctx.globalAlpha = 0.7 * pulse
        ctx.strokeStyle = T.blood
        ctx.lineWidth = 1.5
        ctx.shadowColor = T.blood
        ctx.shadowBlur = 10
        const cr = z.radius + 4
        // Cross hairs: 4 ticks at cardinal angles
        for (let t2 = 0; t2 < 4; t2++) {
          const a = (t2 / 4) * Math.PI * 2
          ctx.beginPath()
          ctx.moveTo(Math.cos(a) * (cr - 3), Math.sin(a) * (cr - 3))
          ctx.lineTo(Math.cos(a) * (cr + 3), Math.sin(a) * (cr + 3))
          ctx.stroke()
        }
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
        ctx.restore()
      }

      // DSR target lock reticle — shows lock progress on current combo target
      const p2 = this.player
      if (p2.ownedWeapons.length > 0 && p2.currentWeapon.id === 'rifle_dsr' && p2.dsrComboTarget === z && p2.dsrComboCount > 0) {
        const lockPct = p2.dsrComboBonus ? 1 : p2.dsrComboCount / 3
        const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 90)
        ctx.save()
        ctx.globalAlpha = pulse
        ctx.strokeStyle = p2.dsrComboBonus ? T.gold : T.amber
        ctx.lineWidth = p2.dsrComboBonus ? 2.5 : 1.5
        ctx.shadowColor = p2.dsrComboBonus ? T.gold : T.amber
        ctx.shadowBlur = p2.dsrComboBonus ? 16 : 8
        // Arc showing lock progress (full circle when ready)
        ctx.beginPath()
        ctx.arc(0, 0, z.radius + 5, -Math.PI / 2, -Math.PI / 2 + lockPct * Math.PI * 2)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
        ctx.restore()
      }

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

      // Poison drip dots — green circles at base of zombie when poisoned
      if (z.poisonStacks > 0) {
        const dotY = z.radius + 4
        ctx.globalAlpha = 0.85
        ctx.shadowColor = '#88CC44'
        ctx.shadowBlur = 5
        ctx.fillStyle = '#44AA22'
        for (let i = 0; i < z.poisonStacks; i++) {
          const dx = (i - (z.poisonStacks - 1) / 2) * 6
          ctx.beginPath()
          ctx.arc(dx, dotY, 2.5, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }

      // Burn visual — orange glow ring + flame wisps when zombie is burning
      if (z.burnTimer > 0) {
        const burnFraction = Math.min(z.burnTimer / 3, 1)
        const flicker = 0.75 + 0.25 * Math.sin(Date.now() / 60 + z.x)
        ctx.globalAlpha = 0.55 * burnFraction * flicker
        ctx.strokeStyle = '#FF6820'
        ctx.lineWidth = 2.5
        ctx.shadowColor = '#FF4400'
        ctx.shadowBlur = 14
        ctx.beginPath()
        ctx.arc(0, 0, z.radius + 3, 0, Math.PI * 2)
        ctx.stroke()
        ctx.shadowBlur = 0
        // small flame wisps above zombie
        const now = Date.now()
        ctx.fillStyle = '#FF8820'
        ctx.shadowColor = '#FF6600'
        ctx.shadowBlur = 6
        for (let i = 0; i < 3; i++) {
          const wave = Math.sin(now / 80 + i * 2.1) * 4
          const wispX = (i - 1) * 6 + wave
          const wispY = -z.radius - 6 - Math.abs(Math.sin(now / 100 + i)) * 5
          const wispR = 2.5 + Math.abs(Math.sin(now / 90 + i * 1.7)) * 1.5
          ctx.globalAlpha = 0.7 * burnFraction * flicker
          ctx.beginPath()
          ctx.arc(wispX, wispY, wispR, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
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

  // â"€â"€ Player â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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
      case 'pistol':          this.drawWeaponPistol(ctx); break
      case 'shotgun':         this.drawWeaponShotgun(ctx); break
      case 'assaultRifle':    this.drawWeaponAR(ctx); break
      case 'smg':             this.drawWeaponSMG(ctx); break
      case 'sniperRifle':     this.drawWeaponSniper(ctx); break
      case 'grenadeLauncher': this.drawWeaponGL(ctx); break
      case 'marksmanRifle':   this.drawWeaponDMR(ctx); break
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

    // Berserker stack pips — small red dots above player
    if (p.berserkerEnabled && p.berserkerStacks > 0) {
      ctx.save()
      ctx.translate(p.x, p.y)
      const stacks = p.berserkerStacks
      const pipW = 5, gap = 3, totalW = stacks * (pipW + gap) - gap
      for (let i = 0; i < stacks; i++) {
        const px = -totalW / 2 + i * (pipW + gap) + pipW / 2
        ctx.beginPath()
        ctx.arc(px, -22, pipW / 2, 0, Math.PI * 2)
        ctx.fillStyle = T.blood
        ctx.shadowColor = T.blood
        ctx.shadowBlur = 4
        ctx.fill()
        ctx.shadowBlur = 0
      }
      ctx.restore()
    }

    // Sniper hold-breath charge — arc growing to full circle as charge builds
    if (p.ownedWeapons.length > 0 && p.currentWeapon.class === 'sniperRifle' && p.holdBreathTimer > 0) {
      const chargePct = p.holdBreathTimer / 0.4
      const isReady = p.holdBreathReady
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.strokeStyle = isReady ? T.crystalCyan : `rgba(136,238,255,${0.5 + 0.4 * chargePct})`
      ctx.lineWidth = isReady ? 2.5 : 1.5
      ctx.shadowColor = T.crystalCyan
      ctx.shadowBlur = isReady ? 14 : 6
      ctx.beginPath()
      ctx.arc(0, 0, 16, -Math.PI / 2, -Math.PI / 2 + chargePct * Math.PI * 2)
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.restore()
    }

    // AR Focus precision active — tight green ring when standing still 0.3s+
    if (p.ownedWeapons.length > 0 && p.currentWeapon.id === 'ar_m4' && p.arStillTimer >= 0.3) {
      const focusPulse = 0.55 + 0.35 * Math.abs(Math.sin(Date.now() / 200))
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.strokeStyle = T.hpHigh
      ctx.lineWidth = 1.5
      ctx.shadowColor = T.hpHigh
      ctx.shadowBlur = 10
      ctx.globalAlpha = focusPulse
      ctx.beginPath()
      ctx.arc(0, 0, 14, 0, Math.PI * 2)
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
      ctx.restore()
    }

    // Last Stand active — red danger ring when HP < 25%
    if (p.lastStandEnabled && p.stats.hp / p.stats.maxHp < 0.25) {
      const now2 = Date.now()
      const danger = 0.6 + 0.4 * Math.abs(Math.sin(now2 / 180))
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.beginPath()
      ctx.arc(0, 0, 18, 0, Math.PI * 2)
      ctx.strokeStyle = T.blood
      ctx.lineWidth = 2
      ctx.shadowColor = T.blood
      ctx.shadowBlur = 20
      ctx.globalAlpha = danger
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
      ctx.restore()
    }

    // Executioner ready aura — gold pulsing ring
    if (p.executionerEnabled && p.executionerReady) {
      const pulseR = 20 + 3 * Math.sin(Date.now() / 120)
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.beginPath()
      ctx.arc(0, 0, pulseR, 0, Math.PI * 2)
      ctx.strokeStyle = T.gold
      ctx.lineWidth = 2.5
      ctx.shadowColor = T.gold
      ctx.shadowBlur = 14
      ctx.globalAlpha = 0.85
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
      ctx.restore()
    }

    // Overcharge ready aura — white/cyan spinning dashes
    if (p.overchargeEnabled && p.overchargeReady) {
      const now = Date.now()
      const spin = (now / 600) % (Math.PI * 2)
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(spin)
      ctx.strokeStyle = '#CCFFFF'
      ctx.lineWidth = 2
      ctx.shadowColor = '#AAEEFF'
      ctx.shadowBlur = 12
      ctx.globalAlpha = 0.75 + 0.2 * Math.sin(now / 100)
      ctx.setLineDash([6, 6])
      ctx.beginPath()
      ctx.arc(0, 0, 22, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
      ctx.restore()
    }
  }

  // â"€â"€ Bullets / Drops / Particles â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  private renderBullets(ctx: CanvasRenderingContext2D): void {
    for (const b of this.bullets) {
      if (b.isFireball) {
        ctx.save()
        const t = Date.now()
        const wobble = Math.sin(t / 80) * 0.18
        const backAngle = b.angle + Math.PI

        // Fiery tail â€" elongated teardrops behind the ball
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
            // Acid blob (spitter projectile): glowing green orb with drip trail
      if (b.hitsBase && b.isBurning) {
        const t2 = Date.now()
        const w2 = Math.sin(t2 / 70) * 0.2
        ctx.save()
        for (let ti = 1; ti <= 3; ti++) {
          const backA = b.angle + Math.PI
          const tx = b.x + Math.cos(backA) * ti * (b.radius * 1.1)
          const ty = b.y + Math.sin(backA) * ti * (b.radius * 1.1)
          const tr = b.radius * (1 - ti * 0.28)
          if (tr <= 0) break
          ctx.globalAlpha = (1 - ti * 0.3) * 0.75
          ctx.shadowColor = '#44FF44'
          ctx.shadowBlur = 6
          ctx.fillStyle = '#336600'
          ctx.beginPath()
          ctx.ellipse(tx, ty, tr * 0.7, tr, 0, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
        ctx.shadowColor = '#88FF44'
        ctx.shadowBlur = 16
        ctx.fillStyle = '#336600'
        ctx.save()
        ctx.translate(b.x, b.y)
        ctx.rotate(w2)
        ctx.beginPath()
        ctx.ellipse(0, 0, b.radius * 1.15, b.radius, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        ctx.shadowColor = '#CCFF44'
        ctx.shadowBlur = 8
        ctx.fillStyle = '#66CC00'
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.radius * 0.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.restore()
        continue
      }
// Light streak â€" two-pass (glow + core)
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
    const now = Date.now()
    for (const d of this.drops) {
      if (d.picked) continue
      const expiring = d.lifetime < 5
      // Flicker when about to expire (last 5s)
      if (expiring && Math.sin(now / 80) < 0) continue
      const bob = Math.sin(now / 350 + d.x * 0.05) * 2.5
      const globalAlpha = expiring ? Math.max(0.3, d.lifetime / 5) : 1
      ctx.save()
      ctx.globalAlpha = globalAlpha
      ctx.translate(d.x, d.y + bob)
      const color = d.crystal
        ? T.crystalCyan
        : d.energyCore > 0 ? T.coreBlue
        : d.ammo > 0       ? T.amber
        : d.iron > 0       ? T.ironGrey
        : T.gold
      ctx.shadowColor = color
      ctx.shadowBlur = 5 + 3 * Math.sin(now / 300)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(0, 0, 6, 0, Math.PI * 2)
      ctx.fill()
      // inner bright core
      ctx.globalAlpha = globalAlpha * (0.6 + 0.3 * Math.sin(now / 200 + d.x))
      ctx.fillStyle = '#ffffff'
      ctx.shadowBlur = 0
      ctx.beginPath()
      ctx.arc(0, -1.5, 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
      ctx.restore()
    }
  }

  // â"€â"€ Build preview ghost when buildMode or barrierMode active â"€â"€â"€â"€â"€â"€â"€

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
      ctx.fillText('x3', 0, 28)
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

  // â"€â"€ Build hint bar (shown mid-game) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  private renderBuildHint(ctx: CanvasRenderingContext2D): void {
    if (this.phase !== 'playing') return
    const active = this.buildMode || this.barrierMode
    const text = this.barrierMode
      ? 'Barrier mode -- Click to place (x3 iron) - B or Esc to cancel'
      : this.buildMode
        ? `Placing ${this.pendingTowerType ?? '?'} -- Left Click to place - Esc to cancel`
        : 'Right Click -> Build Tower   |   B -> Barricade'
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

  // â"€â"€ Minimap â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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

    // Territory hexagon (matches world view shape)
    const tcx = mx + BASE_X * sx, tcy = my + BASE_Y * sy, tr2 = this.territory.radius * sx
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6
      const hx = tcx + Math.cos(a) * tr2, hy = tcy + Math.sin(a) * tr2
      if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy)
    }
    ctx.closePath()
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

  // â"€â"€ Weapon shape renderers (ctx already translated+rotated to player) â"€â"€

  private drawFireTowerBody(ctx: CanvasRenderingContext2D, stroke: string, inspected: boolean, level: number): void {
    const lw = inspected ? 3 : 2
    const pulse = Math.sin(Date.now() / 300) * 0.5 + 0.5

    // Base platform: octagonal pad
    ctx.beginPath()
    const padR = 12
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 8
      const x = Math.cos(a) * padR
      const y = Math.sin(a) * padR
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = '#1a0800'
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.fill()
    ctx.stroke()

    // Side struts
    ctx.strokeStyle = '#3a1800'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(-3, -8); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(8, 4);  ctx.lineTo(3,  -8); ctx.stroke()

    // Barrel nozzle pointing up
    ctx.fillStyle = '#2a1000'
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.rect(-3.5, -14, 7, 12)
    ctx.fill()
    ctx.stroke()

    // Glowing ember tip at barrel mouth
    const emberR = level >= 2 ? 4.5 : 3.5
    ctx.save()
    ctx.globalAlpha = 0.7 + pulse * 0.3
    ctx.shadowColor = '#FF6820'
    ctx.shadowBlur = 8 + pulse * 6
    ctx.beginPath()
    ctx.arc(0, -16, emberR, 0, Math.PI * 2)
    ctx.fillStyle = level >= 3 ? '#FFEE44' : '#FF8820'
    ctx.fill()
    ctx.restore()

    // Level 2+: flame ring around ember
    if (level >= 2) {
      ctx.save()
      ctx.globalAlpha = 0.45 + pulse * 0.25
      ctx.beginPath()
      ctx.arc(0, -16, 7, 0, Math.PI * 2)
      ctx.strokeStyle = '#FF6820'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()
    }

    ctx.shadowBlur = 0
  }

  private drawElectricTowerBody(ctx: CanvasRenderingContext2D, stroke: string, inspected: boolean, level: number): void {
    const lw = inspected ? 3 : 2
    const t = Date.now() / 200
    const pulse = Math.sin(t) * 0.5 + 0.5

    // Narrow column body
    ctx.fillStyle = '#0a0e1a'
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.rect(-4, -10, 8, 20)
    ctx.fill()
    ctx.stroke()

    // Wide base foot
    ctx.beginPath()
    ctx.rect(-10, 8, 20, 5)
    ctx.fill()
    ctx.stroke()

    // Side discharge prongs (horizontal arms)
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-12, -6); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(4,  -6); ctx.lineTo(12,  -6); ctx.stroke()
    // Prong tips (small circles)
    ctx.fillStyle = stroke
    ctx.beginPath(); ctx.arc(-12, -6, 2, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(12,  -6, 2, 0, Math.PI * 2); ctx.fill()

    // Tesla ball on top
    const ballR = level >= 2 ? 6 : 5
    ctx.save()
    ctx.shadowColor = stroke
    ctx.shadowBlur = 10 + pulse * 8
    ctx.beginPath()
    ctx.arc(0, -14, ballR, 0, Math.PI * 2)
    ctx.fillStyle = level >= 3 ? '#CCFFFF' : '#0a0e1a'
    ctx.strokeStyle = stroke
    ctx.lineWidth = 2
    ctx.fill()
    ctx.stroke()
    ctx.restore()

    // Electric arc sparks (level 2+): 3 short jagged lines from ball
    if (level >= 2) {
      ctx.save()
      ctx.globalAlpha = 0.5 + pulse * 0.4
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 0.8
      ctx.shadowColor = stroke
      ctx.shadowBlur = 4
      const arcAngles = [-0.8, 0, 0.8]
      for (const ang of arcAngles) {
        const sx = Math.cos(ang - Math.PI / 2) * ballR
        const sy = -14 + Math.sin(ang - Math.PI / 2) * ballR
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(sx + Math.cos(ang) * 5, sy + Math.sin(ang) * 5)
        ctx.stroke()
      }
      ctx.restore()
    }

    ctx.shadowBlur = 0
  }

  private drawMachineGunTowerBody(ctx: CanvasRenderingContext2D, stroke: string, inspected: boolean, level: number, barrelAngle = 0): void {
    const lw = inspected ? 3 : 2

    // Hexagonal turret body
    ctx.beginPath()
    const bodyR = 11
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6
      const x = Math.cos(a) * bodyR
      const y = Math.sin(a) * bodyR
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fillStyle = '#1a100a'
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.fill()
    ctx.stroke()

    // Ammo drum: circle on left side
    const drumR = level >= 2 ? 5 : 4
    ctx.beginPath()
    ctx.arc(-9, 2, drumR, 0, Math.PI * 2)
    ctx.fillStyle = '#2a1800'
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.2
    ctx.fill()
    ctx.stroke()
    // Drum detail cross
    ctx.strokeStyle = stroke
    ctx.lineWidth = 0.8
    ctx.globalAlpha = 0.5
    ctx.beginPath(); ctx.moveTo(-9, 2 - drumR + 1); ctx.lineTo(-9, 2 + drumR - 1); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-9 - drumR + 1, 2); ctx.lineTo(-9 + drumR - 1, 2); ctx.stroke()
    ctx.globalAlpha = 1

    // Barrel: rotates toward last target
    const barrelLen = level >= 3 ? 14 : 12
    ctx.save()
    ctx.rotate(barrelAngle)
    ctx.fillStyle = '#3a2000'
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.rect(6, -3, barrelLen, 6)
    ctx.fill()
    ctx.stroke()

    // Muzzle flash ring at barrel tip
    const mx = 6 + barrelLen
    const flashAlpha = 0.35 + Math.sin(Date.now() / 80) * 0.25
    ctx.globalAlpha = Math.max(0, flashAlpha)
    ctx.beginPath()
    ctx.arc(mx, 0, 4, 0, Math.PI * 2)
    ctx.fillStyle = T.amber
    ctx.shadowColor = T.amber
    ctx.shadowBlur = 6
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
    ctx.restore()

    ctx.shadowBlur = 0
  }

  private drawFreezeTowerBody(ctx: CanvasRenderingContext2D, stroke: string, inspected: boolean, level: number): void {
    const lw = inspected ? 3 : 2
    const pulse = Math.sin(Date.now() / 500) * 0.5 + 0.5

    // Outer dish ring
    ctx.beginPath()
    ctx.arc(0, 0, 12, 0, Math.PI * 2)
    ctx.fillStyle = '#080e1a'
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.fill()
    ctx.stroke()

    // Ice crystal spines: 4 (or 6 at level 3) radiating outward
    const spineCount = level >= 3 ? 6 : 4
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.5
    for (let i = 0; i < spineCount; i++) {
      const a = (i / spineCount) * Math.PI * 2 - Math.PI / 4
      const innerR = 5
      const outerR = 14
      const sx = Math.cos(a) * innerR
      const sy = Math.sin(a) * innerR
      const ex = Math.cos(a) * outerR
      const ey = Math.sin(a) * outerR
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()
      // Diamond tip at spine end
      ctx.save()
      ctx.translate(ex, ey)
      ctx.rotate(a)
      ctx.fillStyle = level >= 2 ? '#CCFFFF' : stroke
      ctx.beginPath()
      ctx.moveTo(0, -2.5)
      ctx.lineTo(1.5, 0)
      ctx.lineTo(0, 2.5)
      ctx.lineTo(-1.5, 0)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    // Cryo core: inner glowing circle
    const coreR = level >= 2 ? 4.5 : 3.5
    ctx.save()
    ctx.shadowColor = stroke
    ctx.shadowBlur = 8 + pulse * 6
    ctx.beginPath()
    ctx.arc(0, 0, coreR, 0, Math.PI * 2)
    ctx.fillStyle = level >= 3 ? '#CCFFFF' : '#0a2a3a'
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.5
    ctx.fill()
    ctx.stroke()
    ctx.restore()

    ctx.shadowBlur = 0
  }

  private drawPoisonTowerBody(ctx: CanvasRenderingContext2D, stroke: string, inspected: boolean, level: number): void {
    const lw = inspected ? 3 : 2
    const drip = Math.sin(Date.now() / 600) * 0.5 + 0.5

    // Round acid tank body (slightly oval — wider than tall)
    ctx.beginPath()
    ctx.ellipse(0, 1, 11, 10, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#0a140a'
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.fill()
    ctx.stroke()

    // Pressure gauge circle on tank (detail)
    ctx.beginPath()
    ctx.arc(-4, -1, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#1a280a'
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1
    ctx.fill()
    ctx.stroke()

    // Spray nozzle: short tube pointing up-right at 45°
    ctx.save()
    ctx.rotate(-Math.PI / 4)
    ctx.fillStyle = '#1a2a0a'
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.rect(4, -2.5, level >= 2 ? 10 : 8, 5)
    ctx.fill()
    ctx.stroke()
    ctx.restore()

    // Acid drip drops: 2-3 small circles below tank (animated drip position)
    const dropCount = level >= 3 ? 3 : 2
    for (let i = 0; i < dropCount; i++) {
      const dropY = 12 + i * 6 + drip * 4
      const alpha = 1 - i * 0.3 - drip * 0.2
      ctx.save()
      ctx.globalAlpha = Math.max(0, alpha)
      ctx.beginPath()
      ctx.arc(3 + i * 3, dropY, 2 - i * 0.3, 0, Math.PI * 2)
      ctx.fillStyle = level >= 2 ? '#AAEE22' : '#88CC44'
      ctx.shadowColor = stroke
      ctx.shadowBlur = 4
      ctx.fill()
      ctx.restore()
    }

    ctx.shadowBlur = 0
  }

  private drawRepairTowerBody(ctx: CanvasRenderingContext2D, stroke: string, inspected: boolean, level: number): void {
    const lw = inspected ? 3 : 2
    const pulse = Math.sin(Date.now() / 700) * 0.5 + 0.5

    // Rounded square base (workshop pad)
    ctx.beginPath()
    const cr = 3, s2 = 11
    ctx.moveTo(-s2 + cr, -s2)
    ctx.lineTo( s2 - cr, -s2)
    ctx.arcTo( s2, -s2,  s2, -s2 + cr, cr)
    ctx.lineTo( s2,  s2 - cr)
    ctx.arcTo( s2,  s2,  s2 - cr,  s2, cr)
    ctx.lineTo(-s2 + cr,  s2)
    ctx.arcTo(-s2,  s2, -s2,  s2 - cr, cr)
    ctx.lineTo(-s2, -s2 + cr)
    ctx.arcTo(-s2, -s2, -s2 + cr, -s2, cr)
    ctx.closePath()
    ctx.fillStyle = '#0a1810'
    ctx.strokeStyle = stroke
    ctx.lineWidth = lw
    ctx.fill()
    ctx.stroke()

    // Wrench cross symbol (horizontal + diagonal bar = wrench silhouette)
    ctx.strokeStyle = stroke
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    // Vertical bar
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.stroke()
    // Horizontal bar
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke()
    ctx.lineCap = 'butt'

    // Diagonal accent line (wrench head suggestion)
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.2
    ctx.globalAlpha = 0.5
    ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(5, 5); ctx.stroke()
    ctx.globalAlpha = 1

    // Worker beacon: small pulsing dot in corner (level 2+ = 2 dots)
    const beaconCount = level >= 2 ? 2 : 1
    for (let i = 0; i < beaconCount; i++) {
      const bx = 6 - i * 5
      const by = 6
      ctx.save()
      ctx.globalAlpha = 0.6 + pulse * 0.4
      ctx.shadowColor = stroke
      ctx.shadowBlur = 5 + pulse * 3
      ctx.beginPath()
      ctx.arc(bx, by, level >= 3 ? 2.5 : 2, 0, Math.PI * 2)
      ctx.fillStyle = stroke
      ctx.fill()
      ctx.restore()
    }

    ctx.shadowBlur = 0
  }

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

  private drawWeaponGL(ctx: CanvasRenderingContext2D): void {
    // Barrel tube — wide and short
    ctx.fillStyle = '#3a4a2a'
    ctx.beginPath()
    ctx.ellipse(18, 0, 14, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    // Muzzle ring
    ctx.strokeStyle = '#5a6a3a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(32, 0, 5, -Math.PI / 2, Math.PI / 2)
    ctx.stroke()
    // Grip / receiver
    ctx.fillStyle = '#2a3a1a'
    ctx.fillRect(5, -3, 10, 6)
    // Trigger guard
    ctx.strokeStyle = '#4a5a2a'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(8, 4, 4, 0, Math.PI)
    ctx.stroke()
  }

  private drawWeaponDMR(ctx: CanvasRenderingContext2D): void {
    // Long precision barrel
    ctx.fillStyle = '#6a6a5a'
    ctx.fillRect(8, -1.5, 26, 3)
    // Receiver
    ctx.fillStyle = '#3a3a2a'
    ctx.fillRect(8, -3.5, 16, 7)
    // Scope rail + scope
    ctx.fillStyle = '#111'
    ctx.fillRect(10, -8, 12, 3.5)
    ctx.fillStyle = '#3a6a8a'
    ctx.beginPath()
    ctx.arc(10, -6.5, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(22, -6.5, 2, 0, Math.PI * 2)
    ctx.fill()
    // Mag
    ctx.fillStyle = '#4a4a3a'
    ctx.fillRect(13, 3.5, 5, 6)
    // Stock
    ctx.fillStyle = '#5a4a2a'
    ctx.fillRect(4, -2, 5, 4)
  }
}
