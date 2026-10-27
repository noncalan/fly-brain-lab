// Rolling record of recent activity for the raster, the heatmap and the CSV export.

export interface HistoryFrame {
  timeMs: number;
  windowMs: number;
  /** spikes per neuropil in this frame */
  neuropilSpikes: Uint32Array;
  /** mean rate of every named set (Hz) */
  setRatesHz: Record<string, number>;
  /** 1 if the watched neuron spiked in this frame, aligned with History.watch */
  watched: Uint8Array;
}

export const HISTORY_MS = 10_000;

export class History {
  frames: HistoryFrame[] = [];
  watch: number[] = [];
  private watchIndex = new Map<number, number>();

  setWatch(neurons: number[]): void {
    this.watch = neurons;
    this.watchIndex = new Map(neurons.map((n, i) => [n, i]));
  }

  push(timeMs: number, windowMs: number, neuropilSpikes: Uint32Array, setRatesHz: Record<string, number>, spiked: Uint32Array): void {
    if (windowMs <= 0) return;
    const watched = new Uint8Array(this.watch.length);
    for (const i of spiked) {
      const w = this.watchIndex.get(i);
      if (w !== undefined) watched[w] = 1;
    }
    this.frames.push({ timeMs, windowMs, neuropilSpikes: neuropilSpikes.slice(), setRatesHz: { ...setRatesHz }, watched });
    while (this.frames.length > 1 && timeMs - this.frames[0].timeMs > HISTORY_MS) this.frames.shift();
  }

  clear(): void {
    this.frames = [];
  }
}

/** CSV with one row per frame: time, every named set's rate (Hz), every neuropil's spike rate (spikes/s). */
export function historyToCsv(frames: HistoryFrame[], neuropils: string[], setIds: string[]): string {
  const header = ['time_ms', 'window_ms', ...setIds.map((s) => `set_${s}_hz`), ...neuropils.map((n) => `region_${n}_spikes_per_s`)];
  const rows = frames.map((f) => [
    f.timeMs.toFixed(1),
    f.windowMs.toFixed(1),
    ...setIds.map((s) => (f.setRatesHz[s] ?? 0).toFixed(3)),
    ...Array.from(f.neuropilSpikes, (c) => ((c * 1000) / f.windowMs).toFixed(1)),
  ]);
  return [header, ...rows].map((r) => r.join(',')).join('\n') + '\n';
}
