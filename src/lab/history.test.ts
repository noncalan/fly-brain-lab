import { describe, expect, it } from 'vitest';
import { HISTORY_MS, History, historyToCsv } from './history';

describe('History', () => {
  it('keeps only the last HISTORY_MS of simulated time and marks watched neurons', () => {
    const h = new History();
    h.setWatch([5, 9]);
    for (let t = 0; t <= HISTORY_MS + 1000; t += 100) h.push(t, 100, new Uint32Array([1, 2]), { mn9: 3 }, new Uint32Array());
    expect(h.frames[h.frames.length - 1].timeMs - h.frames[0].timeMs).toBeLessThanOrEqual(HISTORY_MS);
    h.clear();
    h.push(0, 50, new Uint32Array([0, 0]), {}, Uint32Array.from([9, 7]));
    expect(Array.from(h.frames[0].watched)).toEqual([0, 1]);
  });

  it('exports rates per second in CSV', () => {
    const h = new History();
    h.push(100, 50, new Uint32Array([10, 0]), { mn9: 42 }, new Uint32Array());
    const csv = historyToCsv(h.frames, ['GNG', 'AL_L'], ['mn9']).trim().split('\n');
    expect(csv[0]).toBe('time_ms,window_ms,set_mn9_hz,region_GNG_spikes_per_s,region_AL_L_spikes_per_s');
    expect(csv[1]).toBe('100.0,50.0,42.000,200.0,0.0');
  });
});
