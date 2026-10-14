export type Stage = 'ordinary' | 'fracture' | 'descent' | 'revelation' | 'loop';

export const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const smooth = (value: number) => { const x = clamp(value); return x * x * (3 - 2 * x); };
export const smoother = (value: number) => { const x = clamp(value); return x * x * x * (x * (x * 6 - 15) + 10); };
export const easeInOut = (value: number) => { const x = clamp(value); return x < .5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2; };

/** Logical state is independent of render time; transitions may only use this graph. */
export class Journey {
  stage: Stage = 'ordinary';
  progress = 0;
  target = 0;
  elapsed = 0;
  loopCount = 0;
  private onChange: (stage: Stage) => void;
  constructor(onChange: (stage: Stage) => void) { this.onChange = onChange; }
  private set(stage: Stage) { this.stage = stage; this.elapsed = 0; this.onChange(stage); }
  enter() { if (this.stage === 'ordinary') { this.progress = this.target = 0; this.set('fracture'); } }
  travel(delta: number) { if (this.stage === 'descent') this.target = clamp(this.target + delta); }
  return() { if (this.stage === 'revelation') this.set('loop'); }
  reset(completed = false) {
    if (completed) this.loopCount++;
    this.progress = this.target = 0;
    this.set('ordinary');
  }
  tick(dt: number, reduced: boolean) {
    this.elapsed += dt;
    if (this.stage === 'fracture' && this.elapsed >= 4.8) this.set('descent');
    if (this.stage === 'descent') {
      // The automatic rail guarantees a destination even without wheel/touch input.
      this.target = clamp(this.target + dt / (reduced ? 48 : 31));
      this.progress += (this.target - this.progress) * (1 - Math.exp(-dt * 3.1));
      if (this.progress > .997) { this.progress = this.target = 1; this.set('revelation'); }
    }
    if (this.stage === 'loop' && this.elapsed >= 3.6) this.reset(true);
  }
}
