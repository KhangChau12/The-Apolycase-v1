# Game Feature Overview — Zombie Apolycase: Siege Mode

This document describes all gameplay features as designed for **Siege Mode**, the core game loop. The game is a top-down survival tower defense shooter built with TypeScript, Canvas 2D rendering, and DOM-based UI overlays.

---

## 1) Core Concept & Main Loop

**Genre:** Top-down survival siege defender.

**Main loop:**
1. Wave begins → Zombies attack from all directions toward Home Base.
2. Player shoots zombies, uses tower defense and special skills to hold the line.
3. Boss Zombie appears at wave end.
4. Defeat Boss → earn **Crystal** (primary resource) → expand territory.
5. Between waves: **15-second Break Phase** (skippable) → upgrade base, build towers, purchase items.
6. Repeat with increasing difficulty.

**Frame loop:** Input → Player update → Zombie update → Tower update → Collision/Combat → Effects → Render.

**Real-time systems updated each frame:** Minimap, wave timer, crystal count, territory overlay, particle effects, message queue.

---

## 2) Map Structure

- **Size:** Large world (approximately 3,000 × 3,000 logic units; ~3× viewport).
- **Home Base** — centered on the map; the structure you must defend.
- **Territory** — concentric ring around Home Base; expands outward after each boss defeat.
- **Grid system** — map divided into grid cells; each cell is: walkable, territory-owned, or blocked (obstacle).
- **Spawn points** — 8 fixed spawn locations evenly distributed around map edges.
- **World edge** — rust-colored border; zombies cannot pass the map boundary.

---

## 3) Home Base

- Central defensive structure with **separate HP pool** (e.g., 1000 HP).
- If Home Base HP reaches 0 → **Game Over**.
- Between waves, Home Base slowly regenerates a small amount of HP.
- Player can place towers around the base for defense.
- Base level can be upgraded via Shop to increase max HP and regeneration rate.
- Base generates a **healing aura** within territory — nearby allies (player, towers) regain HP per second.

---

## 4) Wave System

### 4.1) Wave Structure
- Each wave spawns progressively more zombies following a difficulty scale formula.
- Zombies spawn in batches throughout the wave (not all at once).
- Every 5th wave is a **Boss Wave** (waves 5, 10, 15, etc.).

### 4.2) Boss Wave
- After all regular zombies are eliminated, a **Boss Zombie** appears.
- Boss has high HP, large size, and special abilities (charge attack, AOE slam, summon minions).
- Defeating the Boss grants **1 Crystal** (may grant bonus crystal on higher difficulty).
- Boss defeat triggers automatic transition to **Break Phase**.

### 4.3) Break Phase (15 seconds)
- Countdown displayed prominently on HUD.
- Player can: place/upgrade towers, purchase items, expand territory, upgrade character stats.
- **Skip Break** button to start next wave immediately.
- After 15 seconds or Skip, next wave auto-starts.

---

## 5) Territory Expansion System

### 5.1) Crystal Resource
- **Primary use:** Expand territory and unlock special skills.
- **Only source:** Defeat Boss Zombies (1 Crystal per boss wave).
- Displayed on HUD as current count.

### 5.2) Territory Expansion
- During Break Phase, player can spend Crystal to expand territory by one ring.
- Each expansion: increases territory radius by a fixed amount; costs X Crystal (cost increases per expansion).
- Expanded territory allows:
  - Building towers in newly unlocked cells.
  - Extending player buff zones.
  - Pushing spawn points further from Home Base.
- **Expansion Reward:** Each successful expansion grants one **Special Skill Slot** (chosen from 3 random options).

### 5.3) Territory Effects
- **Inside territory:** Player gains buffs (HP regen, +% damage); zombies receive debuffs (movement slow, damage-over-time).
- **Outside territory:** No player buffs; zombies move faster and ignore slow effects.
- **Home Base aura:** Separate from territory ring; always provides healing/defensive benefits within a fixed radius.

---

## 6) Special Skill System

- Each successful territory expansion offers player **3 random skill choices**.
- Player selects 1 skill to unlock; max slots = number of territory expansions completed.
- Skills are **persistent** across waves and are **passive** (always active) unless noted otherwise.

### 6.1) Example Skill Roster
| Skill | Effect |
|---|---|
| **Adrenaline Burst** | After 3 consecutive kills, gain +30% move speed for 3 seconds. |
| **Iron Skin** | After taking damage, gain 1.5 seconds of 50% damage reduction. |
| **Overcharge** | First bullet after reload deals 2× damage. |
| **Scavenger** | +25% drop rate for Iron and Energy Core. |
| **Tower Link** | Towers within territory gain +15% attack speed. |
| **Ricochet** | 15% chance bullets bounce off zombie bodies. |
| **Quick Draw** | Reload 20% faster. |
| **Bloodlust** | Each kill restores 2 HP to player. |

### 6.2) Skill Upgrade
- Skills can be **upgraded** from tier 1 → tier 2 using Crystal in the Shop.
- Tier 2 upgrades enhance effect magnitude or add secondary benefits.

---

## 7) Tower Defense System

### 7.1) Tower Resources
- **Iron (⬡):** Primary tower building resource; drops from all zombies when defeated.
- **Energy Core (◈):** Secondary resource; drops less frequently, mainly from stronger zombies and bosses.
- Both displayed on HUD.

### 7.2) Tower Types & Stats

| Tower | Cost | Primary Function |
|---|---|---|
| **Guard Tower** | 20 Iron | General-purpose attacker; shoots nearest zombie. |
| **Barricade** | 10 Iron | Physical wall; zombies must damage it before passing. |
| **Shock Pylon** | 15 Iron + 5 Core | AOE electrical burst; damages and slows zombies in radius. |
| **Sniper Post** | 25 Iron + 8 Core | High damage, single-target; high fire rate penalty. |
| **Repair Node** | 10 Iron + 10 Core | Heals towers and Home Base within range; does not deal damage. |

### 7.3) Tower Placement Rules
- Towers can **only** be placed within current territory.
- Towers occupy grid cells; placement must not overlap and must not block critical zombie paths.
- Towers have separate HP; zombies can damage and destroy towers.
- Towers provide visual feedback (glow effect) when selected or at max level.

### 7.4) Tower Upgrades
- Towers can be upgraded from **Level 1 → 2 → 3** by spending Iron + Energy Core.
- Upgrade cost scales with current level (Level 1→2 costs `level*15 Iron + level*5 Core`).
- Level ≥ 2 towers gain a **pulsing power glow** visual effect.

| Tower | Upgrade Effect |
|---|---|
| Guard Tower | Damage +, Fire Rate +, Range + |
| Barricade | HP +, Spike damage added |
| Shock Pylon | AOE radius +, Slow duration +, Stun chance added |
| Sniper Post | Damage ++, Armor penetration added |
| Repair Node | Heal rate +, Range + |

### 7.5) Tower Inspection Menu
- **Right-click** on placed tower → menu appears showing current level, HP, stats, upgrade preview, and action buttons.
- Actions: **Upgrade** (if resources available), **Sell** (returns 50% of cost).
- Inspect menu closes on Escape or click outside.

---

## 8) Player System

### 8.1) Movement & Combat
- **Controls:** WASD to move, Mouse to aim.
- **Shoot:** Left-click (hold) to fire; fire rate and accuracy depend on equipped weapon.
- **Reload:** R key or automatic reload when ammo depletes.
- **Invincibility frames:** After taking damage, 1.5 seconds of reduced damage taken.

### 8.2) Player Stats
- **Health:** Starts at 100 HP; upgradeable in Shop.
- **Armor:** Reduces incoming damage by percentage; upgradeable.
- **Level & XP:** Player gains XP from defeating zombies; leveling increases stat caps.
- **Base Damage:** Weapon base damage multiplier; affects all shots.
- **Crit Chance:** Chance to deal 1.5× damage per bullet.
- **Move Speed:** Walk/run speed; affects ability to kite zombies.
- **Pickup Range:** Distance to auto-collect dropped items.
- **Ammo Capacity:** Max ammunition reserve per weapon type.

### 8.3) Stat Upgrades
- **Currency:** Coins (dropped by zombies, found in chests).
- **Shop:** During Break Phase, purchase stat upgrades. Each upgrade costs Coins and grants +X to the stat.
- **Permanent:** Upgrades persist across waves and are never lost.

---

## 9) Weapons, Ammo & Attachments

### 9.1) Weapon Classes
- **Pistol** — balanced damage, medium fire rate, low spread.
- **Shotgun** — high damage, low fire rate, high spread, short range.
- **Assault Rifle** — medium damage, high fire rate, medium spread, long range.
- **SMG** — low damage, very high fire rate, high spread, medium range.
- **Sniper Rifle** — extreme damage, very low fire rate, zero spread, extreme range.

### 9.2) Weapon Stats
Each weapon has:
- **Damage:** Base damage per bullet.
- **Fire Rate:** Bullets per second.
- **Spread:** Bullet deviation angle (degrees).
- **Reload Time:** Seconds between full magazine loads.
- **Ammo Capacity:** Rounds per magazine.
- **Bullet Speed:** Projectile velocity (pixels/second).

### 9.3) Weapon Upgrades
- Purchasable via Shop during Break Phase.
- **Upgradeable stats:** Damage, Fire Rate, Accuracy (spread), Reload Time, Ammo Capacity.
- **Cost:** Scales per weapon type.

### 9.4) Attachments (Future: Planned but not yet implemented)
- Modular add-ons: Extended Magazine, Scope, Quick Loader, Tactical Grip, Suppressor.
- Attachment slots limited per weapon.
- Purchasable in Shop; persist on weapon.

---

## 10) Zombie System

### 10.1) Archetypes & Drops

| Archetype | Traits | Drop Rate |
|---|---|---|
| **Regular** | Balanced stats; most common. | High Iron |
| **Fast** | High speed, low HP; dangerous in groups. | Medium Iron |
| **Tank** | Extreme HP, low speed; soaks damage. | High Iron + Low Core |
| **Armored** | Damage reduction; slower than regular. | Medium Core |
| **Boss** | Extreme HP, special abilities, large size. | Crystal + High Core |

### 10.2) AI & Pathfinding
- Zombies pathfind toward Home Base, avoiding obstacles.
- **Barricade interaction:** Zombies will stop and damage barricades blocking their path.
- **Tower aggression:** If attacked by tower, zombie may deviate to attack tower briefly, then resume path.
- **Evolution:** Every N waves (e.g., every 10 waves), zombie stats scale up (HP +20%, Damage +10%, Speed +5%).

### 10.3) Spawn Logic
- **Locations:** 8 fixed spawn points around map edge.
- **Quantity:** Scales with wave number and selected difficulty.
- **Schedule:** Within a single wave, zombies spawn in multiple batches (not all instantaneous).
- **Progression:** Wave 1 has ~10 zombies; wave 20 may have ~50+ zombies.

---

## 11) Visual Effects & Game Feel

### 11.1) Particle System
- **Hit Sparks:** 6 ember-colored directional particles when bullet hits zombie.
- **Blood Splatter:** 8–40 red particles (count by archetype) with gravity when zombie dies.
- **Boss Radial Burst:** 30 amber/ember particles radiating outward when boss defeated.
- **Screen Flashes:** Red tint (damage taken), Orange tint (boss defeated).
- **Particle Cap:** Maximum 400 particles on-screen; oldest removed if exceeded.

### 11.2) Screen Shake & Camera Effects
- **Wave start (normal):** Medium shake (intensity 3, 0.3s duration).
- **Boss wave start:** Heavy shake (intensity 6, 0.5s duration).
- **Boss death:** Explosion shake with camera rotation.
- **Player damage:** Light directional shake toward damage source.

### 11.3) Visual Feedback
- **Tower glow:** Level ≥ 2 towers pulse with a power glow effect.
- **Weapon reload:** Reload bar displays time until next shot.
- **Territory ring:** Dashed rust-colored ring; expands visually when territory is upgraded.
- **Minimap:** Shows Base (amber), Towers (orange), Zombies (red), Player (warm grey), Territory boundary.

---

## 12) UI & HUD

### 12.1) HUD Layout (Bottom Bar)
Full-width 90px bar at screen bottom:
- **Left column (Vitals):** Player HP bar + Base HP bar; left border accent.
- **Center-left (Wave Info):** Current wave number (large), zombie count, break timer.
- **Center (Weapon):** Weapon slot icon, ammo count, reload progress bar.
- **Center-right (Skills):** Special skill slot icons (44×44px each).
- **Right (Resources & Level):** Level number, XP bar, resource counts (Coins, Iron, Core, Crystal).

### 12.2) Additional HUD Elements
- **Wave Announcement:** Large centered text fades in/out at wave start (e.g., "WAVE 5", "BOSS WAVE").
- **Boss Warning:** Full-screen pulsing red tint when boss wave active.
- **Break Progress Strip:** Thin 3px gradient strip at top of HUD bar; visible only during Break Phase.
- **Messages:** Floating text notifications (tower upgraded, killed, etc.) stack near top-center.
- **Minimap:** 160×160px in top-right corner; shows map overview, territory, towers, zombies, player.

### 12.3) Panels & Modals

| Panel | Triggered | Purpose |
|---|---|---|
| **Break Panel** | Break Phase starts | Shop, Tower Build Mode, Territory Expand |
| **Tower Inspect Menu** | Right-click tower | View/Upgrade/Sell tower |
| **Build Context Menu** | Right-click ground | Choose tower type to place |
| **Skill Select Modal** | Territory expansion | Choose 1 of 3 random skills |
| **Game Over Screen** | Home Base HP = 0 | Show score, kills, final stats; Restart button |
| **Tutorial Overlay** | Game start (first time) | 5-page walkthrough; keyboard + mechanics intro |

### 12.4) Break Phase UI
- **Slide-in panel from right side** (world visible on left).
- **Sections:** Character Upgrades (orange accent), Supplies (amber), Weapons (amber), Build Towers (green), Territory (cyan).
- **Sticky header:** "SUPPLY DEPOT" or "UPGRADES" title + break timer.
- **Sticky footer:** Full-width CLOSE/SKIP button in rust red.
- **Single-column scroll:** All purchases/upgrades listed in sections below header.

### 12.5) Build Mode
- Available during Break Phase via Build Context Menu.
- **Visual feedback:** Hover cells highlight green (valid placement) or red (invalid).
- **Placement preview:** Shows tower silhouette and cost before confirming.
- **Esc to cancel.**

---

## 13) Tutorial & Onboarding

### 13.1) First-Time Experience
- On game start, **Tutorial Overlay** appears with 5 pages:
  1. **Objective** — Protect Home Base; it's the core you must defend.
  2. **Movement & Combat** — WASD, Mouse aim, Click to shoot, R to reload.
  3. **Waves & Breaks** — Wave cycle, break phase mechanics, crystal from bosses.
  4. **Building Towers** — Right-click to build, placement rules, base aura.
  5. **Upgrades & Shop** — Break phase shop, character/tower upgrades, skill selection.

### 13.2) Tutorial Navigation
- **Next** button advances page; **Back** button returns.
- **Start Game** button on final page closes tutorial and begins wave 1.
- Tutorial can be reopened (future: add to main menu).

---

## 14) Scoring & Leaderboard (Planned)

### 14.1) Score Calculation
```
Score = (Kills × 10) + (Wave Reached × 100) + (Level × 50) + (Territory Rings × 200)
```

### 14.2) Game Over Stats
- **Waves Survived:** Final wave reached before defeat.
- **Total Kills:** Zombie eliminations.
- **Territory Rings:** Number of expansions completed.
- **Final Level:** Player level at end.
- **Playtime:** Total seconds from start to game over.

### 14.3) Leaderboard (Future: Not yet implemented)
- Local leaderboard stored in `localStorage`.
- Top 10 scores by player name.
- Score submission on Game Over screen.

---

## 15) Persistence (Save / Load)

### 15.1) Current Status
- **Partially implemented:** `src/utils/saveLoad.ts` exists with schema versioning.
- **Auto-save:** Triggered after each Break Phase.
- **Load on start:** Game checks `localStorage` for existing save; loads if found, otherwise starts fresh.

### 15.2) Saved State
- Current wave number.
- Resource counts (Coins, Iron, Core, Crystal).
- Territory state (ring count, boundary cells).
- All placed towers (type, position, level, HP).
- Player stats (level, XP, health, equipped weapon, upgrades).
- Skills unlocked (IDs and tier levels).

### 15.3) Future Work
- Backup/export save to JSON file.
- Cloud save support (future integration).
- Multiple save slots (future).

---

## 16) Difficulty & Scaling

### 16.1) Difficulty Modes (Planned)
- **Easy:** Slower zombie spawn, lower health, fewer waves per difficulty spike.
- **Normal:** Baseline difficulty as designed.
- **Hard:** Faster zombies, higher stats, fewer resources dropped.
- **Nightmare:** Extreme stats, very few resources, limited break time.

### 16.2) Dynamic Scaling
- Zombie stats scale every 10 waves: HP +20%, Damage +10%, Speed +5%.
- Boss health scales with wave number.
- Resource drop rates remain constant (design choice: prevent economy collapse).

---

## 17) Deployment & Technical

- **100% client-side:** No backend required.
- **Build tool:** Vite 5.2.0 (TypeScript 5.4.5).
- **Hosting:** Static file hosting (GitHub Pages, Netlify, Vercel).
- **Persistence:** `localStorage` only (no database).
- **Browser support:** Modern ES2020+ (Chrome, Firefox, Safari, Edge).

---

## 18) Known Limitations & Future Work

### 18.1) Not Yet Implemented (v1 Polish Pass)
- **Audio system** — No sound effects or music. Minimum needed: gunshot, zombie death, boss roar, wave clear, UI click feedback.
- **Skill gameplay integration** — Most special skills are defined but passive effects not wired to gameplay logic.
- **Mobile/Touch support** — Game designed for desktop mouse + keyboard.
- **Attachments system** — Weapon attachment slots defined but not purchasable.
- **Leaderboard** — Score calculation done; local storage ready, but UI not finalized.
- **Difficulty modes** — Balancing numbers needed before official release.

### 18.2) Minor Polish Needed
- **HUD small screens:** Bottom bar layout may overflow below 600px viewport width.
- **Resource icon glyphs** (¢ ⬡ ◈ ✦) — Russo One font may not render all symbols on all devices; fallback to text labels needed.
- **Accessibility:** No keyboard navigation for menus; no screen reader support.

---

## Appendix A — Feature Specification Template

When adding new features, follow this structure:

1. **Feature Name** — Clear, concise title.
2. **Player Value** — Why this matters to gameplay.
3. **Core Loop Impact** — How it changes wave/break cycle.
4. **Inputs & Controls** — Keyboard/mouse interactions.
5. **State Transitions** — Before/during/after states.
6. **UI Surfaces Used** — Which screens display this feature.
7. **Data Model** — Runtime + persistent save schema.
8. **Failure Cases** — What breaks; how to recover.
9. **Acceptance Criteria** — Testable requirements for QA.

---

**Last Updated:** April 2026 (v2.0 — UI Polish Pass Complete)
**Next Review:** Before major feature additions or difficulty balancing pass.
