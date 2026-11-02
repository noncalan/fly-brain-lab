import { describe, expect, it } from 'vitest';
import { MAX_CLICKS_PER_SEC, clickCount } from './sonify';

describe('clickCount', () => {
  it('plays one click per spike while below the cap', () => {
    expect(clickCount(5, 0.033)).toBe(5);
  });

  it('caps clicks at MAX_CLICKS_PER_SEC over the span', () => {
    expect(clickCount(10_000, 0.1)).toBe(Math.ceil(MAX_CLICKS_PER_SEC * 0.1));
  });

  it('plays nothing without spikes or time', () => {
    expect(clickCount(0, 0.1)).toBe(0);
    expect(clickCount(10, 0)).toBe(0);
    expect(clickCount(Number.NaN, 0.1)).toBe(0);
  });
});
