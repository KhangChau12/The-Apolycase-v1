# UI/UX Full Polish Plan — v1 (Implemented)

> Reference document for future update passes. Describes every decision made during the first full visual overhaul of Zombie Apolycase.

---

## Context

The game was at prototype stage: functionally complete but visually rough — black background, Courier New monospace, flat colors, minimal feedback. This pass was a full redesign of all visual surfaces without touching gameplay logic.

**Goals:**
- Apply a coherent visual identity across every screen
- Redesign the HUD layout from scattered elements to a cinematic bottom bar
- Introduce a real effects layer (hit sparks, blood splatter, screen flashes)
- Upgrade every overlay and menu to use the new palette and font

---

## Visual Identity

### Tone
Industrial machine meets bloody horror. Light background (not dark), heavy machinery aesthetic, rust and blood as accent language.

### Palette

| Token | Hex | Usage |
|---|---|---|
| `bg` | `#D4C5B0` | World fill, warm light grey |
| `text` | `#2C2416` | Primary dark text |
| `rust` | `#8B3A2A` | Borders, territory ring, world edge |
| `orange` | `#C4622D` | Burnt orange accent, tower stroke (guard) |
| `amber` | `#E8A030` | Warning, wave announce, player stroke, HP mid |
| `blood` | `#CC1A1A` | Danger, boss, damage flash, game over |
| `iron` | `#7A7060` | Secondary text, disabled state |
| `ember` | `#FF6B35` | Bullets, hit sparks, hot glow |
| `gold` | `#E8C84A` | Coins resource |
| `ironGrey` | `#A89880` | Iron resource |
| `coreBlue` | `#7788FF` | Energy core resource |
| `crystalCyan` | `#88EEFF` | Crystal resource, skill modal accent |
| `hpHigh` | `#4CAF50` | HP bar above 50% |
| `hpMid` | `#E8A030` | HP bar 25–50% |
| `hpLow` | `#CC1A1A` | HP bar below 25% |

All colors live in `src/ui/theme.ts` as the `T` object. Every UI file imports from there — no inline color literals.

### Font

**Russo One** (Google Fonts) — blocky, industrial, aggressive. Loaded via `<link>` in `index.html`, applied as `font-family` default on `#hud`. Canvas text uses `T.font = "'Russo One', sans-serif"`.

`document.fonts.ready.then(...)` in `main.ts` ensures Russo One is loaded before canvas text rendering begins.

---

## Architecture Notes

- `#hud` is a plain `<div>` — all HUD elements are DOM, not canvas.
- `Game.ts` renders to `<canvas id="game-canvas">` only (world, minimap, build preview).
- `BreakPanel`, `GameOverScreen`, `SkillSelectModal`, `TutorialOverlay` are DOM overlays.
- `BuildContextMenu`, `TowerInspectMenu` are absolutely-positioned DOM `<div>` elements.
- Particles are Canvas 2D, managed by `EffectsManager`, rendered on the game canvas.

---

## Phase 0 — Foundation

**Files:** `src/ui/theme.ts` (new), `index.html`, `src/main.ts`

- Created `src/ui/theme.ts` — single source of truth for all colors, font, and helper functions (`T.hpColor()`, `T.panelBg()`).
- `index.html`: added Russo One via Google Fonts, `:root` CSS custom properties, global keyframe animations, scrollbar styling, break panel CSS, game over CSS, wave announce CSS.
- `src/main.ts`: wrapped `new Game(canvas)` inside `document.fonts.ready.then(...)`.
- Body background changed from `#0a0a0a` → `#C8B8A0`.

---

## Phase 1 — HUD Redesign (Cinematic Bottom Bar)

**File:** `src/ui/HUD.ts`

### Old layout
- Top-left: wave counter, player HP, base HP
- Top-right: resource card + UPGRADES button (below minimap)
- Top-center: break countdown bar
- Bottom: resource pill + weapon slot + skill slots + level pill

### New layout
Full-width 90px bar pinned to `bottom: 0`, `left: 0`, `right: 0`. CSS grid with 5 columns:

| Column | Width | Content |
|---|---|---|
| Vitals | 180px | Player HP bar + Base HP bar, left border `3px solid rust` |
| Wave info | 1fr | Wave number (32px Russo One), zombie count, break timer |
| Weapon | 130px | Weapon slot 54×54px, ammo, reload bar |
| Skills | auto | Skill slot icons 44×44px |
| Level/XP/Resources | auto | Level label, XP bar, 4 resource values |

**Additional elements:**
- `#hud-break-fill-strip`: 3px gradient strip at top edge of bar, visible during break phase only
- `#hud-wave-announce`: absolutely positioned center-screen, shows "WAVE N" or "BOSS WAVE" with CSS animation (`waveAnnounce` 2.5s / `waveClear` 1.8s)
- `#hud-boss-warning`: full-screen inset box-shadow pulsing red when boss wave active

**New public methods on HUD:**
- `triggerWaveAnnounce(waveNum, isBoss)` — restarts the CSS animation by removing/re-adding the class after a forced reflow
- `triggerWaveClear(waveNum)` — shows "WAVE N CLEAR" in green with the `clearing` animation
- `triggerLevelUp()` — flashes level label with `level-flash` CSS class for 1.5s

**Performance:** `update()` only writes `.textContent` and `.style` — never rebuilds `.innerHTML` in the hot path (only on skill slot count change).

---

## Phase 2 — Visual Effects Overhaul

**Files:** `src/effects/EffectsManager.ts` (new), `src/effects/Particle.ts` (extended)

### Particle.ts changes
Added optional `ParticleOptions` 5th constructor argument: `dirAngle`, `spread`, `gravity`, `sizeDecay`, `life`. Backward compatible — existing call sites with no options still work identically.

### EffectsManager.ts
Centralized effects dispatcher, replacing the old inline `spawnHitParticles` / `spawnDeathParticles` in `Game.ts`.

| Method | Description |
|---|---|
| `spawnHitSpark(x, y, hitAngle)` | 6 ember (#FF6B35) directional sparks on bullet hit |
| `spawnBloodSplatter(x, y, killAngle, archetype)` | Count scaled by archetype (8–40), directional red spray with gravity |
| `spawnRadialBurst(x, y)` | 20+10 amber/ember particles in a perfect outward ring (used for boss death) |
| `triggerDamageFlash()` | Full-screen red tint, alpha 0.35, decays at 1.8/s |
| `triggerExplosionFlash()` | Full-screen orange tint, alpha 0.25 |
| `renderWorld(ctx)` | Draw particles in world space (inside camera transform) |
| `renderScreen(ctx, w, h)` | Draw screen flash in screen space (after camera restore) |

Particle cap: 400 max, oldest spliced if exceeded.

### Game.ts integration
- `hitAngle` derived from `b.angle` (getter added to `Bullet.ts` returning `Math.atan2(vy, vx)`)
- Player damage detection: compare `player.invincibleTimer` before/after `player.update()` — if it increased, damage was dealt
- `onZombieDead(z, killAngle)` now accepts kill angle; also detects level-up via pre/post level compare
- Boss wave clear triggers `triggerExplosionFlash()`
- Old `this.particles: Particle[]` array removed; `Particle` import removed from `Game.ts`

---

## Phase 3 — World & Entity Visuals

**File:** `src/core/Game.ts` (all canvas rendering methods)

### World
- Background: `#D4C5B0` (warm grey fill before grid)
- Grid lines: `rgba(44,36,22,0.07)` (very subtle)
- World border: `#8B3A2A` lineWidth 5
- Territory circle fill: `rgba(139,58,42,0.04)`, stroke `rgba(196,98,45,0.35)`, dashes `[10,8]`

### HomeBase
- Fill: `#1a0e06`, stroke: `T.hpColor(pct)` lineWidth 4
- HP bar bg: `rgba(44,36,22,0.6)`
- Aura glow: amber (`rgba(232,160,48,pulse)`) — previously blue

### Towers (styleMap)

| Type | Fill | Stroke | Icon drawn |
|---|---|---|---|
| guard | `#1a100a` | `#C4622D` | Crosshair (lines + small circle) |
| barricade | `#2a1a0a` | `#8B3A2A` | Three horizontal bars |
| shockPylon | `#0a0e1a` | `#7788FF` | Lightning bolt path |
| sniperPost | `#1a0e00` | `#E8A030` | Long horizontal line + notch |
| repairNode | `#0a1810` | `#4CAF50` | Plus sign |

- Level ≥ 2: `shadowColor = stroke`, `shadowBlur = 8 + 4 * sin(t/400)` (pulsing glow)
- HP bar bg: `rgba(44,36,22,0.7)`, fill: `T.hpColor(pct)`

### Zombies

| Archetype | Fill | Stroke |
|---|---|---|
| regular | `#3a1a0a` | `#8B3A2A` |
| fast | `#1a2a10` | `#4CAF50` |
| tank | `#2a1010` | `#CC1A1A` |
| armored | `#1a1a2a` | `#7A7060` |
| boss | `#1a0000` | `#CC1A1A` (lineWidth 4, shadowBlur 16) |

Boss: outer pulsing ring + "BOSS" label above.

### Player
- Body fill: `#1a1008`, stroke: `#E8A030`
- Gun barrel: `#FF6B35`
- Invincibility flash: amber `rgba(232,160,48,0.7)` instead of white

### Bullets
- Color: `#FF6B35` (ember)
- Trailing dot: `rgba(255,107,53,0.35)` at 4px behind

### Drops
- Colors updated to palette tokens; pulsing `shadowBlur = 4 + 2*sin(t/300)`

### Minimap
- Bg: `rgba(28,20,12,0.88)`, border: `#8B3A2A` 2px
- Base: `#E8A030`, towers: `#C4622D`, zombies: `#CC1A1A`, player: `#D4C5B0`
- "MAP" label top-left in `#7A7060`

---

## Phase 4 — Break Panel (Slide-in from Right)

**Files:** `src/ui/BreakPanel.ts`, `index.html`

`#break-panel` removed from `.overlay` class behavior. Now uses:
- `position: fixed; right: 0; width: 400px; transform: translateX(100%); transition: 0.28s`
- `.panel-open` class triggers `translateX(0)` — slide in
- `.panel-hidden` class is `display: none` (for fully hidden state, avoiding transition issues)

**show() / hide() pattern:**
```
show(): remove panel-hidden → requestAnimationFrame → add panel-open
hide(): remove panel-open → setTimeout(290ms) → add panel-hidden
```
The `requestAnimationFrame` delay is required so the browser renders the element before the transition-triggering class is applied.

**Panel structure** (single-column scroll):
- Sticky header: title "SUPPLY DEPOT" / "UPGRADES", break timer, resource readout
- Sections: CHARACTER (orange accent), SUPPLIES (amber), WEAPONS (amber), BUILD TOWERS (green), TERRITORY (cyan)
- Sticky footer: full-width CLOSE/SKIP button in rust red
- Left panel edge shadow via `::before` pseudo-element

World stays visible on the left ~60% of the screen.

---

## Phase 5 — Game Over Screen

**File:** `src/ui/GameOverScreen.ts`

- Container: `rgba(20,12,8,0.96)`, border `2px solid #CC1A1A`
- `.go-title` class: `goTitleIn` animation (scale crush in) + `goPulse` infinite
- Stats: `.go-stat` class with staggered `animation-delay` (0.2s, 0.4s, 0.6s, 0.8s)
- Kill count and score: `animateCountUp()` — ease-out cubic `requestAnimationFrame` loop
- Restart button: rust background, blood border
- `backdrop-filter: blur(4px)` on the overlay

---

## Phase 6 — Context Menus & Modals

All menus share: `background: rgba(20,14,8,0.96)`, `border: 1px solid #8B3A2A`, `box-shadow: 0 8px 32px rgba(0,0,0,0.8)`.

### BuildContextMenu
- Available buttons: `border-left: 3px solid #C4622D`, name in amber
- Disabled: `border-left: 3px solid #2a1a0a`, text iron grey

### TowerInspectMenu
- `border-left: 3px solid [typeAccent]` — each tower type has its own accent color
- HP bar uses `T.hpColor(pct)`
- UPGRADE button: green tones; SELL button: rust/blood tones
- MAX LEVEL badge: amber bordered

### SkillSelectModal
- Title: `#88EEFF` with text-shadow glow
- Cards: dark blue-grey background, CSS class `skill-choice` with hover `translateY(-2px)` and border highlight

### TutorialOverlay
- `border-top: 3px solid [pageColor]` — each page has its own accent
- Body text: `#D4C5B0` (warm white), page counter in iron grey
- Navigation buttons: Russo One, rust/orange backgrounds

---

## Phase 7 — Wave Transitions

**File:** `src/core/Game.ts`

- `startWave()` calls `this.hud.triggerWaveAnnounce(waveIndex, isBossWave)` and `this.shake(6, 0.5)` on boss waves
- Wave-clear check calls `this.hud.triggerWaveClear(waveIndex)` before `enterBreak()`

---

## Phase 8 — Canvas Font Polish

**File:** `src/core/Game.ts`

- All `ctx.font` calls updated to `T.font` (Russo One)
- Build hint bar: full-width, right-aligned, text drawn above bottom HUD bar; orange accent line when in build mode

---

## Implementation Order

```
Phase 0 (theme.ts, index.html, main.ts)
  ↓
Phase 3 (world canvas visuals) — biggest instant payoff
  ↓
Phase 1 (HUD bottom bar)
  ↓
Phase 2 (EffectsManager)
  ↓
Phase 4 (BreakPanel slide-in)
  ↓
Phase 5 (GameOverScreen)
  ↓
Phase 6 (menus + modals)
  ↓
Phase 7 (wave transitions — depends on Phase 1 HUD methods)
  ↓
Phase 8 (canvas font polish)
```

---

## Files Changed

| File | Change Type |
|---|---|
| `src/ui/theme.ts` | **New** — palette + helper functions |
| `src/effects/EffectsManager.ts` | **New** — centralized effects |
| `src/effects/Particle.ts` | Extended with `ParticleOptions` |
| `src/entities/Bullet.ts` | Added `angle` getter |
| `src/core/Game.ts` | Canvas palette, effects integration, wave triggers |
| `src/ui/HUD.ts` | Full template rewrite — cinematic bottom bar |
| `src/ui/BreakPanel.ts` | Slide-in panel, palette styling |
| `src/ui/GameOverScreen.ts` | Animated redesign |
| `src/ui/BuildContextMenu.ts` | Palette update |
| `src/ui/TowerInspectMenu.ts` | Palette + per-type accents |
| `src/ui/SkillSelectModal.ts` | Crystal palette, hover effects |
| `src/ui/TutorialOverlay.ts` | Per-page accent colors, Russo One |
| `index.html` | Google Fonts, CSS vars, keyframes, break panel CSS |
| `src/main.ts` | `document.fonts.ready.then(...)` wrap |

---

## Known Limitations / Follow-up Opportunities

- **Audio system**: entirely absent — no sound effects or music. A future pass should add an `AudioManager` with at minimum: gunshot, zombie death, boss roar, wave clear, UI click.
- **Save/Load**: `src/utils/saveLoad.ts` exists but is not wired up. Auto-save after break phase would significantly improve retention.
- **Skills not fully wired**: skill definitions exist and are shown in HUD, but most passive effects (Adrenaline Burst, Overcharge, etc.) are not implemented in gameplay logic.
- **Mobile**: no touch input support.
- **HUD on small screens**: bottom bar may overflow at < 600px width. Not addressed in this pass.
- **Resource icon symbols** (¢, ⬡, ◈, ✦): Russo One may not include all glyphs — verify on target devices and fallback to text labels if needed.
