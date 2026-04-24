# Graph Report - D:\Khang\The Noders PTNK\Product\Side project\Zombie Apolycase\graphify-out  (2026-04-24)

## Corpus Check
- Corpus is ~10,540 words - fits in a single context window. You may not need a graph.

## Summary
- 244 nodes · 337 edges · 17 communities detected
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 63 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]

## God Nodes (most connected - your core abstractions)
1. `Game` - 31 edges
2. `Player` - 14 edges
3. `Tower` - 12 edges
4. `Design Principles` - 10 edges
5. `dist()` - 9 edges
6. `HUD` - 8 edges
7. `Camera` - 7 edges
8. `HomeBase` - 7 edges
9. `Zombie` - 7 edges
10. `WaveManager` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Break Phase` --opens--> `Build Mode UI`  [EXTRACTED]
  docs/game-feature-overview.md → docs/ui-design-system.md
- `In-Game HUD` --displays_state_for--> `Wave System`  [EXTRACTED]
  docs/ui-design-system.md → docs/game-feature-overview.md
- `Modals & Overlays` --surfaces_during--> `Break Phase`  [EXTRACTED]
  docs/ui-design-system.md → docs/game-feature-overview.md
- `Modals & Overlays` --surfaces_during--> `Territory Expansion System`  [EXTRACTED]
  docs/ui-design-system.md → docs/game-feature-overview.md
- `Modals & Overlays` --surfaces_for--> `Special Skill System`  [EXTRACTED]
  docs/ui-design-system.md → docs/game-feature-overview.md

## Communities

### Community 0 - "Community 0"
Cohesion: 0.0
Nodes (33): Barricade, Boss Wave, Break Phase, Build Mode UI, Color and Contrast, Component Consistency, Core Loop, Crystal (+25 more)

### Community 1 - "Community 1"
Cohesion: 0.0
Nodes (7): angleTo(), clamp(), dist(), lerp(), randInt(), Tower, Zombie

### Community 2 - "Community 2"
Cohesion: 0.0
Nodes (5): BreakPanel, btnStyle(), BuildContextMenu, GameOverScreen, SkillSelectModal

### Community 3 - "Community 3"
Cohesion: 0.0
Nodes (1): Game

### Community 4 - "Community 4"
Cohesion: 0.0
Nodes (2): InputManager, Player

### Community 5 - "Community 5"
Cohesion: 0.0
Nodes (3): ResourceManager, SkillManager, TerritoryManager

### Community 6 - "Community 6"
Cohesion: 0.0
Nodes (1): HomeBase

### Community 7 - "Community 7"
Cohesion: 0.0
Nodes (3): spawnWave(), waveConfig(), WaveManager

### Community 8 - "Community 8"
Cohesion: 0.0
Nodes (1): HUD

### Community 9 - "Community 9"
Cohesion: 0.0
Nodes (1): Camera

### Community 10 - "Community 10"
Cohesion: 0.0
Nodes (2): btnStyle(), TutorialOverlay

### Community 11 - "Community 11"
Cohesion: 0.0
Nodes (6): Armored Zombie, Boss Zombie, Fast Zombie, Regular Zombie, Tank Zombie, Zombie System

### Community 12 - "Community 12"
Cohesion: 0.0
Nodes (1): Particle

### Community 13 - "Community 13"
Cohesion: 0.0
Nodes (1): Bullet

### Community 14 - "Community 14"
Cohesion: 0.0
Nodes (1): DropItem

### Community 15 - "Community 15"
Cohesion: 0.0
Nodes (3): clearSave(), loadGame(), saveGame()

### Community 16 - "Community 16"
Cohesion: 0.0
Nodes (1): ShopModal

## Knowledge Gaps
- **21 isolated node(s):** `Game Feature Overview`, `UI Design System Guideline`, `Map Structure`, `Guard Tower`, `Barricade` (+16 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 3`** (26 nodes): `Game.ts`, `Game`, `.bindCanvasEvents()`, `.constructor()`, `.exitBreak()`, `.loop()`, `.onZombieDead()`, `.render()`, `.renderBuildHint()`, `.renderBuildPreview()`, `.renderBullets()`, `.renderDrops()`, `.renderMinimap()`, `.renderParticles()`, `.renderPlayer()`, `.renderTowers()`, `.renderWorld()`, `.renderZombies()`, `.resizeCanvas()`, `.skipBreak()`, `.spawnDeathParticles()`, `.start()`, `.stop()`, `.addXp()`, `Game.ts`, `.hide()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 4`** (21 nodes): `.toWorld()`, `InputManager.ts`, `Player.ts`, `InputManager`, `.constructor()`, `.isDown()`, `Player`, `.calcDamage()`, `.constructor()`, `.equipWeapon()`, `.finishReload()`, `.move()`, `.startReload()`, `.takeDamage()`, `.update()`, `.updateAim()`, `.updateFire()`, `.updateReload()`, `.has()`, `InputManager.ts`, `Player.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 6`** (14 nodes): `HomeBase.ts`, `.enterBreak()`, `.spawnHitParticles()`, `.tryPickupDrops()`, `.update()`, `HomeBase`, `.applyAura()`, `.constructor()`, `.isDead()`, `.takeDamage()`, `.update()`, `.showMessage()`, `.show()`, `HomeBase.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (8 nodes): `HUD.ts`, `HUD`, `.barHTML()`, `.constructor()`, `.template()`, `.update()`, `.updateMessages()`, `HUD.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (7 nodes): `Camera`, `.constructor()`, `.follow()`, `.resize()`, `.toScreen()`, `Camera.ts`, `Camera.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (6 nodes): `TutorialOverlay.ts`, `TutorialOverlay.ts`, `btnStyle()`, `TutorialOverlay`, `.constructor()`, `.render()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (5 nodes): `Particle.ts`, `Particle`, `.constructor()`, `.update()`, `Particle.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (5 nodes): `Bullet`, `.constructor()`, `.update()`, `Bullet.ts`, `Bullet.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (5 nodes): `DropItem.ts`, `DropItem`, `.constructor()`, `.update()`, `DropItem.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (3 nodes): `ShopModal.ts`, `ShopModal`, `ShopModal.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.