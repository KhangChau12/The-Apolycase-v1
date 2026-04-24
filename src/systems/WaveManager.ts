export type WavePhase = 'wave' | 'break' | 'boss'

export class WaveManager {
  waveIndex = 0
  phase: WavePhase = 'wave'
  breakTimeLeft = 0
  readonly breakDuration = 15
  currentBreakDuration = this.breakDuration
  readonly bossEvery = 5

  startNextWave(): void {
    this.waveIndex++
    this.phase = this.isBossWave ? 'boss' : 'wave'
  }

  get isBossWave(): boolean {
    return this.waveIndex > 0 && this.waveIndex % this.bossEvery === 0
  }

  enterBreak(duration = this.breakDuration): void {
    this.phase = 'break'
    this.currentBreakDuration = duration
    this.breakTimeLeft = duration
  }

  skipBreak(): void {
    this.breakTimeLeft = 0
  }

  update(dt: number): void {
    if (this.phase === 'break') {
      this.breakTimeLeft = Math.max(0, this.breakTimeLeft - dt)
    }
  }
}
