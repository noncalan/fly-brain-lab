// Spike sonification, like an electrophysiology audio monitor: one short click per spike of the chosen region.

/** Clicks per second above which spikes are dropped (the ear cannot separate them anyway). */
export const MAX_CLICKS_PER_SEC = 400;
const LATENCY_S = 0.05;
const CLICK_MS = 2;
/** After a stall (tab in background) do not play a burst covering more than this. */
const MAX_SPAN_S = 0.2;

/** Number of clicks to play for `spikes` spikes spread over `spanSec` seconds of wall time. */
export function clickCount(spikes: number, spanSec: number, maxPerSec = MAX_CLICKS_PER_SEC): number {
  if (!(spikes > 0) || !(spanSec > 0)) return 0;
  return Math.min(Math.round(spikes), Math.ceil(maxPerSec * spanSec));
}

export type SoundSource = { region: number } | 'all';

export interface SpikeFrame {
  neuropilSpikes: Uint32Array;
  totalSpikes: number;
}

export class SpikeSonifier {
  source: SoundSource = 'all';
  private ctx: AudioContext | null = null;
  private click: AudioBuffer | null = null;
  private out: GainNode | null = null;
  private lastWall = 0;

  get running(): boolean {
    return this.ctx !== null;
  }

  /** Must be called from a user gesture (browsers block audio otherwise). */
  async start(volume = 0.3): Promise<void> {
    if (this.ctx) return;
    const ctx = new AudioContext();
    await ctx.resume();
    const n = Math.round((ctx.sampleRate * CLICK_MS) / 1000);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n); // decaying noise burst
    const out = ctx.createGain();
    out.gain.value = volume;
    out.connect(ctx.destination);
    this.ctx = ctx;
    this.click = buf;
    this.out = out;
    this.lastWall = performance.now();
  }

  stop(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.click = null;
    this.out = null;
  }

  /** Schedule the clicks for one activity frame, spread over the wall time since the previous frame. */
  push(frame: SpikeFrame): void {
    const { ctx, click, out } = this;
    if (!ctx || !click || !out) return;
    const now = performance.now();
    const span = Math.min((now - this.lastWall) / 1000, MAX_SPAN_S);
    this.lastWall = now;
    const spikes = this.source === 'all' ? frame.totalSpikes : (frame.neuropilSpikes[this.source.region] ?? 0);
    const count = clickCount(spikes, span);
    const t0 = ctx.currentTime + LATENCY_S;
    for (let k = 0; k < count; k++) {
      const src = ctx.createBufferSource();
      src.buffer = click;
      src.connect(out);
      src.start(t0 + Math.random() * span);
    }
  }
}
