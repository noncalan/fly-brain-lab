import { describe, expect, it } from 'vitest';
import { FpsGovernor, initialQuality } from './quality';

/** Feed frames every `dtMs` from `from` to `to`; returns whether any frame asked to step down. */
function run(g: FpsGovernor, from: number, to: number, dtMs: number): boolean {
  let drop = false;
  for (let t = from; t <= to; t += dtMs) drop = g.frame(t) || drop;
  return drop;
}

describe('FpsGovernor', () => {
  it('steps down when the page runs below 30 FPS after the grace period', () => {
    const g = new FpsGovernor(0);
    expect(run(g, 0, 4000, 50)).toBe(false); // 20 FPS during loading is ignored
    expect(run(g, 4050, 7000, 50)).toBe(true);
  });

  it('keeps quality at 60 FPS', () => {
    const g = new FpsGovernor(0);
    expect(run(g, 0, 10_000, 1000 / 60)).toBe(false);
  });

  it('treats long gaps (background tab) as a pause, not as slow frames', () => {
    const g = new FpsGovernor(0);
    run(g, 0, 5000, 1000 / 60);
    let drop = false;
    for (let t = 5000; t < 20_000; t += 1000) drop = g.frame(t) || drop; // one frame per second
    expect(drop).toBe(false);
  });
});

describe('initialQuality', () => {
  it('starts phones at medium and desktops at high; ?quality= overrides', () => {
    expect(initialQuality('', true, 915)).toBe('medium');
    expect(initialQuality('', false, 1920)).toBe('high');
    expect(initialQuality('', true, 1366)).toBe('high');
    expect(initialQuality('?quality=low', false, 1920)).toBe('low');
    expect(initialQuality('?quality=nonsense', false, 1920)).toBe('high');
  });
});
