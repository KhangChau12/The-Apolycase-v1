# UI Design System Guideline

This document has two parts:
- **Part A** — Reusable guidelines that apply to any game or interactive project.
- **Part B** — Zombie Apolycase implementation: the specific tokens, patterns, and conventions locked in during the v1 polish pass. Use this as the authoritative reference before making visual changes to the game.

---

# Part A — Reusable Guidelines

## 1) Design Principles (Mandatory)

- Readability first in every state (idle, combat, popup, low HP, high VFX).
- Consistency before decoration.
- Information hierarchy must be obvious in under 2 seconds.
- Visual style must look production-ready, not prototype-like.

## 2) Strict Professional Rules

- UI must feel professional and coherent across all screens.
- Do not insert childish text emoji directly in labels, buttons, tooltips, or notifications.
- Prefer icon assets from a library instead of raw emoji characters.
- Prefer illustration/image assets from trusted libraries instead of ad-hoc copied images.
- Every icon set must come from the same visual family (weight, stroke, corner style).
- If one surface uses outlined icons and another uses filled icons, define explicit semantic rules.

## 3) Approved Asset Sources

### Icon libraries (recommended)

- Lucide
- Heroicons
- Phosphor Icons
- Font Awesome (with consistent style selection)

### Image/illustration libraries (recommended)

- unDraw (for neutral illustrations)
- Storyset (for themed vector scenes)
- Icons8 Ouch or equivalent licensed packs
- Project-owned curated packs in `/assets`

### Asset usage rules

- Verify license compatibility before importing.
- Store assets in a versioned local folder (`/assets/icons`, `/assets/images`).
- Avoid hotlinking to random CDN URLs in production UI.

## 4) Spacing System

Use one global spacing scale only:

- 4px
- 8px
- 12px
- 16px
- 24px
- 32px

Rules:

- No one-off spacing unless there is a documented exception.
- Align related components to a shared grid.
- Keep vertical rhythm stable inside cards, panels, and modal bodies.

## 5) Typography System

Define and lock 3 text tiers:

- Tier A: critical values and urgent states.
- Tier B: section headers and actionable labels.
- Tier C: helper text and support metadata.

Rules:

- Keep font family count small (1 display family + 1 UI/body family max).
- Avoid excessive letter-spacing on small text.
- Numeric data must remain the easiest content to scan.
- Min size for non-decorative readable text: 12px.

## 6) Color and Contrast

- Semantic colors must be fixed and documented (danger, warning, success, neutral, focus).
- Maintain sufficient contrast for all key text and controls.
- Glow/shadow is state-driven, not decorative by default.
- Do not use more than one accent strategy per screen.

## 7) Component Consistency

- Use one border radius scale.
- Use one border style language.
- Buttons, badges, chips, and cards must follow shared token rules.
- Modal, tooltip, notification, and toast should share structural patterns.

## 8) Information Hierarchy

Every gameplay screen should preserve this reading order:

1. Survival-critical data.
2. Immediate action data.
3. Objective/progress context.
4. Secondary tools.
5. Flavor or ambient text.

Any element that breaks this order must be reduced or repositioned.

## 9) UX Behavior Standards

- UI feedback latency target: under 100ms for local interactions.
- Hover/focus/active/disabled states are mandatory for interactive controls.
- Notification stack must not block critical gameplay information.
- Mobile and desktop layouts must preserve the same semantic hierarchy.

## 10) Definition Of Done For UI

- Passes spacing and typography token checks.
- No childish emoji text in production UI.
- Icons and images come from approved libraries or project-owned packs.
- No mixed visual language across core surfaces.
- Usability remains stable under stress conditions (combat-heavy scenes).

---

# Part B — Zombie Apolycase Design System (v1)

> Locked during the first full visual overhaul. Every decision here is already implemented. Do not change any token, pattern, or layout rule in isolation — update this document alongside the code.

---

## B.1 — Visual Identity

**Tone:** Industrial machine meets bloody horror. Light warm background — not dark. Machinery and rust as the primary visual language; blood red used sparingly as danger signal only.

**Single font:** **Russo One** (Google Fonts) — blocky, industrial, aggressive. Used everywhere: HUD, canvas labels, menus, buttons. Loaded via `<link>` in `index.html`. Canvas text waits for load via `document.fonts.ready.then(...)` in `src/main.ts`.

```
T.font = "'Russo One', sans-serif"
```

---

## B.2 — Color Palette

All tokens live in `src/ui/theme.ts` as the `T` object. **Never use inline color literals** — always import from `T`.

| Token | Hex | Role |
|---|---|---|
| `T.bg` | `#D4C5B0` | World fill, base UI tone, warm light grey |
| `T.text` | `#2C2416` | Primary dark text |
| `T.rust` | `#8B3A2A` | Borders, world edge, territory ring stroke |
| `T.orange` | `#C4622D` | Burnt orange accent, guard tower stroke, section headers |
| `T.amber` | `#E8A030` | Warning, wave announce, player stroke, HP mid |
| `T.blood` | `#CC1A1A` | Danger, boss, damage flash, game over |
| `T.iron` | `#7A7060` | Secondary text, disabled state, minimap label |
| `T.ember` | `#FF6B35` | Bullets, hit sparks, hot glow, gun barrel |
| `T.gold` | `#E8C84A` | Coins resource |
| `T.ironGrey` | `#A89880` | Iron resource |
| `T.coreBlue` | `#7788FF` | Energy core resource, shockPylon stroke |
| `T.crystalCyan` | `#88EEFF` | Crystal resource, skill modal accent |
| `T.hpHigh` | `#4CAF50` | HP bar above 50% |
| `T.hpMid` | `#E8A030` | HP bar 25–50% |
| `T.hpLow` | `#CC1A1A` | HP bar below 25% |

**Helper functions on `T`:**
- `T.hpColor(pct: number)` — returns `hpHigh` / `hpMid` / `hpLow` based on `pct`
- `T.panelBg(alpha?)` — `rgba(20,12,8,alpha)` — standard panel background

**Body / chrome:** `#C8B8A0` (slightly darker warm grey for the page body outside the canvas).

---

## B.3 — Spacing & Border Rules

- **Border radius:** 2–3px maximum. Sharp corners preferred — matches industrial aesthetic. Never use 8px+ radius on game UI elements.
- **Left-border accent pattern:** Panels, buttons, and section headers use `border-left: 3px solid [accent]` as the primary accent signal. This is the project's signature decoration pattern.
- **Section header style:** `font: bold 11px T.font; letter-spacing: 2px; border-bottom: 1px solid [accent]33; text-transform: uppercase`
- **Panel container baseline:**
  ```css
  background: rgba(20,14,8,0.96);
  border: 1px solid #8B3A2A;
  box-shadow: 0 8px 32px rgba(0,0,0,0.8);
  border-radius: 3px;
  ```

---

## B.4 — HP Bar Thresholds

The same thresholds apply to every HP bar in the game (player, base, towers, zombies):

| Threshold | Color |
|---|---|
| > 50% | `#4CAF50` (green) |
| 25–50% | `#E8A030` (amber) |
| < 25% | `#CC1A1A` (blood red) |

Always computed via `T.hpColor(pct)`.

HP bar structure: bg `rgba(44,36,22,0.7)`, height 4–6px, border-radius 2px.

---

## B.5 — Architecture: Rendering Surfaces

| Surface | Technology | Controlled by |
|---|---|---|
| Game world, entities, minimap | Canvas 2D (`#game-canvas`) | `Game.ts` |
| HUD elements | DOM (`#hud` div) | `HUD.ts` |
| Break panel | DOM overlay (slide-in from right) | `BreakPanel.ts` |
| Game over, skill modal, tutorial | DOM overlays | `GameOverScreen.ts`, `SkillSelectModal.ts`, `TutorialOverlay.ts` |
| Build / inspect context menus | Absolutely positioned DOM divs | `BuildContextMenu.ts`, `TowerInspectMenu.ts` |
| Particles / screen flash | Canvas 2D (world + screen space) | `EffectsManager.ts` |

**Rule:** Never draw HUD elements to canvas. Never render world entities to DOM.

---

## B.6 — HUD Layout

Full-width 90px bar pinned to `bottom: 0`. CSS grid: `180px 1fr 130px auto auto`.

| Column | Content |
|---|---|
| Vitals | Player HP bar + Base HP bar; left border `3px solid #8B3A2A` |
| Wave info | Wave number (32px), zombie count, break timer |
| Weapon | Weapon slot 54×54px, ammo, reload bar |
| Skills | Skill slot icons 44×44px |
| Level/XP/Resources | Level, XP bar, 4 resource values |

**Supplementary HUD elements:**
- `#hud-break-fill-strip` — 3px gradient strip at top edge of bar; visible only during break phase
- `#hud-wave-announce` — centered screen text (72px Russo One, amber); CSS animated via `.announcing` / `.clearing` classes
- `#hud-boss-warning` — full-screen inset pulsing box-shadow; active via `.boss-active` class during boss waves

**Hot path rule:** `HUD.update()` only writes `.textContent` and `.style` properties — never reassigns `.innerHTML` except when skill slot count changes.

---

## B.7 — Animation Patterns

### CSS Transition: Slide-in Panel

For any panel that uses `display:none` + CSS transform transition, use this pattern:

```typescript
// show
el.classList.remove('panel-hidden')
requestAnimationFrame(() => el.classList.add('panel-open'))

// hide
el.classList.remove('panel-open')
setTimeout(() => el.classList.add('panel-hidden'), 290)  // matches transition duration
```

**Never use `.hidden` (global class with `display:none !important`) on elements that use CSS transitions** — the `!important` prevents the transition from firing.

### Wave / Level Announcements

```typescript
el.classList.remove('announcing', 'clearing')
void el.offsetWidth  // force reflow to restart animation
el.classList.add('announcing')
el.addEventListener('animationend', () => { el.style.display = 'none' }, { once: true })
```

### Defined Keyframes

| Animation | Used on | Duration |
|---|---|---|
| `waveAnnounce` | `#hud-wave-announce` | 2.5s |
| `waveClear` | `#hud-wave-announce` | 1.8s |
| `bossFlash` | `#hud-boss-warning` | 1s infinite |
| `levelFlash` | level label | 1.5s |
| `goTitleIn` | game over title | 0.6s |
| `goPulse` | game over title | 2s infinite |
| `goStatIn` | game over stats (staggered) | 0.4s |

---

## B.8 — Canvas Rendering Conventions

- **All canvas `ctx.font` calls use `T.font`** (`'Russo One', sans-serif`).
- **Tower icons** are drawn procedurally with Canvas 2D (no image assets): crosshair (guard), 3 horizontal bars (barricade), lightning bolt path (shockPylon), scope line + notch (sniperPost), plus sign (repairNode).
- **Powered tower glow** (level ≥ 2): `ctx.shadowColor = strokeColor; ctx.shadowBlur = 8 + 4 * Math.sin(Date.now()/400)`. Reset after drawing.
- **Bullet trailing dot:** 4px behind bullet position at `rgba(255,107,53,0.35)`.
- **Drop item glow:** `ctx.shadowBlur = 4 + 2 * Math.sin(Date.now()/300)`.
- **Screen flash** is rendered in screen space (after `ctx.restore()`), never inside the camera transform block. Managed by `EffectsManager.renderScreen()`.

---

## B.9 — Effects System

All particles and screen flashes are managed by `src/effects/EffectsManager.ts`.

| Method | Trigger | Output |
|---|---|---|
| `spawnHitSpark(x, y, angle)` | Bullet hits zombie | 6 ember sparks, directional |
| `spawnBloodSplatter(x, y, angle, archetype)` | Zombie killed | 8–40 red particles with gravity |
| `spawnRadialBurst(x, y)` | Boss death | 30 amber/ember particles outward |
| `triggerDamageFlash()` | Player takes damage | Red screen tint, alpha 0.35 |
| `triggerExplosionFlash()` | Boss wave cleared | Orange screen tint, alpha 0.25 |

**Particle cap:** 400 max. Oldest 40 removed when exceeded.

Blood count by archetype: regular=12, fast=8, tank=20, armored=14, boss=40.

---

## B.10 — Tower Type Accents

Each tower type has a designated accent color used consistently in the inspect menu, minimap, and canvas stroke:

| Tower | Accent |
|---|---|
| guard | `#C4622D` (orange) |
| barricade | `#8B3A2A` (rust) |
| shockPylon | `#7788FF` (core blue) |
| sniperPost | `#E8A030` (amber) |
| repairNode | `#4CAF50` (green) |

---

## B.11 — Known Gaps (v1)

These areas were explicitly deferred and should be addressed in future passes:

- **Audio:** No sound system. Minimum additions needed: gunshot, zombie death, boss roar, wave clear, UI click.
- **Save/Load:** `src/utils/saveLoad.ts` exists but is not wired up.
- **Skill effects:** Most passive skill effects (Adrenaline Burst, Overcharge, etc.) are defined but not implemented in gameplay logic.
- **Mobile / touch:** No touch input support.
- **HUD small screen:** Bottom bar may overflow at < 600px viewport width.
- **Resource glyph fallback:** Symbols ¢ ⬡ ◈ ✦ may not render in Russo One on all devices — test and add fallback text labels if needed.
