// Connectome compression for the "Compress the brain" page: merge neurons of one cell type into one node, and
// count the size of the model a simulator would need to store. Pure functions, run in the worker and in tests.
import type { Connectome, NeuronSet } from './types';

/** Group label per neuron; neurons with the same label become one node. */
export interface Grouping {
  groupOf: Uint32Array;
  groupCount: number;
}

/**
 * One group per (FlyWire cell type, hemisphere); neurons without a cell type (type index 0) stay on their own.
 * Keeping the sides apart preserves left/right readouts (DNa02 steering, one-sided stimuli).
 */
export function groupByTypeAndSide(typeOf: ArrayLike<number>, sideOf: ArrayLike<number>): Grouping {
  const n = typeOf.length;
  const groupOf = new Uint32Array(n);
  const ids = new Map<number, number>();
  let next = 0;
  for (let i = 0; i < n; i++) {
    if (typeOf[i] === 0) {
      groupOf[i] = next++;
      continue;
    }
    const key = typeOf[i] * 4 + (sideOf[i] & 3);
    let g = ids.get(key);
    if (g === undefined) {
      g = next++;
      ids.set(key, g);
    }
    groupOf[i] = g;
  }
  return { groupOf, groupCount: next };
}

export interface MergedModel {
  connectome: Connectome;
  /** group index per original neuron */
  groupOf: Uint32Array;
  /** members of each group, CSR: members[memberPtr[g]..memberPtr[g+1]) */
  memberPtr: Uint32Array;
  members: Uint32Array;
}

/** Unique group indices of a list of neurons, ascending. */
export function toGroups(model: MergedModel, indices: ArrayLike<number>): number[] {
  const out = new Set<number>();
  for (let k = 0; k < indices.length; k++) out.add(model.groupOf[indices[k]]);
  return [...out].sort((a, b) => a - b);
}

const NO_NEUROPIL = 255;

/** Most common primary neuropil of each group's members (ignoring "none" unless that is all there is). */
function groupNeuropils(c: Connectome, memberPtr: Uint32Array, members: Uint32Array): Uint8Array {
  const g = memberPtr.length - 1;
  const out = new Uint8Array(g);
  const votes = new Uint32Array(256);
  for (let a = 0; a < g; a++) {
    for (let m = memberPtr[a]; m < memberPtr[a + 1]; m++) votes[c.primaryNeuropil[members[m]]]++;
    let best = NO_NEUROPIL;
    for (let m = memberPtr[a]; m < memberPtr[a + 1]; m++) {
      const p = c.primaryNeuropil[members[m]];
      if (p !== NO_NEUROPIL && (best === NO_NEUROPIL || votes[p] > votes[best])) best = p;
    }
    for (let m = memberPtr[a]; m < memberPtr[a + 1]; m++) votes[c.primaryNeuropil[members[m]]] = 0;
    out[a] = best;
  }
  return out;
}

/**
 * Collapse each group into one node (mean-field over the members).
 * Edges with fewer than `minSynapses` synapses are dropped first. The merged weight from group A to group B is
 * the signed sum of A→B synapses divided by the size of B: the mean input one member of B gets when every member
 * of A spikes once. It is exact when all members of a group fire together; groups whose members behave differently
 * are where the merged model goes wrong. Excitation and inhibition onto the same target group are netted.
 */
export function mergeConnectome(c: Connectome, grouping: Grouping, minSynapses: number): MergedModel {
  const { groupOf, groupCount: g } = grouping;
  if (groupOf.length !== c.neuronCount) throw new Error(`Grouping has ${groupOf.length} neurons, connectome ${c.neuronCount}`);

  const memberPtr = new Uint32Array(g + 1);
  for (let i = 0; i < c.neuronCount; i++) memberPtr[groupOf[i] + 1]++;
  for (let k = 0; k < g; k++) memberPtr[k + 1] += memberPtr[k];
  const members = new Uint32Array(c.neuronCount);
  const fill = memberPtr.slice(0, g);
  for (let i = 0; i < c.neuronCount; i++) members[fill[groupOf[i]]++] = i;

  const rowPtr = new Uint32Array(g + 1);
  const cols: number[] = [];
  const weights: number[] = [];
  const sum = new Float64Array(g);
  const seen = new Uint8Array(g);
  const touched: number[] = [];
  for (let a = 0; a < g; a++) {
    for (let m = memberPtr[a]; m < memberPtr[a + 1]; m++) {
      const pre = members[m];
      for (let j = c.rowPtr[pre]; j < c.rowPtr[pre + 1]; j++) {
        const w = c.weight[j];
        if (Math.abs(w) < minSynapses) continue;
        const b = groupOf[c.col[j]];
        if (!seen[b]) {
          seen[b] = 1;
          touched.push(b);
        }
        sum[b] += w;
      }
    }
    touched.sort((x, y) => x - y);
    for (const b of touched) {
      const w = sum[b] / (memberPtr[b + 1] - memberPtr[b]);
      sum[b] = 0;
      seen[b] = 0;
      if (w === 0) continue;
      cols.push(b);
      weights.push(w);
    }
    touched.length = 0;
    rowPtr[a + 1] = cols.length;
  }

  const model: MergedModel = {
    connectome: {
      neuronCount: g,
      edgeCount: cols.length,
      rowPtr,
      col: Uint32Array.from(cols),
      weight: Float32Array.from(weights),
      primaryNeuropil: groupNeuropils(c, memberPtr, members),
      neuropils: c.neuropils,
      sets: {},
    },
    groupOf,
    memberPtr,
    members,
  };
  const sets: Record<string, NeuronSet> = {};
  for (const [id, s] of Object.entries(c.sets)) sets[id] = { ...s, indices: toGroups(model, s.indices) };
  model.connectome.sets = sets;
  return model;
}

export interface ModelSize {
  nodes: number;
  edges: number;
  /** bits per stored weight, sign included */
  weightBits: number;
  bytes: number;
}

const bitsFor = (values: number) => Math.max(1, Math.ceil(Math.log2(Math.max(2, values))));

/**
 * Bytes to store a graph a simulator can run, bit-packed and before any general-purpose compression (gzip):
 *   row pointers  (nodes + 1) × ⌈log2(edges + 1)⌉ bits
 *   targets       edges × ⌈log2(nodes)⌉ bits
 *   weights       edges × weight bits, where weight bits =
 *                   quantised: bits + 1 sign bit, plus a codebook of 2^bits 32-bit floats;
 *                   exact integer synapse counts: ⌈log2(max + 1)⌉ + 1 sign bit;
 *                   exact merged (fractional) weights: 32-bit float.
 * Neuron identities, positions and the neuron→group map are display data, not part of the model.
 */
export function modelSize(opts: { nodes: number; edges: number; quantBits: number | null; maxSynapses: number; integerWeights: boolean }): ModelSize {
  const { nodes, edges, quantBits, maxSynapses, integerWeights } = opts;
  let weightBits: number;
  let codebookBits = 0;
  if (quantBits !== null) {
    weightBits = quantBits + 1;
    codebookBits = 2 ** quantBits * 32;
  } else if (integerWeights) {
    weightBits = bitsFor(maxSynapses + 1) + 1;
  } else {
    weightBits = 32;
  }
  const bits = (nodes + 1) * bitsFor(edges + 1) + edges * bitsFor(nodes) + edges * weightBits + codebookBits;
  return { nodes, edges, weightBits, bytes: Math.ceil(bits / 8) };
}
