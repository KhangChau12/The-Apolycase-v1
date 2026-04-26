import type { ZombieArchetype } from '../entities/Zombie'

export type AnimationState = 'idle' | 'walk' | 'attack' | 'windup' | 'stun'

export interface AnimationFrame {
  duration: number   // seconds per frame
  bodyScaleX: number
  bodyScaleY: number
  headOffsetY: number
  armRotL: number    // radians delta from rest
  armRotR: number
  legOffsetL: number // Y offset
  legOffsetR: number
  // per-limb deltas keyed by limb id
  limbDeltas?: Record<string, { rotDelta?: number; scaleDelta?: number; xDelta?: number; yDelta?: number }>
}

export interface AnimationClip {
  frames: AnimationFrame[]
  loopable: boolean
}

// ── Windup durations ──────────────────────────────────────────────────────────

export const WINDUP_DURATIONS: Record<ZombieArchetype, number> = {
  regular: 0.20,
  fast:    0.15,
  tank:    0.40,
  armored: 0.30,
  boss:    0.40,
}

// ── Combo damage multipliers [comboCounter 0,1,2] ────────────────────────────

export const COMBO_DAMAGE_MULT = [1.0, 1.15, 1.35]

// ── Combo pattern names (purely visual labels, no gameplay effect beyond mult) ─

export const COMBO_PATTERNS: Record<ZombieArchetype, string[]> = {
  regular: ['claw_l', 'claw_r', 'bite'],
  fast:    ['dash_bite', 'slash', 'spin_bite'],
  tank:    ['ground_slam', 'shoulder', 'heavy_strike'],
  armored: ['energy_blast', 'pulse', 'multi_hit'],
  boss:    ['stomp', 'claw', 'claw', 'energy_aoe'],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ZERO_FRAME: AnimationFrame = {
  duration: 0.5, bodyScaleX: 1, bodyScaleY: 1,
  headOffsetY: 0, armRotL: 0, armRotR: 0, legOffsetL: 0, legOffsetR: 0,
}

function mk(
  dur: number, bsx: number, bsy: number,
  hy: number, al: number, ar: number, ll: number, lr: number,
  ld?: AnimationFrame['limbDeltas']
): AnimationFrame {
  return { duration: dur, bodyScaleX: bsx, bodyScaleY: bsy, headOffsetY: hy, armRotL: al, armRotR: ar, legOffsetL: ll, legOffsetR: lr, limbDeltas: ld }
}

// ── Clips ─────────────────────────────────────────────────────────────────────

export const ANIMATION_CLIPS: Record<ZombieArchetype, Record<AnimationState, AnimationClip>> = {

  // ── REGULAR ──────────────────────────────────────────────────────────────
  regular: {
    idle: {
      loopable: true,
      frames: [
        mk(0.5, 1.00, 1.00,  0,     0.05, -0.05,  0,  0),
        mk(0.5, 1.00, 1.00, -0.01, -0.05,  0.05,  0,  0),
      ],
    },
    walk: {
      loopable: true,
      frames: [
        mk(0.15, 1.00, 1.00,  0,    0.35, -0.25,  2, -2),
        mk(0.15, 0.98, 1.02,  0.01, 0.10,  0.10,  0,  0),
        mk(0.15, 1.00, 1.00,  0,   -0.25,  0.35, -2,  2),
        mk(0.15, 0.98, 1.02,  0.01, 0.10,  0.10,  0,  0),
      ],
    },
    windup: {
      loopable: false,
      frames: [
        mk(0.15, 0.85, 1.10, -0.02, -0.45, -0.45,  0,  0),
      ],
    },
    attack: {
      loopable: false,
      frames: [
        mk(0.05, 1.15, 0.92, 0.02,  0.70,  0.70,  0,  0),
        mk(0.10, 1.00, 1.00, 0,     0.10,  0.10,  0,  0),
      ],
    },
    stun: {
      loopable: true,
      frames: [ { ...ZERO_FRAME, duration: 1.0 } ],
    },
  },

  // ── FAST ─────────────────────────────────────────────────────────────────
  fast: {
    idle: {
      loopable: true,
      frames: [
        mk(0.4, 1.00, 1.00,  0,    0.08, -0.08, 0, 0),
        mk(0.4, 1.00, 1.00,  0,   -0.08,  0.08, 0, 0),
      ],
    },
    walk: {
      loopable: true,
      frames: [
        mk(0.08, 1.00, 1.05,  0.01,  0.50, -0.30,  3, -3),
        mk(0.08, 0.96, 1.04,  0,     0.20,  0.20,  1,  1),
        mk(0.08, 1.00, 1.05,  0.01,  0.10, -0.10,  0,  0),
        mk(0.08, 0.96, 1.04,  0,    -0.30,  0.50, -3,  3),
        mk(0.08, 1.00, 1.05,  0.01, -0.10,  0.10,  0,  0),
        mk(0.08, 0.96, 1.04,  0,     0.20,  0.20,  1,  1),
      ],
    },
    windup: {
      loopable: false,
      frames: [
        mk(0.10, 0.80, 1.15, -0.03, -0.60, -0.60, 0, 0),
      ],
    },
    attack: {
      loopable: false,
      frames: [
        mk(0.04, 1.20, 0.88, 0.03,  0.90,  0.90, 0, 0),
        mk(0.08, 1.00, 1.00, 0,     0.15,  0.15, 0, 0),
      ],
    },
    stun: {
      loopable: true,
      frames: [ { ...ZERO_FRAME, duration: 1.0 } ],
    },
  },

  // ── TANK ─────────────────────────────────────────────────────────────────
  tank: {
    idle: {
      loopable: true,
      frames: [
        mk(0.6, 1.00, 1.00,  0,    0.04, -0.04, 0, 0),
        mk(0.6, 1.00, 1.00, -0.01,-0.04,  0.04, 0, 0),
      ],
    },
    walk: {
      loopable: true,
      frames: [
        mk(0.25, 1.00, 1.00,  0,    0.22, -0.15,  3, -3),
        mk(0.25, 0.99, 1.01,  0.01, 0.05,  0.05,  0,  0),
        mk(0.25, 1.00, 1.00,  0,   -0.15,  0.22, -3,  3),
      ],
    },
    windup: {
      loopable: false,
      frames: [
        mk(0.25, 0.88, 1.12, -0.03, -0.35, -0.35, 0, 0),
      ],
    },
    attack: {
      loopable: false,
      frames: [
        mk(0.06, 1.18, 0.88, 0.03,  0.60,  0.60, 0, 0),
        mk(0.14, 1.00, 1.00, 0,     0.10,  0.10, 0, 0),
      ],
    },
    stun: {
      loopable: true,
      frames: [ { ...ZERO_FRAME, duration: 1.0 } ],
    },
  },

  // ── ARMORED ──────────────────────────────────────────────────────────────
  armored: {
    idle: {
      loopable: true,
      frames: [
        mk(0.5, 1.00, 1.00,  0,    0.06, -0.06, 0, 0),
        mk(0.5, 1.00, 1.00, -0.01,-0.06,  0.06, 0, 0),
      ],
    },
    walk: {
      loopable: true,
      frames: [
        mk(0.20, 1.00, 1.00,  0,    0.28, -0.20,  2, -2),
        mk(0.20, 0.99, 1.01,  0.01, 0.08,  0.08,  0,  0),
        mk(0.20, 1.00, 1.00,  0,   -0.20,  0.28, -2,  2),
        mk(0.20, 0.99, 1.01,  0.01, 0.08,  0.08,  0,  0),
      ],
    },
    windup: {
      loopable: false,
      frames: [
        mk(0.18, 0.86, 1.10, -0.02, -0.40, -0.40, 0, 0),
      ],
    },
    attack: {
      loopable: false,
      frames: [
        mk(0.05, 1.14, 0.90, 0.02,  0.65,  0.65, 0, 0),
        mk(0.12, 1.00, 1.00, 0,     0.12,  0.12, 0, 0),
      ],
    },
    stun: {
      loopable: true,
      frames: [ { ...ZERO_FRAME, duration: 1.0 } ],
    },
  },

  // ── BOSS ─────────────────────────────────────────────────────────────────
  boss: {
    idle: {
      loopable: true,
      frames: [
        mk(0.5, 1.00, 1.00,  0,    0.05, -0.05, 0, 0),
        mk(0.5, 1.00, 1.00, -0.01,-0.05,  0.05, 0, 0),
      ],
    },
    walk: {
      loopable: true,
      frames: [
        mk(0.20, 1.00, 1.00,  0,    0.20, -0.15,  2, -2),
        mk(0.20, 0.99, 1.01,  0.01, 0.06,  0.06,  0,  0),
        mk(0.20, 1.00, 1.00,  0,   -0.15,  0.20, -2,  2),
        mk(0.20, 0.99, 1.01,  0.01, 0.06,  0.06,  0,  0),
      ],
    },
    windup: {
      loopable: false,
      frames: [
        mk(0.25, 0.82, 1.14, -0.04, -0.50, -0.50, 0, 0),
      ],
    },
    attack: {
      loopable: false,
      frames: [
        mk(0.06, 1.20, 0.85, 0.04,  0.80,  0.80, 0, 0),
        mk(0.15, 1.00, 1.00, 0,     0.12,  0.12, 0, 0),
      ],
    },
    stun: {
      loopable: true,
      frames: [ { ...ZERO_FRAME, duration: 1.0 } ],
    },
  },
}
