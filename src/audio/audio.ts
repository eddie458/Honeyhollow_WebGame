// Original sound effects and a gentle procedural music loop, synthesised with
// the Web Audio API (no audio files to download).

export type Sfx =
  | 'click'
  | 'pop'
  | 'coin'
  | 'pickup'
  | 'build'
  | 'built'
  | 'harvest'
  | 'plant'
  | 'place'
  | 'level'
  | 'goal'
  | 'bonus'
  | 'error'
  | 'cash'
  | 'whoosh'
  | 'open'
  | 'supply'
  | 'collectible'
  | 'expand';

type Ctx = AudioContext;

export class GameAudio {
  private ctx: Ctx | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private soundOn = true;
  private musicOn = true;
  private volume = 0.7;
  private musicTimer: number | null = null;
  private nextBeat = 0;
  private beat = 0;
  private lastPlay = new Map<string, number>();

  constructor(prefs: { sound: boolean; music: boolean; volume: number }) {
    this.soundOn = prefs.sound;
    this.musicOn = prefs.music;
    this.volume = prefs.volume;
    const unlock = () => {
      this.ensure();
      if (this.ctx?.state === 'suspended') void this.ctx.resume();
      if (this.musicOn) this.startMusic();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  private ensure(): Ctx | null {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.soundOn ? 0.9 : 0;
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.32 : 0;
    this.musicBus.connect(this.master);
    const len = ctx.sampleRate * 0.6;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  setSound(on: boolean): void {
    this.soundOn = on;
    if (this.ctx) this.sfxBus.gain.value = on ? 0.9 : 0;
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.2);
    if (on) this.startMusic();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.ctx) this.master.gain.value = v;
  }

  // -------------------------------------------------------------- voices --

  private tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number, bus: AudioNode, glideTo?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.015, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(bus);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  private noise(start: number, dur: number, gain: number, filter: BiquadFilterType, freq: number, bus: AudioNode, sweepTo?: number): void {
    const ctx = this.ctx!;
    if (!this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, start);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, start + dur);
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(start);
    src.stop(start + dur + 0.05);
  }

  play(name: Sfx, arg = 0): void {
    if (!this.soundOn) return;
    const ctx = this.ensure();
    if (!ctx || ctx.state !== 'running') return;
    // avoid machine-gun repeats of the same sound in one frame
    const nowMs = performance.now();
    const last = this.lastPlay.get(name) ?? 0;
    if (nowMs - last < (name === 'pickup' ? 35 : 50)) return;
    this.lastPlay.set(name, nowMs);
    const t = ctx.currentTime + 0.005;
    const b = this.sfxBus;
    switch (name) {
      case 'click':
        this.tone(880, t, 0.05, 'sine', 0.18, b);
        break;
      case 'pop':
        this.tone(380, t, 0.09, 'triangle', 0.25, b, 950);
        break;
      case 'coin':
        this.tone(1318.5, t, 0.08, 'square', 0.07, b);
        this.tone(1760, t + 0.07, 0.28, 'square', 0.07, b);
        break;
      case 'pickup': {
        const f = 620 * Math.pow(2, Math.min(arg, 24) / 12);
        this.tone(f, t, 0.07, 'sine', 0.2, b);
        this.tone(f * 2, t, 0.05, 'sine', 0.05, b);
        break;
      }
      case 'build':
        this.noise(t, 0.08, 0.5, 'lowpass', 900, b);
        this.tone(160, t, 0.12, 'sine', 0.35, b, 90);
        break;
      case 'built':
        [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, t + i * 0.07, 0.25, 'triangle', 0.16, b));
        this.noise(t, 0.2, 0.2, 'highpass', 4000, b);
        break;
      case 'harvest':
        this.noise(t, 0.16, 0.35, 'bandpass', 1500, b, 4500);
        this.tone(660, t + 0.06, 0.1, 'triangle', 0.15, b, 880);
        break;
      case 'plant':
        this.noise(t, 0.07, 0.25, 'lowpass', 600, b);
        this.tone(330, t + 0.02, 0.08, 'sine', 0.15, b, 440);
        break;
      case 'place':
        this.tone(130, t, 0.14, 'sine', 0.4, b, 70);
        this.noise(t, 0.06, 0.3, 'lowpass', 700, b);
        break;
      case 'level':
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, t + i * 0.09, 0.35, 'square', 0.06, b));
        [523.25, 783.99, 1046.5].forEach((f) => this.tone(f, t + 0.5, 0.8, 'triangle', 0.1, b));
        break;
      case 'goal':
        [783.99, 987.77, 1174.66].forEach((f, i) => this.tone(f, t + i * 0.11, 0.4, 'sine', 0.18, b));
        break;
      case 'bonus':
        [659.25, 830.61, 987.77, 1318.5].forEach((f, i) => this.tone(f, t + i * 0.05, 0.18, 'square', 0.05, b));
        break;
      case 'error':
        this.tone(170, t, 0.09, 'sawtooth', 0.12, b);
        this.tone(150, t + 0.12, 0.12, 'sawtooth', 0.12, b);
        break;
      case 'cash':
        this.noise(t, 0.04, 0.4, 'highpass', 3000, b);
        this.tone(1567.98, t + 0.03, 0.35, 'triangle', 0.14, b);
        this.tone(2093, t + 0.08, 0.3, 'sine', 0.08, b);
        break;
      case 'whoosh':
        this.noise(t, 0.25, 0.25, 'bandpass', 400, b, 2400);
        break;
      case 'open':
        this.tone(440, t, 0.06, 'sine', 0.12, b, 660);
        break;
      case 'supply':
        this.noise(t, 0.1, 0.3, 'lowpass', 1200, b);
        this.tone(392, t + 0.03, 0.12, 'triangle', 0.15, b, 523.25);
        break;
      case 'collectible':
        [1046.5, 1318.5, 1567.98, 2093].forEach((f, i) => this.tone(f, t + i * 0.06, 0.3, 'sine', 0.1, b));
        break;
      case 'expand':
        [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.1, 0.5, 'triangle', 0.12, b));
        break;
    }
  }

  // --------------------------------------------------------------- music --

  private startMusic(): void {
    const ctx = this.ensure();
    if (!ctx || this.musicTimer !== null) return;
    this.nextBeat = ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 120);
  }

  /** 96 BPM loop over C - Am - F - G with a plucked arpeggio and soft bass. */
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicOn || ctx.state !== 'running') return;
    const spb = 60 / 96 / 2; // eighth notes
    const chords = [
      [261.63, 329.63, 392.0],
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [196.0, 246.94, 293.66],
    ];
    const bass = [130.81, 110.0, 87.31, 98.0];
    const penta = [523.25, 587.33, 659.25, 783.99, 880.0];
    while (this.nextBeat < ctx.currentTime + 0.4) {
      const t = this.nextBeat;
      const bar = Math.floor(this.beat / 8) % 8;
      const chordIdx = Math.floor(bar / 2) % 4;
      const chord = chords[chordIdx]!;
      const step = this.beat % 8;
      const m = this.musicBus;
      if (step === 0) {
        this.tone(bass[chordIdx]!, t, spb * 3.5, 'sine', 0.22, m);
        for (const f of chord) this.tone(f, t, spb * 7.5, 'triangle', 0.035, m);
      }
      if (step === 4) this.tone(bass[chordIdx]! * 1.5, t, spb * 2.5, 'sine', 0.12, m);
      // arpeggio
      const arp = chord[[0, 1, 2, 1, 0, 2, 1, 2][step]!]! * 2;
      this.tone(arp, t, spb * 0.9, 'sine', 0.06, m);
      // sparse melody
      if ((step === 2 || step === 6) && Math.random() < 0.45) {
        this.tone(penta[Math.floor(Math.random() * penta.length)]!, t, spb * 1.8, 'triangle', 0.045, m);
      }
      // soft shaker
      if (step % 2 === 1) this.noise(t, 0.04, 0.03, 'highpass', 6000, m);
      this.nextBeat += spb;
      this.beat++;
    }
  }
}
