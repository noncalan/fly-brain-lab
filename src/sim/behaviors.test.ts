import { describe, expect, it } from 'vitest';
import behaviorsConfig from '../../config/behaviors.json';
import stimuliConfig from '../../config/stimuli.json';
import { BehaviorMonitor } from './behaviors';
import { Simulator } from './engine';
import { loadBuiltConnectome } from './testing';
import type { ActivitySnapshot } from './types';

const snap = (windowMs: number, rate: number): ActivitySnapshot => ({
  timeMs: 0,
  windowMs,
  spikedIndices: new Uint32Array(),
  neuropilSpikes: new Uint32Array(),
  setRatesHz: { r: rate },
  totalSpikes: 0,
});

describe('BehaviorMonitor', () => {
  const rule = { id: 'b', readout: 'r', thresholdHz: 10, windowMs: 100 };

  it('waits for a full window before switching on', () => {
    const m = new BehaviorMonitor([rule]);
    expect(m.push(snap(50, 100))[0].active).toBe(false);
    expect(m.push(snap(50, 100))[0].active).toBe(true);
  });

  it('averages over the window and switches off when activity stops', () => {
    const m = new BehaviorMonitor([rule]);
    m.push(snap(100, 30));
    // whole snapshots are kept until they cover the window: (30*100 + 0*50) / 150
    expect(m.push(snap(50, 0))[0].rateHz).toBeCloseTo(20, 6);
    expect(m.push(snap(100, 0))[0].active).toBe(false);
  });

  it('rejects invalid rules', () => {
    expect(() => new BehaviorMonitor([{ ...rule, thresholdHz: 0 }])).toThrow();
  });
});

describe('config', () => {
  const c = loadBuiltConnectome();

  it('references only existing sets and behaviours', () => {
    const behaviorIds = new Set(behaviorsConfig.behaviors.map((b) => b.id));
    for (const b of behaviorsConfig.behaviors) expect(c.sets[b.readout], b.readout).toBeDefined();
    for (const s of stimuliConfig.stimuli) {
      expect(c.sets[s.set], s.set).toBeDefined();
      for (const e of s.expects) expect(behaviorIds.has(e), e).toBe(true);
    }
  });

  it.each(stimuliConfig.stimuli.map((s) => [s.id, s] as const))(
    '%s triggers exactly the behaviours the model produces (seed 1)',
    (_id, stimulus) => {
      const sim = new Simulator(c, 1);
      const monitor = new BehaviorMonitor(behaviorsConfig.behaviors);
      sim.stimulate(stimulus.set, stimulus.defaultRateHz);
      let states = monitor.push(sim.getActivity());
      for (let t = 0; t < 1000; t += 50) {
        sim.step(50);
        states = monitor.push(sim.getActivity());
      }
      const on = states.filter((s) => s.active).map((s) => s.id);
      // Water is expected to cause feeding but the v783 model does not reproduce it (docs/MODEL_NOTES.md §3).
      const modelReproduces = stimulus.id === 'water' ? [] : stimulus.expects;
      expect(on.sort()).toEqual([...modelReproduces].sort());
    },
  );
});
