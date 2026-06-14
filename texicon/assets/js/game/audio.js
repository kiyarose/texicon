export class GameAudio {
  constructor() {
    this.ctx = null
    this.masterGain = null
    this.started = false
    this.bpm = 110
    this.step = 0
    this.lastTick = 0
    this.patterns = {
      kick: "x...x...x...x...",
      snare: "....x.......x...",
      bass: "x.x.....x.x.....",
      melody: "..x.....x.....x.",
    }
    this.melodyNotes = [261.63, 293.66, 329.63, 392.0, 440.0]
    this.hiHat = false
    this.fadeDuration = 0.7
    this.fadeElapsed = 0
    this.fadeDir = 0
    this.pendingMusic = null
    this.volume = 1
  }

  start() {
    if (this.started) return
    this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 1
    this.masterGain.connect(this.ctx.destination)
    this.started = true
    this.lastTick = this.ctx.currentTime
  }

  out() {
    return this.masterGain || this.ctx?.destination
  }

  setPatterns(music) {
    if (!music) return
    this.bpm = music.bpm || 110
    this.patterns = {
      kick: music.kick || this.patterns.kick,
      snare: music.snare || this.patterns.snare,
      bass: music.bass || this.patterns.bass,
      melody: music.melody || this.patterns.melody,
    }
  }

  setIntensity(chunkIndex) {
    this.hiHat = chunkIndex >= 5
  }

  transitionTo(music, chunkIndex) {
    if (!music) return
    if (!this.started || !this.ctx) {
      this.setPatterns(music)
      this.setIntensity(chunkIndex)
      return
    }
    this.pendingMusic = { music, chunkIndex }
    this.fadeDir = -1
    this.fadeElapsed = 0
  }

  update(dt = 1) {
    if (!this.started || !this.ctx) return

    const dtSec = dt / 60
    this.updateFade(dtSec)

    const stepDuration = 60 / this.bpm / 4
    const now = this.ctx.currentTime

    while (now - this.lastTick >= stepDuration) {
      this.tick(this.step % 16)
      this.step += 1
      this.lastTick += stepDuration
    }
  }

  updateFade(dtSec) {
    if (!this.pendingMusic || this.fadeDir === 0) return

    this.fadeElapsed += dtSec

    if (this.fadeDir === -1) {
      this.volume = Math.max(0, 1 - this.fadeElapsed / this.fadeDuration)
      this.masterGain.gain.value = this.volume

      if (this.fadeElapsed >= this.fadeDuration) {
        this.setPatterns(this.pendingMusic.music)
        this.setIntensity(this.pendingMusic.chunkIndex)
        this.fadeDir = 1
        this.fadeElapsed = 0
      }
    } else if (this.fadeDir === 1) {
      this.volume = Math.min(1, this.fadeElapsed / this.fadeDuration)
      this.masterGain.gain.value = this.volume

      if (this.fadeElapsed >= this.fadeDuration) {
        this.pendingMusic = null
        this.fadeDir = 0
        this.volume = 1
        this.masterGain.gain.value = 1
      }
    }
  }

  tick(i) {
    const p = this.patterns
    if (p.kick[i] === "x") this.kick()
    if (p.snare[i] === "x") this.snare()
    if (p.bass[i] === "x") this.bass()
    if (p.melody[i] === "x") this.melody(i)
    if (this.hiHat && i % 2 === 0) this.hihat()
  }

  kick() {
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.connect(gain)
    gain.connect(this.out())
    osc.frequency.setValueAtTime(150, t)
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12)
    gain.gain.setValueAtTime(0.5, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    osc.start(t)
    osc.stop(t + 0.15)
  }

  snare() {
    const t = this.ctx.currentTime
    const bufferSize = this.ctx.sampleRate * 0.08
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    const src = this.ctx.createBufferSource()
    const gain = this.ctx.createGain()
    src.buffer = buffer
    src.connect(gain)
    gain.connect(this.out())
    gain.gain.setValueAtTime(0.25, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
    src.start(t)
  }

  bass() {
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = "square"
    osc.connect(gain)
    gain.connect(this.out())
    osc.frequency.setValueAtTime(65, t)
    gain.gain.setValueAtTime(0.12, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    osc.start(t)
    osc.stop(t + 0.2)
  }

  melody(i) {
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = "triangle"
    osc.connect(gain)
    gain.connect(this.out())
    osc.frequency.setValueAtTime(this.melodyNotes[i % this.melodyNotes.length], t)
    gain.gain.setValueAtTime(0.08, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    osc.start(t)
    osc.stop(t + 0.15)
  }

  hihat() {
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = "square"
    osc.connect(gain)
    gain.connect(this.out())
    osc.frequency.setValueAtTime(8000, t)
    gain.gain.setValueAtTime(0.03, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03)
    osc.start(t)
    osc.stop(t + 0.03)
  }
}
