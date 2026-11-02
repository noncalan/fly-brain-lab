import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { parseAtlas } from '../lab/atlas';
import { groupByTypeAndSide, mergeConnectome, modelSize, toGroups } from './compress';
import { Simulator } from './engine';
import { loadBuiltConnectome, syntheticConnectome } from './testing';

describe('groupByTypeAndSide', () => {
  it('merges same type and side, keeps sides apart and untyped neurons alone', () => {
    // types: 0 = untyped; sides: 1 left, 2 right
    const g = groupByTypeAndSide([1, 1, 1, 0, 0, 2], [1, 1, 2, 1, 1, 1]);
    expect(g.groupCount).toBe(5);
    expect(g.groupOf[0]).toBe(g.groupOf[1]);
    expect(g.groupOf[2]).not.toBe(g.groupOf[0]);
    expect(g.groupOf[3]).not.toBe(g.groupOf[4]);
  });
});

describe('mergeConnectome', () => {
  // neurons 0,1 = type A; 2,3 = type B; 4 = alone
  const c = syntheticConnectome(
    5,
    [
      [0, 2, 10],
      [0, 3, 20],
      [1, 2, 30],
      [1, 4, -8],
      [0, 4, 6],
      [2, 0, 4], // below 5 synapses: dropped when minSynapses = 5
    ],
    { a: [0], b: [2, 3] },
  );
  const grouping = { groupOf: Uint32Array.from([0, 0, 1, 1, 2]), groupCount: 3 };

  it('weight A→B = summed synapses / size of B; nets excitation and inhibition; prunes first', () => {
    const m = mergeConnectome(c, grouping, 5);
    const g = m.connectome;
    expect(g.neuronCount).toBe(3);
    const edges: Array<[number, number, number]> = [];
    for (let a = 0; a < 3; a++) for (let j = g.rowPtr[a]; j < g.rowPtr[a + 1]; j++) edges.push([a, g.col[j], g.weight[j]]);
    // A→B: (10 + 20 + 30) / 2 = 30; A→C: (6 - 8) / 1 = -2; B→A dropped (4 < 5)
    expect(edges).toEqual([
      [0, 1, 30],
      [0, 2, -2],
    ]);
  });

  it('keeps weak edges when minSynapses is lower', () => {
    const m = mergeConnectome(c, grouping, 1);
    expect(m.connectome.edgeCount).toBe(3);
  });

  it('maps named sets onto groups and lists members', () => {
    const m = mergeConnectome(c, grouping, 5);
    expect(m.connectome.sets.a.indices).toEqual([0]);
    expect(m.connectome.sets.b.indices).toEqual([1]);
    expect(toGroups(m, [4, 1, 0])).toEqual([0, 2]);
    expect(Array.from(m.members.slice(m.memberPtr[1], m.memberPtr[2]))).toEqual([2, 3]);
  });

  it('a merged network runs in the simulator: driving A makes B fire', () => {
    const m = mergeConnectome(c, grouping, 5);
    const sim = new Simulator(m.connectome, 1);
    sim.setPruning({ minSynapses: 0 });
    sim.stimulate('a', 200);
    sim.step(1000);
    expect(sim.getActivity().setRatesHz.b).toBeGreaterThan(0);
  });

  it('rejects a grouping of the wrong size', () => {
    expect(() => mergeConnectome(c, { groupOf: new Uint32Array(3), groupCount: 1 }, 5)).toThrow();
  });
});

describe('modelSize', () => {
  it('counts bit-packed CSR exactly', () => {
    // 4 nodes, 3 edges: row pointers 5 × 2 bits, targets 3 × 2 bits, weights 3 × (ceil(log2 51) = 6, + sign = 7)
    expect(modelSize({ nodes: 4, edges: 3, quantBits: null, maxSynapses: 50, integerWeights: true })).toEqual({
      nodes: 4,
      edges: 3,
      weightBits: 7,
      bytes: Math.ceil((5 * 2 + 3 * 2 + 3 * 7) / 8),
    });
  });

  it('quantised weights cost bits + sign plus a codebook; fractional exact weights cost 32 bits', () => {
    const q = modelSize({ nodes: 4, edges: 3, quantBits: 2, maxSynapses: 50, integerWeights: true });
    expect(q.weightBits).toBe(3);
    expect(q.bytes).toBe(Math.ceil((5 * 2 + 3 * 2 + 3 * 3 + 4 * 32) / 8));
    expect(modelSize({ nodes: 4, edges: 3, quantBits: null, maxSynapses: 50, integerWeights: false }).weightBits).toBe(32);
  });
});

function loadBuiltGrouping() {
  const dir = resolve(__dirname, '../../public/data');
  const { file } = JSON.parse(readFileSync(resolve(dir, 'neurons.json'), 'utf8')) as { file: string };
  const raw = gunzipSync(readFileSync(resolve(dir, file)));
  const c = loadBuiltConnectome();
  const atlas = parseAtlas(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer, c.neuronCount);
  return groupByTypeAndSide(atlas.typeOf, atlas.sideOf);
}

describe('real connectome', () => {
  it('merging by type and side keeps every neuron in exactly one group and shrinks the graph', () => {
    const c = loadBuiltConnectome();
    const grouping = loadBuiltGrouping();
    const m = mergeConnectome(c, grouping, 5);
    expect(m.memberPtr[grouping.groupCount]).toBe(c.neuronCount);
    expect(m.connectome.neuronCount).toBe(grouping.groupCount);
    expect(m.connectome.neuronCount).toBeLessThan(c.neuronCount);
    expect(m.connectome.edgeCount).toBeLessThan(c.edgeCount);
    for (const id of Object.keys(c.sets)) expect(m.connectome.sets[id].indices.length, id).toBeGreaterThan(0);
  });
});
