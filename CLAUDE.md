# Zombie Apolycase — Codebase Reference

> **Mục đích:** File này là nguồn sự thật duy nhất về codebase. Đọc file này thay vì quét lại toàn bộ project. Cập nhật sau mỗi lần sửa code.

---

## Tech Stack

- **Language:** TypeScript 5.4 (strict, ESM)
- **Build:** Vite 5.2
- **Rendering:** Canvas 2D (game world) + DOM/innerHTML (UI overlays)
- **No frameworks** — Không có React/Vue/Angular
- **Icons:** `src/ui/icons.ts` — SVG strings inline cho HTML; `src/ui/canvasIcons.ts` — Image cache cho Canvas
- **Font:** Russo One (Google Fonts, loaded via index.html)
- **World size:** 3000 × 3000px, base tại (1500, 1500)

---

## Cấu trúc thư mục

```
src/
├── core/           Game loop, Camera, InputManager
├── data/           Static data: weapons, zombies, skills
├── effects/        Particle system, EffectsManager
├── entities/       Player, Zombie, HomeBase, Tower, Bullet, DropItem, WorkerEntity
├── systems/        WaveManager, ResourceManager, TerritoryManager, SkillManager, Spawner
├── towers/         TowerTypes (profiles), Tower (logic)
├── ui/             HUD, BreakPanel, SkillSelectModal, BuildContextMenu, TowerInspectMenu,
│                   GameOverScreen, TutorialOverlay, icons, canvasIcons, theme
└── utils/          math.ts, saveLoad.ts
```

---

## Game Flow

```
TutorialOverlay → start() → enterBreak(10s) → exitBreak() → [playing phase]
  → wave ends (all zombies dead) → enterBreak(15s) → exitBreak() → repeat
  → base.hp <= 0 → gameover
```

**Phases:** `'playing' | 'break' | 'gameover'` — stored in `Game.phase`

---

## Entities & Key Classes

### `Game` (`src/core/Game.ts`)
- Orchestrator — owns tất cả systems và entities
- Constants: `BASE_X = 1500`, `BASE_Y = 1500`, `WORLD_W = WORLD_H = 3000`
- Key arrays: `zombies`, `towers`, `workers`, `bullets`, `drops`
- Key flags: `buildMode`, `barrierMode`, `pendingTowerType`, `paused`, `inspectedTower`
- **`placeTower(worldX, worldY, type)`** — validate + spend resources + spawn tower + spawn 3 workers nếu repairTower + set `tower.spawnTime` + `shake(2, 0.15)`
- **`expandTerritory()`** — spend crystal + territory.expand() + unlockSlot() + show skill modal
- **`enterBreak(duration?, showPanel?)`** / **`exitBreak()`** / **`skipBreak()`**
- **Screen shake:** `shake(intensity, duration)` — chỉ override nếu intensity mới >= hiện tại; decay exponential `intensity × (remaining/total)^0.4`; `shakeDuration` được giảm cả trong `update()` lẫn `updateBreak()` để tránh freeze vô hạn
- **Weapon shape renderers:** `drawWeaponPistol/Shotgun/AR/SMG/Sniper(ctx)` — private methods, ctx đã được translate+rotate về player khi gọi

### `Player` (`src/entities/Player.ts`)
- **Weapon inventory:** `weaponSlots: WeaponSlot[]` — mỗi slot có `{ profile, ammoInMag, reserveAmmo }`
- **`addWeapon(profile)`** — thêm weapon vào inventory, auto equip
- **`switchToSlot(idx, hud)`** — đổi weapon, reset cooldown/reload
- **`hasWeapon(id)`** — check ownership
- **`ownedWeapons`** getter — trả về `WeaponSlot[]`
- **`activeWeaponIndex`** getter
- Phím `Digit1`–`Digit9` switch weapon trong `updateWeaponSwitch()`
- Skill flags: `bulletCount`, `bulletPenetrating`, `bulletExplosion`, `fireRateMultiplier`
- Twin Shot: `pendingFollowBullet` — spawn viên 2 sau 0.08s delay, cùng góc

### `Tower` (`src/towers/Tower.ts`)
- `profile: TowerProfile` — tham chiếu đến TOWER_PROFILES
- `level: 1|2|3`, `maxHp = profile.hp * level`
- `upgrade()` → boolean — max level 3
- Types: `barricade | fireTower | electricTower | repairTower | machineGunTower`
- repairTower: không bắn — handled bởi WorkerEntity
- `spawnTime: number` — timestamp ms khi đặt (set bởi `game.placeTower()`), dùng cho spawn scale animation

### `WorkerEntity` (`src/entities/WorkerEntity.ts`)
- 3 workers spawn mỗi repairTower (từ `Game.placeTower`)
- `speed = 90`, `repairRate = 15 HP/s`
- State machine: `idle → movingOut → repairing → returning`
- Màu bạc (#C0C0C0), animation chân khi di chuyển, wrench icon khi repair

### `Zombie` (`src/entities/Zombie.ts`)
- Archetypes: `regular | fast | tank | armored | boss`
- Armored: 50% damage reduction
- Boss: 2000 HP, drops Crystal

### `Bullet` (`src/entities/Bullet.ts`)
- Flags: `isFireball`, `isBurning`, `isPenetrating`, `isExplosive`
- Fireball: `radius = 16` (tăng từ 10)
- `hitZombies: Set<object>` — prevent double-hit
- `weaponClass: WeaponClass | null` — tag để render streak đúng loại vũ khí

### `HomeBase` (`src/entities/HomeBase.ts`)
- Aura: heal towers/player, DOT zombies, thorns reflection
- Skills via `applyBaseSkill(id)`

---

## Tower Profiles (`src/towers/TowerTypes.ts`)

| Type | Iron | Core | HP | Range | Damage | FireRate | Special |
|------|------|------|----|-------|--------|----------|---------|
| barricade | 3 | 0 | 400 | 0 | 0 | 0 | Physical blocker |
| fireTower | 25 | 8 | 180 | 160 | 30 | 1.5 | Burn 8 DPS×3s, passthrough |
| electricTower | 20 | 12 | 140 | 180 | 12 | 1.0 | Chain 4 targets, +8%/target |
| repairTower | 15 | 10 | 100 | 150 | 0 | 0 | Spawns 3 workers |
| machineGunTower | 30 | 6 | 220 | 200 | 6 | 12 | Rapid single-target |

---

## Weapon Profiles (`src/data/weaponData.ts`)

Interface thêm 2 fields: `shakeIntensity: number`, `shakeDuration: number` — điều khiển camera shake khi bắn.

| ID | Class | DMG | FireRate | Spread | Reload | Mag | Speed | Cost | ShakeIntensity | ShakeDuration |
|----|-------|-----|----------|--------|--------|-----|-------|------|----------------|---------------|
| pistol_m9 | pistol | 18 | 3 | 3° | 1.2s | 15 | 1400 | 0 | 0.8 | 0.06s |
| shotgun_870 | shotgun | 12×8 | 0.8 | 18° | 2.5s | 6 | 1100 | 200 | 2.5 | 0.12s |
| ar_m4 | assaultRifle | 22 | 8 | 4° | 2.0s | 30 | 1800 | 350 | 1.0 | 0.07s |
| smg_mp5 | smg | 14 | 12 | 6° | 1.8s | 40 | 1600 | 280 | 0.6 | 0.05s |
| sniper_awp | sniperRifle | 150 | 0.5 | 0.5° | 3.0s | 5 | 2800 | 600 | 3.5 | 0.15s |

---

## Skills

### Player Skills (`src/data/playerSkillPool.ts`) — Level-up rewards
| ID | Icon | Effect | MaxStack |
|----|------|--------|---------|
| healthBoost | heart | +30 maxHP, heal 15 | 5 |
| damageBoost | zap | +8 damage | 5 |
| attackSpeed | crosshair | +15% fire rate | 3 |
| doubleBullet | split | bulletCount=2 (Twin Shot) | 1 |
| bulletDamage | circle-dot | +20% damage multiplier | 4 |
| bulletExplosion | bomb | AoE splash 50% | 1 |
| bulletPenetration | arrow-right | pierce through | 1 |
| armorUp | shield | +3 armor | 4 |
| critBoost | eye | +10% crit (max 80%) | 5 |
| speedBoost | activity | +25 speed | 4 |

### Base Skills (`src/data/baseSkillPool.ts`) — Territory expansion rewards
| ID | Icon | Effect | MaxStack |
|----|------|--------|---------|
| auraRangeUp | expand | +60 aura radius | 4 |
| auraDotUp | flame | +4 DOT/s | 5 |
| auraHealUp | plus-circle | +4 heal/s | 5 |
| baseRegenUp | refresh-cw | +2 base regen/s | 4 |
| baseMaxHpUp | layers | +300 maxHP, heal 150 | 3 |
| thornsAura | sword | reflect 30% damage | 1 |

---

## Resources

| Symbol | Key | Source | Used for |
|--------|-----|--------|---------|
| coins (SVG) | `res.coins` | Kills | Weapons, upgrades, supplies |
| hexagon (SVG) | `res.iron` | Kills | Tower placement/upgrade |
| cpu (SVG) | `res.energyCore` | Kills | Tower placement |
| gem (SVG) | `res.crystal` | Boss kills | Territory expansion |

---

## UI Components

### `HUD` (`src/ui/HUD.ts`)
- DOM-based overlay, updates từ `game.update()` mỗi frame
- Weapon slots: rebuild khi count/activeIndex đổi, fast-path update ammo/border thường xuyên
- Resource bar: `innerHTML` với SVG icons từ `icons.ts`
- Click trên weapon slot → `player.switchToSlot()`

### `BreakPanel` (`src/ui/BreakPanel.ts`)
- Slide in/out từ phải (`panel-open` CSS class)
- Live update interval 120ms: `updateResourceBar()` + `updateButtonStates()`
- Sections: Character upgrades (6 stats, grid 2 cột), Supplies, Weapons, Territory
- Weapon button: owned → switch; not owned → buy + add to inventory

### `SkillSelectModal` (`src/ui/SkillSelectModal.ts`)
- Keyboard shortcuts 1/2/3 (qua `document.addEventListener`, không qua InputManager)
- Accent color: amber cho player skills, cyan cho territory skills

### `BuildContextMenu` (`src/ui/BuildContextMenu.ts`)
- Right-click trên canvas → hiện menu build tower
- Validate: inside territory + can afford

### `TowerInspectMenu` (`src/ui/TowerInspectMenu.ts`)
- Right-click trên tower đã đặt → inspect/upgrade/sell
- Sell refund = 50% original cost

---

## Effects System

### `EffectsManager` (`src/effects/EffectsManager.ts`)
- `particles: Particle[]` — capped at 400
- `lightnings: LightningEffect[]` — persistent zigzag chains, life = 0.18s
- `spawnLightningChain(points)` — tạo zigzag segments với mid-point random offsets ±28px max
- `spawnFireTrail(x, y, angle)` — 3 particles/call, backward direction, life 0.1–0.18s
- `triggerDamageFlash()` / `triggerExplosionFlash()` — full-screen color overlay

---

## Icon System

### `src/ui/icons.ts` — cho HTML (innerHTML)
```typescript
getIcon(key: string, size?: number, color?: string): string  // returns <svg>...</svg>
```
Keys: `heart, zap, crosshair, split, circle-dot, bomb, arrow-right, shield, eye, activity, expand, flame, plus-circle, refresh-cw, layers, sword, star, coins, hexagon, cpu, gem, x, chevron-right, check, user, package, map`

### `src/ui/canvasIcons.ts` — cho Canvas 2D
```typescript
loadCanvasIcons(iconDefs: {icon, color}[])  // gọi 1 lần khi khởi động
drawCanvasIcon(ctx, icon, color, cx, cy, size)  // vẽ từ image cache
```
Canvas icons: `flame` (#FF6820), `zap` (#88eeff), `wrench` (#4CAF50), `crosshair` (#E8A030), `shield` (#8B3A2A)

---

## Theme (`src/ui/theme.ts`)

```typescript
T.bg = '#D4C5B0'        // text/fg color (light parchment)
T.rust = '#8B3A2A'      // borders, health low
T.orange = '#C4622D'    // accents
T.amber = '#E8A030'     // highlights, current wave
T.blood = '#CC1A1A'     // danger
T.iron = '#7A7060'      // secondary text
T.ember = '#FF6B35'     // particles
T.gold = '#E8C84A'      // coins
T.ironGrey = '#A89880'  // iron resource
T.coreBlue = '#7788FF'  // energy core
T.crystalCyan = '#88EEFF' // crystal
T.hpHigh = '#4CAF50'    // health bar green
T.font = "'Russo One', sans-serif"
```

---

## InputManager (`src/core/InputManager.ts`)

- `isDown(code)` — key held
- `consumePress(code)` — key just pressed, consumes flag
- Key codes: `'KeyW'`, `'KeyA'`, `'KeyS'`, `'KeyD'`, `'KeyR'`, `'Digit1'`–`'Digit9'`, `'ArrowUp/Down/Left/Right'`
- Mouse: `input.mouse.{x, y, down}`
- **Chú ý:** Skill modal dùng `document.addEventListener('keydown')` riêng — không conflict với `consumePress`

---

## Wave Scaling (`src/systems/Spawner.ts`)

- HP/damage multiplier: `1 + (waveIndex - 1) × 0.18`
- Wave 1: regular only → Wave 2+: +fast → Wave 3+: +tank → Wave 4+: +armored
- Every 5th wave: boss zombie (2000 HP, drops Crystal)
- Spawn points: 8 edges + corners quanh world với random jitter

---

## Territory System (`src/systems/TerritoryManager.ts`)

- Base radius: 300px + 200px per expansion level
- Expansion cost: `1 + level` crystals (level 0 → 1 crystal, level 1 → 2, ...)
- Each expansion: `skills.unlockSlot()` → shows 3 random base skill options

---

## Render Pipeline (`src/core/Game.ts`)

```
render()
  └── clear canvas
  └── save/translate (camera + shake)
      ├── renderBase()       — home base circle + aura ring
      ├── renderDrops()      — loot items
      ├── effects.renderWorld()  — particles + lightning
      ├── renderTowers()     — tower squares + SVG icons + HP bars
      ├── renderWorkers()    — worker entities
      ├── renderZombies()    — zombie sprites
      ├── renderPlayer()     — player triangle + direction indicator
      ├── renderBullets()    — projectiles (fireball special rendering)
      └── renderBuildPreview()  — ghost tower when in build mode
  └── restore
  └── effects.renderScreen() — full-screen flash
  └── hud.update()           — DOM updates
```

**Fireball rendering** (special):
- 4 teardrop "tail" layers phía sau, wobble = `sin(Date.now()/80)`
- 3 fire layers: outer (#FF5500, ×1.25r), mid (#FF8820, ×1r), core (#FFEE44, ×0.45r)
- Fire trail particles: `effects.spawnFireTrail()` mỗi frame

**Regular bullet rendering** — light streak (2-pass glow+core), defined in module-level `BULLET_STREAK` const:
- Mỗi weapon class có `{ len, w, color, glow }` riêng (sniper dài nhất 38px, shotgun ngắn nhất 10px)
- Pass 1 (glow): lineWidth = w×3, shadowBlur=5, thấp alpha
- Pass 2 (core): lineWidth = w, alpha=1.0, shadowBlur reset về 0
- **Phải reset `ctx.shadowBlur = 0` sau glow pass** để không ảnh hưởng các draw call khác

**Tower spawn animation** (trong `renderTowers()`):
- Scale 1.4→1.0 trong 150ms, cubic ease-out: `1 - (1-t)^3`
- `spawnTime` set lúc `placeTower()` + `shake(2, 0.15)` cùng lúc

---

## Save System (`src/utils/saveLoad.ts`)

Hiện tại **chưa được tích hợp** vào game flow — exists nhưng không được gọi. Tower placements không persist.

---

## Các Pattern Quan Trọng

1. **UI updates:** Tất cả UI là DOM innerHTML — không có Virtual DOM. Update bằng cách set `innerHTML` hoặc `textContent` trực tiếp.

2. **Resource spending:** Luôn dùng `game.resources.spend({...})` — trả về `false` nếu không đủ tiền, không throw.

3. **Tower placement:** Luôn qua `game.placeTower()` — có validation territory + resource check.

4. **Skill application:** Player skills qua `player.applyLevelUpSkill(id)`, base skills qua `base.applyBaseSkill(id)`.

5. **Ammo per slot:** Mỗi `WeaponSlot` lưu `ammoInMag` và `reserveAmmo` riêng — đổi vũ khí không mất đạn.

6. **Effects:** Không render trực tiếp trong entity — gọi `game.effects.spawnXxx()` hoặc truyền `effects` ref.
