// Tests on the real FlyWire v783 graph (public/data). Ranges come from the Shiu-parameter probe documented in
// docs/MODEL_NOTES.md §3; snapshots pin exact spike counts for fixed seeds so any change to the core is visible.
import { describe, expect, it } from 'vitest';
import { Simulator } from './engine';
import { loadBuiltConnectome } from './testing';

const c = loadBuiltConnectome();

function run(stimuli: Record<string, number>, ms = 1000, seed = 1) {
  const sim = new Simulator(c, seed);
  for (const [set, hz] of Object.entries(stimuli)) sim.stimulate(set, hz);
  const t0 = performance.now();
  sim.step(ms);
  const wallMs = performance.now() - t0;
  const a = sim.getActivity();
  return { a, wallMs, active: a.spikedIndices.length };
}

describe('built connectome', () => {
  it('matches meta and Shiu Connectivity_783 restricted to >= 5 synapses', () => {
    expect(c.neuronCount).toBe(139255);
    expect(c.edgeCount).toBe(2700513);
    expect(c.neuropils.length).toBe(79);
    for (let i = 0; i < c.neuronCount; i++) if (c.rowPtr[i + 1] < c.rowPtr[i]) throw new Error(`row_ptr not monotonic at ${i}`);
    let minAbs = Infinity;
    for (const w of c.weight) minAbs = Math.min(minAbs, Math.abs(w));
    expect(minAbs).toBe(5);
  });

  it('every set has valid, non-empty indices', () => {
    for (const [id, s] of Object.entries(c.sets)) {
      expect(s.indices.length, id).toBeGreaterThan(0);
      for (const i of s.indices) expect(i).toBeLessThan(c.neuronCount);
    }
  });
});

describe('reproduces Shiu et al. effects (seed 1, 1 s)', () => {
  it('sugar GRNs drive MN9 with a few hundred neurons active', () => {
    const { a, active, wallMs } = run({ shiu_sugar_r: 100 });
    console.info(`sugar 100 Hz: MN9 ${a.setRatesHz.mn9.toFixed(1)} Hz, active ${active}, wall ${wallMs.toFixed(0)} ms`);
    expect(a.setRatesHz.mn9).toBeGreaterThan(30);
    expect(active).toBeGreaterThan(200);
    expect(active).toBeLessThan(600);
  });

  it('bitter suppresses sugar-evoked MN9', () => {
    const sugar = run({ shiu_sugar_r: 150 }).a.setRatesHz.mn9;
    const both = run({ shiu_sugar_r: 150, shiu_bitter_r: 150 }).a.setRatesHz.mn9;
    console.info(`MN9 sugar ${sugar.toFixed(1)} Hz, sugar+bitter ${both.toFixed(1)} Hz`);
    expect(both).toBeLessThan(sugar * 0.4);
  });

  it('looming detectors drive the Giant Fiber', () => {
    const { a, wallMs } = run({ vpn_looming: 150 });
    console.info(`looming: GF ${a.setRatesHz.giant_fiber.toFixed(1)} Hz, wall ${wallMs.toFixed(0)} ms`);
    expect(a.setRatesHz.giant_fiber).toBeGreaterThan(100);
  });

  it('Johnston organ wind/gravity neurons drive aBN1', () => {
    const { a } = run({ jo_wind_gravity: 150 });
    console.info(`JO: aBN1 ${a.setRatesHz.abn1.toFixed(1)} Hz, aDN1 ${a.setRatesHz.adn1.toFixed(1)} Hz`);
    expect(a.setRatesHz.abn1).toBeGreaterThan(10);
  });

  it('silencing MN9 inputs from the sugar pathway: silencing the GRNs abolishes MN9', () => {
    const sim = new Simulator(c, 1);
    sim.stimulate('shiu_sugar_r', 150);
    sim.silence({ setId: 'shiu_sugar_r' });
    sim.step(1000);
    expect(sim.getActivity().setRatesHz.mn9).toBe(0);
  });
});

describe('golden snapshots (exact, fixed seeds)', () => {
  it.each([
    ['shiu_sugar_r', 100, 1],
    ['vpn_looming', 150, 2],
    ['jo_wind_gravity', 150, 3],
  ])('%s @ %i Hz, seed %i', (set, hz, seed) => {
    const { a, active } = run({ [set]: hz }, 500, seed);
    const readouts = Object.fromEntries(
      ['mn9', 'giant_fiber', 'adn1', 'abn1'].map((r) => [r, Number(a.setRatesHz[r].toFixed(3))]),
    );
    expect({ totalSpikes: a.totalSpikes, active, readouts }).toMatchSnapshot();
  });
});
