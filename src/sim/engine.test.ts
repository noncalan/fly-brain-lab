import { describe, expect, it } from 'vitest';
import { Simulator, makeLogQuantiser } from './engine';
import { SHIU_PARAMS } from './params';
import { syntheticConnectome } from './testing';

const P = SHIU_PARAMS;
const DELAY_STEPS = Math.round(P.delayMs / P.dtMs);

/** Make neuron 0 of `sim` fire on the first step, then stop driving it. */
function fireOnce(sim: Simulator): void {
  sim.stimulate('s', 1e6);
  sim.step(P.dtMs);
  sim.stimulate('s', 0);
}

describe('Simulator on synthetic networks', () => {
  it('stays silent without input', () => {
    const sim = new Simulator(syntheticConnectome(3, [[0, 1, 10]]));
    sim.step(100);
    expect(sim.getActivity().totalSpikes).toBe(0);
  });

  it('a stimulated neuron fires close to the Poisson rate (no refractory for stimulated neurons)', () => {
    const sim = new Simulator(syntheticConnectome(1, [], { s: [0] }), 7);
    sim.stimulate('s', 200);
    sim.step(5000);
    const rate = sim.getActivity().setRatesHz.s;
    expect(rate).toBeGreaterThan(180);
    expect(rate).toBeLessThan(220);
  });

  it('delivers a spike after the synaptic delay, not before', () => {
    const sim = new Simulator(syntheticConnectome(2, [[0, 1, 2000]], { s: [0] }), 1);
    fireOnce(sim);
    sim.getActivity();
    sim.step(DELAY_STEPS * P.dtMs);
    expect(Array.from(sim.getActivity().spikedIndices)).not.toContain(1);
    sim.step(5 * P.dtMs);
    expect(Array.from(sim.getActivity().spikedIndices)).toContain(1);
  });

  it('integrates the subthreshold response exactly (closed form of the two linear ODEs)', () => {
    const w = 10; // 2.75 mV jump in g, far below threshold
    const sim = new Simulator(syntheticConnectome(2, [[0, 1, w]], { s: [0] }), 1);
    fireOnce(sim); // kick lands at the end of step 0, neuron 0 spikes in step 1
    sim.step((DELAY_STEPS + 1) * P.dtMs); // spike delivered into g of neuron 1 at the end of step 1 + DELAY_STEPS
    const t = 10;
    sim.step(t);
    const x = (sim as unknown as { x: Float32Array }).x[1];
    const g0 = w * P.weightPerSynapseMv;
    const c = P.tauSynapseMs / (P.tauSynapseMs - P.tauMembraneMs);
    const expected = -c * g0 * Math.exp(-t / P.tauMembraneMs) + c * g0 * Math.exp(-t / P.tauSynapseMs);
    expect(x).toBeCloseTo(expected, 4);
  });

  it('enforces the refractory period for driven (non-Poisson) neurons', () => {
    const sim = new Simulator(syntheticConnectome(2, [[0, 1, 30000]], { s: [0], r: [1] }), 1);
    sim.stimulate('s', 1e6);
    sim.step(1000);
    const maxRate = 1000 / (P.refractoryMs + P.dtMs);
    const rate = sim.getActivity().setRatesHz.r;
    expect(rate).toBeGreaterThan(maxRate / 2);
    expect(rate).toBeLessThanOrEqual(maxRate + 1);
  });

  it('inhibitory edges reduce firing', () => {
    const net = syntheticConnectome(3, [[0, 2, 2000], [1, 2, -4000]], { e: [0], i: [1], out: [2] });
    const inhibited = new Simulator(net, 3);
    inhibited.stimulate('e', 100);
    inhibited.stimulate('i', 400);
    inhibited.step(1000);
    const free = new Simulator(net, 3);
    free.stimulate('e', 100);
    free.step(1000);
    expect(inhibited.getActivity().setRatesHz.out).toBeLessThan(free.getActivity().setRatesHz.out / 2);
  });

  it('silencing a neuron removes its output, like Shiu et al.', () => {
    const sim = new Simulator(syntheticConnectome(2, [[0, 1, 2000]], { s: [0], out: [1] }), 1);
    sim.stimulate('s', 100);
    sim.silence({ setId: 's' });
    sim.step(1000);
    const a = sim.getActivity();
    expect(a.setRatesHz.s).toBeGreaterThan(50);
    expect(a.setRatesHz.out).toBe(0);
  });

  it('pruning by synapse count removes weak edges and validates input', () => {
    const sim = new Simulator(syntheticConnectome(3, [[0, 1, 6], [0, 2, 50]]));
    expect(sim.activeEdgeCount()).toBe(2);
    sim.setPruning({ minSynapses: 10 });
    expect(sim.activeEdgeCount()).toBe(1);
    expect(() => sim.setPruning({ minSynapses: 0 })).toThrow();
    expect(() => sim.setPruning({ weightBits: 0 })).toThrow();
  });

  it('is deterministic for a seed and differs between seeds', () => {
    const net = syntheticConnectome(1, [], { s: [0] });
    const run = (seed: number) => {
      const sim = new Simulator(net, seed);
      sim.stimulate('s', 100);
      sim.step(1000);
      return sim.getActivity().totalSpikes;
    };
    expect(run(5)).toBe(run(5));
    expect(new Set([run(1), run(2), run(3), run(4)]).size).toBeGreaterThan(1);
  });

  it('reset returns to rest and replays the same seed identically', () => {
    const sim = new Simulator(syntheticConnectome(2, [[0, 1, 2000]], { s: [0] }), 9);
    sim.stimulate('s', 150);
    sim.step(500);
    const first = sim.getActivity().totalSpikes;
    sim.reset(9);
    expect(sim.timeMs).toBe(0);
    sim.step(500);
    expect(sim.getActivity().totalSpikes).toBe(first);
  });

  it('rejects unknown sets and invalid rates', () => {
    const sim = new Simulator(syntheticConnectome(1, []));
    expect(() => sim.stimulate('nope', 10)).toThrow(/Unknown neuron set/);
    expect(() => sim.stimulateIndices('k', [0], -1)).toThrow(/Invalid rate/);
  });
});

describe('makeLogQuantiser', () => {
  it('maps to at most 2^bits levels and keeps the endpoints', () => {
    const w = Int16Array.from([5, 6, 7, 20, 100, 2000]);
    const q = makeLogQuantiser(w, 5, 2);
    const levels = new Set(Array.from(w, (x) => q(x).toFixed(6)));
    expect(levels.size).toBeLessThanOrEqual(4);
    expect(q(5)).toBeCloseTo(5, 6);
    expect(q(2000)).toBeCloseTo(2000, 3);
  });
});
