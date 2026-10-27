import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_STEP_HZ, STRIDE_MM, gaitDrive, legAnglesAt, samplePeriodic, type GaitData } from './gait';

const gait = JSON.parse(readFileSync(resolve(__dirname, '../../public/data/gait.json'), 'utf8')) as GaitData;

describe('recorded gait playback', () => {
  it('interpolation passes through the samples and wraps around', () => {
    const v = [0, 1, 4, 9, 16];
    expect(samplePeriodic(v, (2 * Math.PI * 2) / 5)).toBeCloseTo(4, 6);
    expect(samplePeriodic(v, 0)).toBeCloseTo(samplePeriodic(v, 2 * Math.PI), 6);
  });

  it('zero amplitude is the mid-stance pose for every phase', () => {
    expect(legAnglesAt(gait, 'lf', 0.3, 0)).toEqual(legAnglesAt(gait, 'lf', 4.0, 0));
  });

  it('the recorded step is about 7.4 Hz', () => {
    expect(gait.step_frequency_hz).toBeGreaterThan(7);
    expect(gait.step_frequency_hz).toBeLessThan(8);
  });
});

describe('gaitDrive', () => {
  it('stands still with no command', () => {
    expect(gaitDrive(gait, 0, 0).frequency).toBe(0);
  });

  it('keeps feet from sliding: stride × amplitude × frequency equals body speed', () => {
    for (const v of [2, 7, 12, 20, 21.5]) {
      const d = gaitDrive(gait, v, 0);
      expect(STRIDE_MM * Math.abs(d.left) * d.frequency).toBeCloseTo(v, 6);
    }
  });

  it('runs faster by stepping faster, within a fly-like limit', () => {
    expect(gaitDrive(gait, 20, 0).frequency).toBeGreaterThan(gaitDrive(gait, 5, 0).frequency);
    expect(gaitDrive(gait, 100, 0).frequency).toBeLessThanOrEqual(MAX_STEP_HZ + 1e-9);
  });

  it('backward walking flips the amplitude, a right turn shortens the right side', () => {
    expect(gaitDrive(gait, -5, 0).left).toBeLessThan(0);
    const d = gaitDrive(gait, 5, 1);
    expect(Math.abs(d.right)).toBeLessThan(Math.abs(d.left));
  });

  it('turning in place moves the two sides in opposite directions', () => {
    const d = gaitDrive(gait, 0, 1.5);
    expect(d.frequency).toBeGreaterThan(0);
    expect(Math.sign(d.left)).toBe(-Math.sign(d.right));
  });
});
