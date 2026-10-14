export type SoundStage = 'ordinary' | 'fracture' | 'descent' | 'revelation' | 'loop';
export type SoundCue = 'enter' | 'reveal' | 'loop' | 'hover';

/** A small, entirely synthesized soundscape. unlock() must run inside a user gesture. */
export class Soundscape {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private drone: OscillatorNode | null = null;
  private readonly sources = new Set<AudioScheduledSourceNode>();
  private readonly nodes = new Set<AudioNode>();
  private readonly voices = new Set<OscillatorNode>();
  private muted = false;
  private suspended = false;
  private disposed = false;
  private lastUpdate = -1;
  private lastHover = -1;
  private lastStage: SoundStage = 'ordinary';

  async unlock(): Promise<void> {
    if (this.disposed) return;
    try {
      if (!this.context) this.build();
      if (this.context?.state === 'suspended') await this.context.resume();
      this.suspended = false;
      this.setMaster();
    } catch {
      // A denied audio permission or interrupted context never prevents the artwork.
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.setMaster();
  }

  update(progress: number, stage: SoundStage): void {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.ambience || !this.filter) return;
    const now = context.currentTime;
    if (stage === this.lastStage && now - this.lastUpdate < 0.065) return;
    this.lastUpdate = now;
    this.lastStage = stage;
    const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
    const level = { ordinary: 0, fracture: 0.54, descent: 0.36, revelation: 0.095, loop: 0.26 }[stage];
    this.ambience.gain.setTargetAtTime(level, now, stage === 'revelation' ? 1.2 : 0.6);
    this.filter.frequency.setTargetAtTime(stage === 'fracture' ? 1100 : 180 + Math.sin(p * Math.PI) * 420, now, 0.55);
    this.drone?.frequency.setTargetAtTime(stage === 'loop' ? 55 : 43.65 + Math.sin(p * Math.PI) * 5, now, 1.1);
  }

  cue(name: SoundCue): void {
    const context = this.context;
    if (!context || context.state !== 'running' || this.muted || this.suspended || this.disposed) return;
    const now = context.currentTime;
    if (name === 'hover') {
      if (now - this.lastHover < 0.18) return;
      this.lastHover = now;
      this.tone(620, 790, 0.1, 0.025, 'sine');
    } else if (name === 'enter') {
      this.tone(91, 34, 2.8, 0.23, 'sine');
      this.tone(340, 74, 1.6, 0.035, 'triangle');
    } else if (name === 'reveal') {
      this.tone(220, 220, 3.8, 0.045, 'sine');
      this.tone(330, 330, 4.4, 0.026, 'sine', 0.12);
    } else {
      this.tone(110, 220, 1.5, 0.1, 'sine');
      this.tone(440, 440, 2.0, 0.028, 'sine', 0.16);
    }
  }

  /** Silence on visibility changes; no context resume is attempted without a gesture. */
  suspend(): void {
    this.suspended = true;
    this.setMaster();
  }

  resume(): void {
    this.suspended = false;
    this.setMaster();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const source of this.sources) {
      try { source.stop(); } catch { /* A transient may have already ended. */ }
    }
    for (const node of this.nodes) node.disconnect();
    this.nodes.clear();
    this.sources.clear();
    this.voices.clear();
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
    this.master = null;
    this.ambience = null;
    this.filter = null;
    this.drone = null;
  }

  private keep<T extends AudioNode>(node: T): T {
    this.nodes.add(node);
    return node;
  }

  private build(): void {
    const AudioContextConstructor = globalThis.AudioContext ??
      (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    this.context = context;
    const master = this.keep(context.createGain());
    master.gain.value = 0;
    this.master = master;
    const limiter = this.keep(context.createDynamicsCompressor());
    limiter.threshold.value = -16;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.005;
    limiter.release.value = 0.25;
    master.connect(limiter).connect(context.destination);

    const ambience = this.keep(context.createGain());
    ambience.gain.value = 0;
    this.ambience = ambience;
    const filter = this.keep(context.createBiquadFilter());
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.35;
    this.filter = filter;
    filter.connect(ambience).connect(master);

    // A short, low-feedback echo gives scale without convolution or asset downloads.
    const delay = this.keep(context.createDelay(1));
    const feedback = this.keep(context.createGain());
    const wet = this.keep(context.createGain());
    delay.delayTime.value = 0.37;
    feedback.gain.value = 0.16;
    wet.gain.value = 0.18;
    ambience.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(master);

    for (const [frequency, volume, detune] of [[43.65, 0.16, 0], [87.3, 0.055, 6]]) {
      const oscillator = this.keep(context.createOscillator());
      const gain = this.keep(context.createGain());
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency!;
      oscillator.detune.value = detune!;
      gain.gain.value = volume!;
      oscillator.connect(gain).connect(filter);
      this.sources.add(oscillator);
      oscillator.start();
      if (!this.drone) this.drone = oscillator;
    }

    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 3), context.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < data.length; i++) {
      brown = (brown + (Math.random() * 2 - 1) * 0.025) / 1.02;
      data[i] = brown * 0.42;
    }
    // Taper the join to keep the looping texture free of clicks.
    const edge = Math.floor(context.sampleRate * 0.02);
    for (let i = 0; i < edge; i++) {
      data[i] = data[i]! * i / edge;
      data[data.length - 1 - i] = data[data.length - 1 - i]! * i / edge;
    }
    const noise = this.keep(context.createBufferSource());
    noise.buffer = buffer;
    noise.loop = true;
    noise.connect(filter);
    this.sources.add(noise);
    noise.start();
  }

  private setMaster(): void {
    if (!this.master || !this.context || this.disposed) return;
    this.master.gain.setTargetAtTime(this.muted || this.suspended ? 0 : 0.46, this.context.currentTime, 0.055);
  }

  private tone(startHz: number, endHz: number, duration: number, volume: number, type: OscillatorType, offset = 0): void {
    const context = this.context;
    if (!context || !this.master || this.voices.size >= 10) return;
    const oscillator = this.keep(context.createOscillator());
    const gain = this.keep(context.createGain());
    const start = context.currentTime + offset;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startHz, start);
    oscillator.frequency.exponentialRampToValueAtTime(endHz, start + duration * 0.8);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.045, duration * 0.15));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.master);
    this.sources.add(oscillator);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      this.nodes.delete(oscillator);
      this.nodes.delete(gain);
      this.sources.delete(oscillator);
      this.voices.delete(oscillator);
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
}
