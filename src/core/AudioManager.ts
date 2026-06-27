export class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private enabled = true
  private sfxVolume = 0.6

  init(): void {
    try {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      const comp = this.ctx.createDynamicsCompressor()
      comp.threshold.value = -18
      comp.ratio.value = 4
      this.master.connect(comp)
      comp.connect(this.ctx.destination)
      this.master.gain.value = this.sfxVolume
    } catch {
      this.ctx = null
    }
  }

  setEnabled(v: boolean): void {
    this.enabled = v
    if (this.master) this.master.gain.value = v ? this.sfxVolume : 0
  }

  get isEnabled(): boolean { return this.enabled }

  // ── Internals ─────────────────────────────────────────────────────

  private now(): number { return this.ctx?.currentTime ?? 0 }

  private noise(duration: number): AudioBuffer {
    const ctx = this.ctx!
    const len = Math.ceil(ctx.sampleRate * duration)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  private bandpass(freq: number, q: number, duration: number, gain: number, t: number): void {
    const ctx = this.ctx!, master = this.master!
    const src = ctx.createBufferSource()
    src.buffer = this.noise(duration)
    const filt = ctx.createBiquadFilter()
    filt.type = 'bandpass'
    filt.frequency.value = freq
    filt.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + duration)
    src.connect(filt); filt.connect(g); g.connect(master)
    src.start(t); src.stop(t + duration + 0.02)
  }

  private lowpass(cutoff: number, duration: number, gain: number, t: number): void {
    const ctx = this.ctx!, master = this.master!
    const src = ctx.createBufferSource()
    src.buffer = this.noise(duration)
    const filt = ctx.createBiquadFilter()
    filt.type = 'lowpass'
    filt.frequency.value = cutoff
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + duration)
    src.connect(filt); filt.connect(g); g.connect(master)
    src.start(t); src.stop(t + duration + 0.02)
  }

  private highpass(cutoff: number, duration: number, gain: number, t: number): void {
    const ctx = this.ctx!, master = this.master!
    const src = ctx.createBufferSource()
    src.buffer = this.noise(duration)
    const filt = ctx.createBiquadFilter()
    filt.type = 'highpass'
    filt.frequency.value = cutoff
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + duration)
    src.connect(filt); filt.connect(g); g.connect(master)
    src.start(t); src.stop(t + duration + 0.02)
  }

  private osc(startHz: number, endHz: number, duration: number, gainPeak: number, t: number, wave: OscillatorType = 'sine'): void {
    const ctx = this.ctx!, master = this.master!
    const o = ctx.createOscillator()
    o.type = wave
    o.frequency.setValueAtTime(startHz, t)
    o.frequency.exponentialRampToValueAtTime(endHz, t + duration)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gainPeak, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + duration)
    o.connect(g); g.connect(master)
    o.start(t); o.stop(t + duration + 0.02)
  }

  private guard(): boolean {
    return !this.ctx || !this.master || !this.enabled
  }

  // ── Weapon sounds ─────────────────────────────────────────────────

  playGunshot(weaponClass: string): void {
    if (this.guard()) return
    try {
      const t = this.now()
      switch (weaponClass) {
        case 'pistol':
          this.bandpass(800, 1.2, 0.055, 0.9, t)
          this.osc(220, 70, 0.12, 0.3, t)
          break
        case 'shotgun':
          this.lowpass(400, 0.09, 1.4, t)
          this.lowpass(300, 0.06, 0.7, t + 0.03)
          this.bandpass(600, 0.8, 0.04, 0.4, t + 0.06)
          break
        case 'assaultRifle':
          this.bandpass(650, 1.0, 0.06, 0.8, t)
          this.osc(180, 60, 0.10, 0.25, t)
          break
        case 'smg':
          this.bandpass(700, 1.1, 0.04, 0.6, t)
          this.osc(200, 70, 0.08, 0.18, t)
          break
        case 'sniperRifle':
          this.highpass(1200, 0.035, 1.8, t)
          this.osc(880, 180, 0.40, 0.7, t)
          break
        case 'grenadeLauncher':
          this.lowpass(200, 0.12, 1.8, t)
          this.osc(80, 30, 0.20, 0.5, t)
          // Explosion sound delayed
          setTimeout(() => this.playExplosion(1.2), 60)
          break
        case 'marksmanRifle':
          this.bandpass(900, 1.0, 0.045, 1.0, t)
          this.osc(280, 85, 0.22, 0.4, t)
          break
        default:
          this.bandpass(700, 1.0, 0.055, 0.7, t)
      }
    } catch { /* audio errors must never crash the game */ }
  }

  playReload(weaponClass: string): void {
    if (this.guard()) return
    try {
      const t = this.now()
      const dur = weaponClass === 'sniperRifle' ? 0.12 : 0.07
      this.bandpass(1400, 2.0, dur, 0.3, t)
      this.bandpass(900, 1.5, 0.05, 0.2, t + dur * 0.6)
    } catch { }
  }

  playDryFire(): void {
    if (this.guard()) return
    try {
      this.bandpass(2000, 3.0, 0.03, 0.2, this.now())
    } catch { }
  }

  // ── Zombie sounds ─────────────────────────────────────────────────

  playZombieHit(archetype: string): void {
    if (this.guard()) return
    try {
      const t = this.now()
      switch (archetype) {
        case 'tank':
          this.lowpass(300, 0.12, 0.65, t); break
        case 'armored':
          this.bandpass(1200, 1.5, 0.06, 0.5, t)
          this.osc(880, 440, 0.06, 0.15, t); break
        case 'boss':
          this.lowpass(250, 0.15, 1.1, t); break
        case 'healer':
          this.bandpass(600, 1.2, 0.07, 0.3, t); break
        case 'spitter':
          this.bandpass(900, 1.4, 0.06, 0.35, t); break
        default: // regular, fast
          this.bandpass(800, 1.2, 0.08, 0.4, t)
      }
    } catch { }
  }

  playZombieDead(archetype: string): void {
    if (this.guard()) return
    try {
      const t = this.now()
      if (archetype === 'boss') {
        this.playBossRoar()
        setTimeout(() => this.playExplosion(2.5), 200)
        return
      }
      const gainMult = archetype === 'tank' ? 1.6 : archetype === 'armored' ? 1.2 : 1.0
      this.lowpass(350, 0.18, 0.55 * gainMult, t)
      this.bandpass(500, 0.8, 0.12, 0.3 * gainMult, t + 0.04)
    } catch { }
  }

  playBossRoar(): void {
    if (this.guard()) return
    try {
      const t = this.now()
      this.osc(80, 40, 0.8, 1.4, t, 'sawtooth')
      this.lowpass(300, 0.35, 0.9, t)
      this.osc(55, 30, 0.5, 0.6, t + 0.15)
    } catch { }
  }

  // ── World events ──────────────────────────────────────────────────

  playExplosion(intensity = 1): void {
    if (this.guard()) return
    try {
      const t = this.now()
      this.lowpass(300, 0.16, intensity * 2.2, t)
      this.osc(60, 20, 0.32, intensity * 0.5, t)
      this.bandpass(150, 0.6, 0.12, intensity * 0.8, t + 0.04)
    } catch { }
  }

  playWaveClear(): void {
    if (this.guard()) return
    try {
      const t = this.now()
      // C4 → E4 → G4 rising arpeggio
      for (const [i, hz] of [[0, 261], [1, 329], [2, 392]] as const) {
        this.osc(hz, hz * 0.98, 0.18, 0.55, t + i * 0.12)
      }
    } catch { }
  }

  playWaveStart(): void {
    if (this.guard()) return
    try {
      const t = this.now()
      this.osc(200, 180, 0.15, 0.4, t, 'sawtooth')
      this.lowpass(400, 0.1, 0.5, t + 0.08)
    } catch { }
  }

  playLevelUp(): void {
    if (this.guard()) return
    try {
      const t = this.now()
      // C4 → G4 → C5 → E5 fanfare
      for (const [i, hz] of [[0, 261], [1, 392], [2, 523], [3, 659]] as const) {
        this.osc(hz, hz * 0.99, 0.18, 0.45, t + i * 0.10)
      }
    } catch { }
  }

  playPickup(): void {
    if (this.guard()) return
    try {
      const t = this.now()
      this.osc(880, 1200, 0.08, 0.25, t)
    } catch { }
  }

  playTowerPlace(): void {
    if (this.guard()) return
    try {
      const t = this.now()
      this.bandpass(600, 1.5, 0.09, 0.5, t)
      this.osc(300, 200, 0.12, 0.3, t + 0.04)
    } catch { }
  }

  // ── UI sounds ─────────────────────────────────────────────────────

  playUIClick(): void {
    if (this.guard()) return
    try {
      this.bandpass(1800, 2.5, 0.025, 0.18, this.now())
    } catch { }
  }

  playSkillPick(): void {
    if (this.guard()) return
    try {
      const t = this.now()
      this.osc(660, 880, 0.12, 0.35, t)
      this.osc(880, 1100, 0.10, 0.25, t + 0.08)
    } catch { }
  }
}
