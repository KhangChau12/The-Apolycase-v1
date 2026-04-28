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
├── data/           Static data: weapons, zombies, skills, baseSkillTree, garrisonData,
│                   zombieAnimationData (animation clips, windup durations, combo data)
├── effects/        Particle system, EffectsManager
├── entities/       Player, Zombie, HomeBase, Tower, Bullet, DropItem, WorkerEntity, GarrisonUnit
├── rendering/      ZombieLimbs (limb skeleton factories + composite draw)
├── systems/        WaveManager, ResourceManager, TerritoryManager, SkillManager, Spawner
├── towers/         TowerTypes (profiles), Tower (logic)
├── ui/             HUD, BreakPanel, SkillSelectModal, BaseSkillTreeModal, BuildContextMenu,
│                   TowerInspectMenu, GameOverScreen, TutorialOverlay, icons, canvasIcons, theme
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
- **`openBaseSkillTree()`** — hides BreakPanel, shows BaseSkillTreeModal (replaces old `expandTerritory()`)
- **Territory auto-expand** — tự động sau khi boss wave cleared (gọi `territory.expand()`, không tốn crystal)
- **`enterBreak(duration?, showPanel?)`** / **`exitBreak()`** / **`skipBreak()`**
- **`spawnGarrison()`** — gọi mỗi exitBreak() nếu `base.garrisonEnabled`; tạo soldiers + optional heavy/medic/titan
- **`garrisonUnits: GarrisonUnit[]`** — cleared và re-spawned mỗi wave start
- **Screen shake:** `shake(intensity, duration)` — chỉ override nếu intensity mới >= hiện tại; decay exponential `intensity × (remaining/total)^0.4`; `shakeDuration` được giảm cả trong `update()` lẫn `updateBreak()` để tránh freeze vô hạn
- **Weapon shape renderers:** `drawWeaponPistol/Shotgun/AR/SMG/Sniper(ctx)` — private methods, ctx đã được translate+rotate về player khi gọi
- **`onZombieDead(z, killAngle?)`** — gọi `player.onKill()`, spawn drops, add XP; đây là điểm duy nhất đếm kill
- **Bullet collision** — áp dụng `deathMark` (×2 dmg nếu zombie < 20% HP) và `lifesteal` (heal player) tại đây

### `Player` (`src/entities/Player.ts`)
- **Weapon inventory:** `weaponSlots: WeaponSlot[]` — mỗi slot có `{ profile, ammoInMag, reserveAmmo }`
- **`addWeapon(profile)`** — thêm weapon vào inventory, auto equip
- **`switchToSlot(idx, hud)`** — đổi weapon, reset cooldown/reload
- **`hasWeapon(id)`** — check ownership
- **`ownedWeapons`** getter — trả về `WeaponSlot[]`
- **`activeWeaponIndex`** getter
- Phím `Digit1`–`Digit9` switch weapon trong `updateWeaponSwitch()`
- **Skill flags:** `bulletCount`, `bulletPenetrating`, `bulletExplosion`, `fireRateMultiplier`, `lastStandEnabled`, `berserkerEnabled`, `overchargeEnabled`, `phantomRoundEnabled`, `deathMarkEnabled`
- **Berserker runtime state:** `berserkerStacks`, `berserkerTimer` — reset về 0 sau 3s không kill
- **Overcharge:** `overchargeReady = true` sau mỗi lần reload xong, reset sau phát bắn đầu tiên
- **Phantom Round:** 20% chance bắn không tốn đạn
- Twin Shot: `pendingFollowBullet` — spawn viên 2 sau 0.08s delay, cùng góc
- **`appliedPlayerSkills: Map<PlayerSkillId, number>`** — track stack count của từng skill đã apply, dùng bởi HUD Upgrade Stats
- **`onBulletHit(damageDealt)`** — gọi từ Game khi bullet player hit zombie, xử lý lifesteal
- **`onKill()`** — increment kills, trigger berserker stack; gọi từ `game.onZombieDead()`
- **`effectiveSpeed`** getter — tính cả Last Stand bonus (+30 khi HP < 25%)
- **Reload speed:** `reloadTimer = w.reloadTime / stats.reloadSpeedMult`
- **XP:** `addXp(amount)` nhân với `stats.xpMult` trước khi cộng

### `PlayerStats` interface
```typescript
maxHp, hp, armor, speed, damage, critChance, pickupRange, level, xp, xpToNext
lifesteal: number       // fraction of damage dealt restored as HP (0.0–0.12)
dodgeChance: number     // chance to fully negate an incoming hit (0.0–0.4)
reloadSpeedMult: number // multiplier on reload time (default 1.0, >1 = faster)
xpMult: number          // multiplier on XP gained (default 1.0)
dropBonus: number       // additive bonus to resource drop rate (0.0–0.45)
```

### `Tower` (`src/towers/Tower.ts`)
- `profile: TowerProfile` — tham chiếu đến TOWER_PROFILES
- `level: 1|2|3`, `maxHp = profile.hp * level`
- `upgrade()` → boolean — max level 3
- Types: `barricade | fireTower | electricTower | repairTower | machineGunTower`
- repairTower: không bắn — handled bởi WorkerEntity
- `spawnTime: number` — timestamp ms khi đặt (set bởi `game.placeTower()`), dùng cho spawn scale animation
- **`auraDamageBonus: number`** — fraction bonus damage từ HomeBase aura (0.0–0.25); set mỗi frame bởi `base.applyAura()`
- **`auraRangeBonus: number`** — fraction bonus range từ HomeBase aura; reset về 0 nếu ra ngoài aura
- Tower dùng `effectiveDamage()` và `effectiveRange()` private helpers khi bắn

### `WorkerEntity` (`src/entities/WorkerEntity.ts`)
- 3 workers spawn mỗi repairTower (từ `Game.placeTower`)
- `baseSpeed = 90`, `baseRepairRate = 15 HP/s`
- `update(dt, towers, base, zombies?)` — takes `base` for upgrade flags, `zombies` for attack drone mode
- State machine: `idle → movingOut → repairing → returning` (normal) or `patrolAttack` (fortress protocol)
- **`repairDroneUpgradeEnabled`**: speed ×1.4, repairRate ×1.5
- **`fortressProtocolEnabled`**: switches to attack drone mode — diamond red shape, orbits tower, attacks zombies in 80px, 5 DPS
- Màu bạc (#C0C0C0) normal, đỏ diamond (#CC3300) khi attack drone

### `Zombie` (`src/entities/Zombie.ts`)
- Archetypes: `regular | fast | tank | armored | boss`
- **`tier: number`** — chỉ áp dụng cho zombie thường; boss luôn tier 0 (visual tier tính riêng khi render)
- Armored: base 50% damage reduction, có thể tăng theo tier qua `damageReduction` (cap 85%)
- Boss: 2000 HP, drops Crystal
- **Tier stat scaling** dùng `ZOMBIE_TIER_SCALING` từ `src/data/zombieData.ts`:
  - regular: tăng cân bằng
  - fast: ưu tiên speed
  - tank: ưu tiên HP + damage
  - armored: ưu tiên độ lì (HP + damage reduction)
- **`slowFactor: number`** — fraction speed reduction (0–0.6); set mỗi frame bởi HomeBase nếu trong aura, reset về 0 cuối mỗi frame
- **`stunTimer: number`** — giây còn lại bị stun; khi > 0 bỏ qua move + attack
- **`stun(duration)`** — method để set stunTimer (max với value hiện tại)
- **Visual state fields:** `attackFlashTimer` (0.12s, dùng nội bộ), `attackAnimTimer` (0.3s, drive `'attack'` animState), `wobbleTimer` (tích lũy khi di chuyển), `hitRecoilTimer` (0.1s, squeeze 95% khi bị hit)
- **Animation state machine** (`src/data/zombieAnimationData.ts`):
  - `animState: AnimationState` — `'idle' | 'walk' | 'attack' | 'windup' | 'stun'`
  - `frameIndex`, `frameTimer`, `currentFrame: AnimationFrame` — frame hiện tại, đọc bởi renderer
  - `updateAnimation(dt, moving)` — tự động transition state, advance frame
- **Wind-up attack** — delay thực sự trước khi damage apply:
  - `windupActive: boolean`, `windupTimer: number`, `windupMax: number`
  - `WINDUP_DURATIONS`: regular=0.2s, fast=0.15s, tank=0.4s, armored=0.3s, boss=0.4s
  - Khi `windupTimer <= 0`: apply damage, set `attackAnimTimer=0.3`, gọi `game.spawnZombieSlash()`
- **Combo damage** — `comboCounter` (0→1→2→reset) nhân với `COMBO_DAMAGE_MULT = [1.0, 1.15, 1.35]`
- **`game.spawnZombieSlash(x, y, fromAngle, archetype)`** — interface `GameRef` yêu cầu method này; Game.ts delegate sang `effects.spawnZombieSlash()`

### `Bullet` (`src/entities/Bullet.ts`)
- Flags: `isFireball`, `isBurning`, `isPenetrating`, `isExplosive`
- Fireball: `radius = 16` (tăng từ 10)
- `hitZombies: Set<object>` — prevent double-hit
- `weaponClass: WeaponClass | 'soldierDrone' | null` — tag để render streak đúng loại vũ khí; `'soldierDrone'` = garrison soldier bullet (cyan streak, khai báo trong `BULLET_STREAK` của Game.ts)
- **`lifesteal: number`** — fraction heal; Game đọc field này khi bullet hit zombie
- **`deathMark: boolean`** — nếu true, double damage khi zombie < 20% HP; Game xử lý logic này
- **`machineGunSlow: boolean`** — khi hit, áp dụng slowFactor 0.4 cho zombie (machineGunOverdrive)
- **`armorPiercing: boolean`** — bỏ qua 50% damage reduction của armored/boss (machineGunAP)
- **`splashFraction: number`** — AoE damage fraction (default 0.5); dùng bởi inferno fireball
- **`splashRadius: number`** — AoE radius (default 60); dùng bởi inferno fireball (40px)

### `HomeBase` (`src/entities/HomeBase.ts`)
- **Visual state fields:** `rotationAngle` (tăng 0.4 rad/s, drive outer ring rotation), `pulseTimer` (tăng mỗi dt, drive inner core glow pulse) — cả hai increment trong `update()`
- Aura: heal towers/player, DOT zombies, slow/stun zombies, buff towers
- Skills via `applyBaseSkill(id)` — now uses `BASE_SKILL_TREE_MAP.get(id)` (not BASE_SKILL_POOL)
- **`slowAuraAmount: number`** — fraction giảm speed zombie trong aura (stack 0.15/stack, max 0.6)
- **`towerDamageAura: number`** / **`towerRangeAura: number`** — bonus fraction cho towers trong aura
- **`overlordAuraEnabled: boolean`** — override cả hai về +25% (Legendary)
- **`shieldPulseEnabled`**, **`shieldHp`**, **`shieldPulseMaxHp`**, **`shieldPulseCooldown`** — Barrier Pulse system
- **`stunPulseEnabled`**, **`stunPulseCooldownMax`** — Shockwave pulse mỗi 10s stun 1.5s
- **`counterStrikeEnabled`** — khi take damage, set `pendingCounterStrike = attacker` để Game xử lý
- **`garrisonEnabled`** — set true bởi `garrisonCall` skill; triggers `spawnGarrison()` each wave
- **`garrisonUnitCount`** (default 2), **`garrisonHpMult`**, **`garrisonDamageMult`** — base garrison stats
- **`garrisonHeavyEnabled`**, **`garrisonMedicEnabled`**, **`garrisonTitanEnabled`** — optional unit types
- **`heavySlowFieldEnabled`**, **`medicHealUpEnabled`**, **`emergencyRespawnEnabled`**, **`garrisonArmoredEnabled`**, **`warlordCallEnabled`** — garrison upgrades
- **Active attacks**: `fireboltEnabled` (4s cooldown), `arcDischargeEnabled` (8s), `mortarBarrageEnabled` (15s)
- **Tech flags** (set each frame by `applyAura()` to towers in aura): `fireTowerOverdriveEnabled`, `electricTowerOverloadEnabled`, `machineGunOverdriveEnabled`, `fireTowerInfernoEnabled`, `electricEMPEnabled`, `machineGunAPEnabled`, `synergyEngineEnabled`, `neuralNetworkEnabled`, `fortressProtocolEnabled`, `repairDroneUpgradeEnabled`
- **`divineShieldEnabled`** / **`isInvulnerable`** getter — periodic 3s invuln mỗi 30s
- **`resourceDropBonus: number`** — Salvage Field, cộng vào drop rate trong aura
- **`resetWaveFlags()`** — called at wave start to reset warlordUsedThisWave
- `takeDamage()` — check `isInvulnerable`, absorb shield trước, thorns reflection, counter strike

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

## Skill System

### Rarity (`src/data/playerSkillPool.ts`)
```typescript
export type SkillRarity = 'common' | 'rare' | 'legendary'
```
- `common` → #A89880 (ironGrey), weight 60
- `rare` → #7788FF (coreBlue), weight 30
- `legendary` → #E8C84A (gold), weight 10; **chỉ drop từ wave 5+**

### Rolling (`src/systems/SkillManager.ts`)
- **`skills.rollPlayerOptions(count, waveIndex, appliedMap)`** — roll player skill options với weighted rarity
- **`skills.rollBaseOptions(count, waveIndex)`** — vestigial, no longer called (base skills use tree UI now)
- `Game.showPlayerLevelUpModal()` gọi `skills.rollPlayerOptions()` cho player level-ups
- Base skill selection now done via `BaseSkillTreeModal` — player clicks nodes directly

### `SkillSelectModal` (`src/ui/SkillSelectModal.ts`)
- `GenericSkillOption` có thêm `rarity?: SkillRarity`
- Border color theo rarity: common=xám, rare=xanh, legendary=vàng + glow
- Badge "RARE" / "LEGENDARY" góc trên phải card nếu không phải common
- Keyboard shortcuts 1/2/3 (qua `document.addEventListener`, không qua InputManager)
- Accent color: amber cho player skills, cyan cho territory skills
- **Không còn method `show(SkillId[])`** — chỉ dùng `showGeneric()`

### Player Skills (`src/data/playerSkillPool.ts`) — 20 skills

**Common (8):**
| ID | Effect | MaxStack |
|----|--------|---------|
| healthBoost | +30 maxHP, heal 15 | 5 |
| damageBoost | +8 damage | 5 |
| attackSpeed | +15% fire rate | 3 |
| armorUp | +3 armor | 4 |
| speedBoost | +25 speed | 4 |
| reloadMaster | +25% reload speed | 4 |
| xpBoost | +20% XP gain | 3 |
| scavenger | +15% resource drop rate | 3 |

**Rare (7):**
| ID | Effect | MaxStack |
|----|--------|---------|
| critBoost | +10% crit (max 80%) | 5 |
| bulletDamage | +20% damage multiplier | 4 |
| doubleBullet | bulletCount=2 (Twin Shot) | 1 |
| lifesteal | +4% lifesteal per hit | 3 |
| dodgeUp | +10% dodge chance (max 40%) | 4 |
| lastStand | <25% HP: +40% dmg, +30 speed | 1 |
| berserker | Each kill in 3s: +5% dmg (max +50%) | 1 |

**Legendary (5, wave 5+):**
| ID | Effect | MaxStack |
|----|--------|---------|
| bulletPenetration | pierce through all enemies | 1 |
| bulletExplosion | AoE splash 50% | 1 |
| overcharge | first shot after reload ×2 dmg | 1 |
| phantomRound | 20% chance không tốn đạn | 1 |
| deathMark | enemies <20% HP nhận ×2 dmg | 1 |

### Base Skills — now in `src/data/baseSkillTree.ts` (47 nodes, 3 branches + root)

Skills are unlocked via `BaseSkillTreeModal` by spending crystal. `BASE_SKILL_TREE_MAP` used for O(1) lookup.

**ROOT**: `baseCore` — auto-unlocked on `show()`, 0 crystal, canvas position (1200, 700)

**ACTIVE branch** (amber, 16 nodes, spreads left): `auraCore` gateway (950,700) → auraRangeUp, auraDotUp, auraHealUp, baseRegenUp → slowAura, thornsAura, resourceAura, shieldPulse → baseFirebolt, counterStrike, baseChainLightning, stunPulse → baseMortarBarrage, overlordAura, divineShield

**SUMMON branch** (green #4CAF50, 12 nodes, spreads down): garrisonCall → garrisonSize, garrisonHP, garrisonDamage → garrisonHeavy, garrisonMedic, garrisonArmored → heavySlowField, garrisonTitan, medicHealUp, emergencyRespawn → warlordCall

**TECHNOLOGY branch** (coreBlue, 14 nodes, spreads right): `techCore` gateway (1450,700) → towerDamageBuff, towerRangeBuff, baseMaxHpUp → fireTowerOverdrive, electricTowerOverload, machineGunOverdrive, repairDroneUpgrade → fireTowerInferno, electricTowerEMP, machineGunArmorPierce → overlordAuraTech, towerNetworkSync → fortressProtocol

`src/data/baseSkillPool.ts` — `BaseSkillId` union type (47 IDs including `auraCore`, `techCore`), `BASE_SKILL_POOL` kept for legacy compat

---

## Resources

| Symbol | Key | Source | Used for |
|--------|-----|--------|---------|
| coins (SVG) | `res.coins` | Kills | Weapons, upgrades, supplies |
| hexagon (SVG) | `res.iron` | Kills | Tower placement/upgrade |
| cpu (SVG) | `res.energyCore` | Kills | Tower placement |
| gem (SVG) | `res.crystal` | Boss kills | Unlock nodes in Base Skill Tree |

---

## UI Components

### `HUD` (`src/ui/HUD.ts`)
- DOM-based overlay, updates từ `game.update()` mỗi frame
- Weapon slots: rebuild khi count/activeIndex đổi, fast-path update ammo/border thường xuyên
- Resource bar: `innerHTML` với SVG icons từ `icons.ts`
- Click trên weapon slot → `player.switchToSlot()`
- **Upgrade Stats section** (section 5 trong bottom bar grid): chỉ còn **CHAR** group (amber) — BASE group đã xóa
  - Luôn hiện **3 ô cố định** — ô rỗng có crosshair icon mờ, ô có skill có border glow + corner accent
  - 3 skill mới nhất được hiện (insertion order của Map), right-aligned
  - **Hover tooltip**: tên skill + stack count, border top màu amber
  - **×N badge** góc dưới phải nếu stack > 1
  - **Nút ⤢** (expand) góc trên phải section — xuất hiện khi player skills > 3
  - Click ⤢ → modal `#hud-upg-modal` phía trên HUD bar, hiện tất cả player skills
  - Hash-based update: chỉ rebuild DOM khi skill thay đổi (`lastPlayerUpgHash` init = `'__init__'`)
  - Imports `PLAYER_SKILL_POOL` để lookup icon/label; BASE_SKILL_POOL không còn cần trong HUD
- **BASE TREE button** (section 6, column 6): `cpu` SVG icon + "BASE TREE" text, click → `game.baseSkillTreeModal.show()`
- **Grid columns**: `180px 1fr 130px auto auto auto` (6 cột)

### `BreakPanel` (`src/ui/BreakPanel.ts`)
- Slide in/out từ phải (`panel-open` CSS class)
- Live update interval 120ms: `updateResourceBar()` + `updateButtonStates()`
- Sections: Character upgrades (6 stats, grid 2 cột), Supplies, Weapons, Territory
- Weapon button: owned → switch; not owned → buy + add to inventory
- **Territory section**: shows current radius + crystal count; button "VIEW SKILL TREE" opens `BaseSkillTreeModal`
- Territory expansion button removed — territory expands automatically after boss wave clears

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
- `slashes: SlashEffect[]` — melee slash marks với animated sweep-in + staggered fade
- `spawnLightningChain(points)` — tạo zigzag segments với mid-point random offsets ±28px max
- `spawnFireTrail(x, y, angle)` — 3 particles/call, backward direction, life 0.1–0.18s
- `spawnShockwaveDebris(x, y, color)` — 10 debris particles + 6 white sparks, radial outward với gravity — dùng cho garrison stomp impact
- `spawnHealParticles(x, y)` — 4 particles xanh lá bay lên (gravity âm), dùng cho medic heal visual
- `spawnZombieSlash(x, y, fromAngle, archetype)` — spawn vết tấn công tại vị trí target; dùng `SlashEffect` (straight-line strokes chạy theo `perp`, không phải arc); mỗi archetype có pattern riêng: regular=3 đường song song cách 8px, fast=4 đường mỏng cách 8px, tank=2 đường dày + dấu X chéo, armored=3 đường ngắn cứng + ricochet line, boss=5 đường rộng dần + dấu X lớn
- `triggerDamageFlash()` / `triggerExplosionFlash()` — full-screen color overlay

**`SlashEffect` struct** (internal): `strokes: SlashStroke[]`, `life`, `maxLife`, `glowColor`, `flashRadius`, `flashColor`, `impactX`, `impactY` — mỗi `SlashStroke` có `cx, cy, r, startAngle, endAngle, lineWidth, color, delay` + optional `isCrack, crackX1/Y1/X2/Y2` cho straight-line strokes

**Slash render pipeline** (3 phases per slash):
1. **Impact flash** — radial gradient trắng → màu → transparent, chỉ trong 12% đầu lifetime
2. **Sweep-in** — stroke reveal dần qua `smoothstep(0, 0.30, elapsed)` trong 30% đầu
3. **Staggered fade** — mỗi stroke có `delay` (0–0.25) để fade lệch nhau; alpha = `strokeT²`; `isCrack` strokes render là `lineTo` + white centerline 0.7px

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
T.gold = '#E8C84A'      // coins / legendary rarity
T.ironGrey = '#A89880'  // iron resource / common rarity
T.coreBlue = '#7788FF'  // energy core / rare rarity
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
- **Zombie tier evolution (non-boss only):**
  - Constants: `BOSS_EVERY=5`, `MAX_TIER=3`, `BASE_TIER_CHANCE=0.05`, `TIER_CHANCE_STEP=0.01`, `TIER_STEP_WAVE_CADENCE=2`
  - Unlock cadence: tier 1 sau boss #1, tier 2 sau boss #3, tier 3 sau boss #5 (`maxUnlockedTier()`)
  - Tier chance: tier mới unlock bắt đầu 5%, tăng +1% mỗi 2 wave (`tierChanceAtWave()`), cap 20%
  - Sampling: `rollZombieTier()` phân bổ weight từ tier cao xuống để tier cao hiếm hơn, phần còn lại là tier 0
  - `spawnWave()` gán tier từng zombie qua `new Zombie(..., waveMult, tier)`

---

## Territory System (`src/systems/TerritoryManager.ts`)

- Base radius: 300px + 200px per expansion level
- **Auto-expands** when boss zombie is killed (no crystal cost)
- Crystal is now used exclusively for `BaseSkillTreeModal` node unlocks

---

## Render Pipeline (`src/core/Game.ts`)

```
render()
  └── clear canvas
  └── save/translate (camera + shake)
      ├── renderBase()           — futuristic fortress (aura spokes + rotating ring + octagon shell + inner core + antennas + shield arc)
      ├── renderDrops()          — loot items
      ├── effects.renderWorld()  — particles + lightning
      ├── renderTowers()         — tower squares + SVG icons + HP bars
      ├── renderWorkers()        — worker entities (drone mode when fortressProtocol active)
      ├── renderGarrisonUnits()  — garrison soldiers/heavy/medic/titan
      ├── renderZombies()        — per-archetype sprites + tier diamonds + attack flash
      ├── renderPlayer()         — player triangle + direction indicator
      ├── renderBullets()        — projectiles (fireball special rendering)
      └── renderBuildPreview()   — ghost tower when in build mode
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
- `soldierDrone`: len=10, w=1.2, màu cyan `rgba(136,220,255)` — dùng cho garrison soldier bullets
- Pass 1 (glow): lineWidth = w×3, shadowBlur=5, thấp alpha
- Pass 2 (core): lineWidth = w, alpha=1.0, shadowBlur reset về 0
- **Phải reset `ctx.shadowBlur = 0` sau glow pass** để không ảnh hưởng các draw call khác

**Tower spawn animation** (trong `renderTowers()`):
- Scale 1.4→1.0 trong 150ms, cubic ease-out: `1 - (1-t)^3`
- `spawnTime` set lúc `placeTower()` + `shake(2, 0.15)` cùng lúc

**HomeBase rendering** (`renderBase()` — futuristic fortress, 8 layers back-to-front):
1. Aura fill + 6 radial spokes + solid ring (amber; cyan nếu `overlordAuraEnabled`)
2. Outer rotating ring r=48: dashed arc + 8 tick marks driven bởi `base.rotationAngle`
3. Octagon armor shell r=40: fill `#0e0a06`, stroke = `hpColor(pct)` (đỏ dần khi máu thấp)
4. Inner core r=24: pulsing shadowBlur `20+6*sin(pulseTimer*2)` + amber fill overlay
5. 2 antenna towers (±16, -26...-40) với tip dot glow
6. Shield arc r=54 (chỉ hiện khi `shieldHp > 0`), alpha theo `shieldHp/shieldPulseMaxHp`
7. HP bar tại y-70
8. HP text nhỏ `{hp}/{maxHp}` tại y+58

**Zombie rendering** (`renderZombies()` — dùng composite limb system từ `src/rendering/ZombieLimbs.ts`):
- Không còn `_drawZombieXxx` helpers — thay bằng `SKELETON_FACTORIES[archetype](radius, tier)` + `drawZombieComposite()`
- **Boss visual tier** tính từ `waveManager.waveIndex` tại render time: waves 1–5 → vTier 0, 6–10 → vTier 1, 11+ → vTier 2 (không liên quan đến `z.tier`)
- **Wind-up scale**: khi `z.windupActive`, body scale compress `(1 - 0.15*windupPct) × (1 + 0.1*windupPct)` trước khi draw
- **Hit recoil**: `z.hitRecoilTimer > 0` → scale body 95% (squeeze nhẹ)
- **Stun stars**: 3 vòng tròn trắng orbit tại `radius+10`, rotate theo `Date.now()/400`, alpha fade khi `stunTimer < 0.3`
- **Tier indicator**: N hình thoi amber (◆) phía trên HP bar
- **Không còn attack flash arc** trên thân zombie — thay bằng `SlashEffect` tại vị trí target

**`src/rendering/ZombieLimbs.ts`** — Limb skeleton system:
- `LimbSegment` interface: `id, type ('circle'|'rect'|'triangle'|'line'|'polygon'), x, y, w, h, rotation, color, strokeColor, strokeWidth, glow, glowBlur, alpha, points?, children?`
- `ZombieRenderParams`: `radius, animFrame, hitRecoilTimer, windupActive, windupPct, glowColor, glowBlur, wobble`
- `SKELETON_FACTORIES: Record<ZombieArchetype, (r, tier) => LimbSegment[]>` — factory functions, tính toán skeleton mỗi frame dựa vào radius thực tế
- `drawZombieComposite(ctx, skeleton, params)` — apply body scale → recurse `drawSegment()` cho từng limb
- Per-archetype tiers (regular/fast/tank/armored: tier 0–3; boss: vTier 0–2) — mỗi tier thêm hoặc thay đổi limb segments

**`src/data/zombieAnimationData.ts`** — Animation data:
- `AnimationFrame`: `duration, bodyScaleX, bodyScaleY, headOffsetY, armRotL, armRotR, legOffsetL, legOffsetR, limbDeltas?`
- `AnimationClip`: `frames[], loopable`
- `ANIMATION_CLIPS: Record<ZombieArchetype, Record<AnimationState, AnimationClip>>` — 5 archetypes × 5 states
- `WINDUP_DURATIONS: Record<ZombieArchetype, number>` — thời gian wind-up mỗi archetype
- `COMBO_DAMAGE_MULT = [1.0, 1.15, 1.35]` — damage multiplier theo comboCounter
- `COMBO_PATTERNS: Record<ZombieArchetype, string[]>` — tên combo (visual label only)

**Zombie soft separation** (`applyZombieSeparation()` — gọi sau zombie update loop):
- O(n²) pair check, push overlap × 0.5 ra mỗi phía; minDist = `a.radius + b.radius + 2`
- Chỉ áp dụng cho `alive` zombies; stun không ảnh hưởng separation

---

## Save System (`src/utils/saveLoad.ts`)

Hiện tại **chưa được tích hợp** vào game flow — exists nhưng không được gọi. Tower placements không persist.

---

## GarrisonUnit System (`src/entities/GarrisonUnit.ts`, `src/data/garrisonData.ts`)

Spawn at wave start via `spawnGarrison()` if `base.garrisonEnabled`. Visual identity: drone cơ giới — fill xám thép `#3A3A3A`, glow màu đặc trưng, kích thước lớn hơn zombie regular rõ ràng.

### Unit types (from `GARRISON_PROFILES`):
| Type | HP | DPS | Speed | Range | Radius | GlowColor | Attack mechanism |
|------|----|-----|-------|-------|--------|-----------|-----------------|
| soldier | 80 | 15 | 140 | 120 | 20 | `#4488FF` | Burst 3× (đạn đôi ±6°, `isExplosive`, splash 40px) |
| heavy | 220 | 28 | 80 | 70 | 30 | `#FF8820` | Stomp AOE 80px tại self, slow 0.5 |
| medic | 60 | 0 | 120 | 110 | 16 | `#44FF88` | Heal aura; không tấn công |
| titan | 500 | 65 | 50 | 80 | 42 | `#BB44FF` | Wind-up 0.4s → stomp AOE 120px |

`GarrisonProfile` có thêm field **`glowColor: string`** so với trước.

### Animation state fields (trên GarrisonUnit):
- **`attackFlashTimer`** — >0 = tăng shadowBlur khi render (glow burst khi tấn công)
- **`stompPulseTimer / stompPulseMax`** — expanding shockwave ring sau stomp (Heavy & Titan)
- **`titanWindupTimer / titanWindupActive / titanWindupMax`** — scale shrink 0.75× trong 0.4s trước khi Titan stomp
- **`healAuraTimer`** — tích lũy theo thời gian, dùng `sin(healAuraTimer * N)` để pulse aura Medic

### Pending output fields (consumed by Game.ts mỗi frame):
- **`pendingSoldierBullets: PendingSoldierBullet[]`** — Game.ts spawn 2 Bullet (`isExplosive`) per entry; cleared sau khi consume
- **`pendingStompSplash: PendingStompSplash | null`** — AOE damage + slow; `isPrimary=true` cho Titan (primary target nhận full, còn lại 60%)
- **`pendingHealParticle: { x, y } | null`** — Game.ts gọi `effects.spawnHealParticles()` tại vị trí target
- **`titanSplashPending`** — legacy field, luôn bị nullify ngay sau update (thay thế bởi `pendingStompSplash`)

### Soldier attack — burst mode:
- Khi `attackCooldown` hết: set `burstQueue = {remaining:3, intervalTimer:0, angle}`
- Mỗi 0.04s trong burst: push 1 `PendingSoldierBullet` vào `pendingSoldierBullets[]`
- Game.ts spawn 2 Bullet mỗi entry (angle ± 0.105 rad), `weaponClass = 'soldierDrone'` (cyan streak)

### Titan attack — wind-up flow:
- Target trong range + `attackCooldown <= 0` + chưa winding: set `titanWindupActive = true`, `titanWindupTimer = 0.4`
- Khi timer hết: fire `pendingStompSplash`, reset cooldown `1/attackRate`, set `stompPulseTimer`

### Rendering (`renderGarrisonUnits()` trong Game.ts):
- **2 save/restore riêng**: body (rotate+scale) và ring+HP bar (chỉ translate) — tránh ring bị rotate theo unit
- **Soldier**: tam giác sắc + 2 wing nub + cockpit dot sáng ở giữa; xoay theo `u.angle`
- **Heavy**: ngũ giác + 5 bolt circles ở góc + inner panel; xoay theo `u.angle`
- **Medic**: circle + cross sáng; aura ring pulsing `alpha = 0.28 + 0.18*sin(healAuraTimer*4)` ngay cả khi không tấn công
- **Titan**: hexagon + spoke lines + inner hex + center core; wind-up scale `1.0 - 0.25*windupPct`; stomp scale `1.0 + 0.28*pulsePct`
- Shockwave ring: `r * (1.5 + progress * 3.5)`, alpha fade, glow color khớp unit

### Emergency Respawn flow:
- When unit dies + `emergencyRespawnEnabled`: set `respawnTimer = 10`, `hasRespawned = true`
- Game.ts counts down respawnTimer; at 0: restores unit to 50% HP, `alive = true`

---

## Các Pattern Quan Trọng

1. **UI updates:** Tất cả UI là DOM innerHTML — không có Virtual DOM. Update bằng cách set `innerHTML` hoặc `textContent` trực tiếp.

2. **Resource spending:** Luôn dùng `game.resources.spend({...})` — trả về `false` nếu không đủ tiền, không throw.

3. **Tower placement:** Luôn qua `game.placeTower()` — có validation territory + resource check.

4. **Skill application:** Player skills qua `player.applyLevelUpSkill(id)`, base skills qua `base.applyBaseSkill(id)`.

5. **Ammo per slot:** Mỗi `WeaponSlot` lưu `ammoInMag` và `reserveAmmo` riêng — đổi vũ khí không mất đạn.

6. **Effects:** Không render trực tiếp trong entity — gọi `game.effects.spawnXxx()` hoặc truyền `effects` ref.

7. **Skill rolling:** Luôn dùng `skills.rollPlayerOptions()` / `skills.rollBaseOptions()` — không shuffle PLAYER_SKILL_POOL/BASE_SKILL_POOL thủ công, để đảm bảo rarity weights và wave gate được áp dụng.

8. **Kill tracking:** Tất cả zombie kills đi qua `game.onZombieDead()` — đây là điểm duy nhất gọi `player.onKill()`, spawn drops, và add XP. Không increment `player.kills` trực tiếp ở nơi khác.

9. **Zombie slow/stun:** `slowFactor` reset về 0 mỗi frame trong `Zombie.update()` — HomeBase phải re-apply mỗi frame trong `applyAura()`. `stunTimer > 0` bỏ qua toàn bộ movement và attack.

10. **Tower aura buffs:** `auraDamageBonus` và `auraRangeBonus` trên Tower được set mỗi frame bởi `base.applyAura()` — reset về 0 khi tower ra ngoài aura radius.

11. **Tower tech upgrade flags:** `fireTowerOverdriveActive`, `electricOverloadActive`, `machineGunOverdriveActive`, `fireTowerInfernoActive`, `electricEMPActive`, `machineGunAPActive`, `neuralNetworkActive` — set each frame by `base.applyAura()` for towers in aura; Tower reads these in update methods.

12. **Base Skill Tree:** `BASE_SKILL_TREE_MAP` (from `baseSkillTree.ts`) is the single source of truth for all 47 base skills. `applyBaseSkill(id)` on HomeBase calls `node.apply(this)` from the tree map. `BaseSkillTreeModal` handles display + unlock logic. Canvas 2400×1800, root `baseCore` at (1200,700), drag-to-pan via `transform:translate()`, bezier curve edges via SVG `<path>`.

14. **BaseSkillTreeModal node states:** `owned` = pulsing glow ring (CSS `@keyframes bst-owned-pulse`) + stronger `box-shadow` with halo; `unlockable` = bright border + glow; `prereqMet but can't afford` = dim border; `locked` = fully dimmed. No tick/check badge — owned state is indicated solely by glow. `baseCore` is auto-applied in `show()` before rendering so all branch gateways become unlockable immediately.

13. **Garrison unit outputs:** GarrisonUnit không tự apply damage hay effects — thay vào đó set pending fields (`pendingSoldierBullets`, `pendingStompSplash`, `pendingHealParticle`) được Game.ts consume mỗi frame. Zombie damage to garrison units uses `z.damage * dt` (continuous DPS). `titanSplashPending` là legacy field — luôn bị nullify, dùng `pendingStompSplash` thay thế.

15. **Zombie tier progression:** Tier của zombie thường được roll tại Spawner theo wave/boss milestones; boss luôn tier 0 trong game logic. Mọi scaling stat/size/xp theo tier đi qua `ZOMBIE_TIER_SCALING` + constructor `Zombie` để giữ behavior tập trung và dễ tune.

16. **Zombie attack flow (wind-up):** Attack không apply damage ngay — `handleAttack()` trong Zombie.ts set `windupActive=true` khi `attackCooldown <= 0`, đếm ngược `windupTimer`, rồi apply damage + gọi `game.spawnZombieSlash()` khi timer hết. Không bypass wind-up ở bất kỳ đâu; combo counter tăng sau mỗi strike.

17. **Zombie rendering — composite system:** Không dùng `_drawZombieXxx` helpers nữa. Luôn đi qua `SKELETON_FACTORIES[archetype](radius, tier)` → `drawZombieComposite()`. Boss visual tier tính từ `waveManager.waveIndex` tại render time, không lưu trên entity. Skeleton được tạo mới mỗi frame (lightweight factory, không cache).

18. **Slash effects:** `effects.spawnZombieSlash()` tạo `SlashEffect` gồm các straight-line strokes (`isCrack=true`) chạy vuông góc với hướng tấn công (`perp = fromAngle + PI/2`), spaced 8px dọc theo `fromAngle`. Render trong `effects.renderWorld()` cùng pass với lightning. Mỗi slash có 3 phases: impact flash → sweep-in animation → staggered fade. Không dùng arc geometry cho slash marks — luôn dùng `isCrack` straight-line strokes. Fan sparks (directional, không random) + 3 white core sparks spawn cùng lúc.

Your code will be reviewed by Codex after you finished.