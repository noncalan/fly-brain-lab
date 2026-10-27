import { DEFAULT_PRUNING, SHIU_PARAMS } from './params';
import { mulberry32 } from './rng';
import type { ActivitySnapshot, Connectome, ModelParams, NeuronConnections, PruningParams, SilenceTarget, Synapse } from './types';

/** Below this |v - v_rest| and |g| (mV) a neuron is snapped to rest and leaves the active list. */
const QUIESCENT_MV = 1e-4;

/**
 * Event-driven leaky integrate-and-fire network with the equations of Shiu et al. 2024:
 *   dv/dt = (v_rest - v + g) / tau_m,   dg/dt = -g / tau_s,   g += w on a presynaptic spike after a delay.
 * Both variables are frozen while refractory (Brian2 "unless refractory"); reset sets v = v_rest and g = 0.
 * The pair of linear ODEs is integrated exactly per step, as Brian2's "linear" method does.
 * Only neurons away from rest are updated, so cost scales with activity, not with network size.
 */
export class Simulator {
  readonly connectome: Connectome;
  readonly params: ModelParams;

  private readonly x: Float32Array; // v - v_rest
  private readonly g: Float32Array;
  private readonly refractory: Uint16Array; // steps left
  private readonly isActive: Uint8Array;
  private active: Int32Array;
  private activeLen = 0;

  private readonly effWeight: Float32Array; // mV per edge after pruning, 0 = pruned
  private readonly silenced: Uint8Array;
  private readonly poissonRate: Float32Array; // Hz per neuron, 0 = not stimulated
  private stimulusRates = new Map<string, { indices: number[]; rateHz: number }>();
  private poissonList: Int32Array = new Int32Array(0);

  private readonly delaySteps: number;
  private readonly refractorySteps: number;
  private readonly ring: number[][];
  private readonly decayM: number;
  private readonly decayS: number;
  private readonly coupling: number;
  private readonly thresholdX: number;

  private rng: () => number;
  private stepIndex = 0;
  private pendingMs = 0;
  private pruning: PruningParams = { ...DEFAULT_PRUNING };

  private readonly spikeCount: Uint16Array;
  private spikedList: number[] = [];
  private windowStartStep = 0;

  constructor(connectome: Connectome, seed = 1, params: ModelParams = SHIU_PARAMS) {
    this.connectome = connectome;
    this.params = params;
    const n = connectome.neuronCount;
    this.x = new Float32Array(n);
    this.g = new Float32Array(n);
    this.refractory = new Uint16Array(n);
    this.isActive = new Uint8Array(n);
    this.active = new Int32Array(1024);
    this.effWeight = new Float32Array(connectome.edgeCount);
    this.silenced = new Uint8Array(n);
    this.poissonRate = new Float32Array(n);
    this.spikeCount = new Uint16Array(n);

    const dt = params.dtMs;
    this.delaySteps = Math.round(params.delayMs / dt);
    this.refractorySteps = Math.round(params.refractoryMs / dt);
    this.ring = Array.from({ length: this.delaySteps + 1 }, () => []);
    this.decayM = Math.exp(-dt / params.tauMembraneMs);
    this.decayS = Math.exp(-dt / params.tauSynapseMs);
    this.coupling = params.tauSynapseMs / (params.tauSynapseMs - params.tauMembraneMs);
    this.thresholdX = params.vThresholdMv - params.vRestMv;
    this.rng = mulberry32(seed);
    this.applyPruning();
  }

  // ---------- public API ----------

  get timeMs(): number {
    return this.stepIndex * this.params.dtMs;
  }

  /** Advance simulated time by `dtMs` (accumulates fractions of a step). */
  step(dtMs: number): void {
    this.pendingMs += dtMs;
    const steps = Math.floor(this.pendingMs / this.params.dtMs + 1e-9);
    this.pendingMs -= steps * this.params.dtMs;
    for (let s = 0; s < steps; s++) this.stepOnce();
  }

  /** Drive a named set with independent Poisson input at `rateHz` per neuron (0 stops it). */
  stimulate(setId: string, rateHz: number): void {
    this.stimulateIndices(setId, this.setIndices(setId), rateHz);
  }

  /** Same as `stimulate` for an arbitrary neuron list registered under `key` (optogenetics on single cells). */
  stimulateIndices(key: string, indices: number[], rateHz: number): void {
    if (!(rateHz >= 0)) throw new Error(`Invalid rate ${rateHz}`);
    if (rateHz === 0) this.stimulusRates.delete(key);
    else this.stimulusRates.set(key, { indices: [...indices], rateHz });
    this.rebuildPoisson();
  }

  /** Silence neurons the way Shiu et al. do: all their outgoing synapses carry zero weight. */
  silence(target: SilenceTarget, on = true): void {
    for (const i of this.resolveTarget(target)) this.silenced[i] = on ? 1 : 0;
  }

  clearSilence(): void {
    this.silenced.fill(0);
  }

  setPruning(params: Partial<PruningParams>): void {
    const next = { ...this.pruning, ...params };
    if (!(next.minSynapses >= 1)) throw new Error('minSynapses must be >= 1');
    if (next.weightBits !== null && !(Number.isInteger(next.weightBits) && next.weightBits >= 1 && next.weightBits <= 15)) {
      throw new Error('weightBits must be an integer 1..15 or null');
    }
    this.pruning = next;
    this.applyPruning();
  }

  getPruning(): PruningParams {
    return { ...this.pruning };
  }

  /** Number of edges that currently carry a non-zero weight. */
  activeEdgeCount(): number {
    let k = 0;
    for (let e = 0; e < this.effWeight.length; e++) if (this.effWeight[e] !== 0) k++;
    return k;
  }

  /** Strongest inputs and outputs of one neuron by synapse count (sign: negative = inhibitory). */
  connections(neuron: number, top = 8): NeuronConnections {
    const { rowPtr, col, weight, neuronCount } = this.connectome;
    if (!(neuron >= 0 && neuron < neuronCount)) throw new Error(`No neuron ${neuron}`);
    const outputs: Synapse[] = [];
    for (let j = rowPtr[neuron]; j < rowPtr[neuron + 1]; j++) outputs.push({ neuron: col[j], synapses: weight[j] });
    const inputs: Synapse[] = [];
    for (let pre = 0; pre < neuronCount; pre++) {
      for (let j = rowPtr[pre], end = rowPtr[pre + 1]; j < end; j++) if (col[j] === neuron) inputs.push({ neuron: pre, synapses: weight[j] });
    }
    const byStrength = (a: Synapse, b: Synapse) => Math.abs(b.synapses) - Math.abs(a.synapses);
    return {
      neuron,
      inputCount: inputs.length,
      outputCount: outputs.length,
      inputs: inputs.sort(byStrength).slice(0, top),
      outputs: outputs.sort(byStrength).slice(0, top),
    };
  }

  /** Activity since the previous call; resets the window. */
  getActivity(): ActivitySnapshot {
    const { neuropils, primaryNeuropil, sets } = this.connectome;
    const windowMs = (this.stepIndex - this.windowStartStep) * this.params.dtMs;
    const spiked = Uint32Array.from(this.spikedList).sort();
    const neuropilSpikes = new Uint32Array(neuropils.length);
    let totalSpikes = 0;
    for (const i of spiked) {
      const c = this.spikeCount[i];
      totalSpikes += c;
      const p = primaryNeuropil[i];
      if (p < neuropils.length) neuropilSpikes[p] += c;
    }
    const setRatesHz: Record<string, number> = {};
    for (const [id, s] of Object.entries(sets)) {
      let c = 0;
      for (const i of s.indices) c += this.spikeCount[i];
      setRatesHz[id] = windowMs > 0 && s.indices.length > 0 ? (c / s.indices.length) * (1000 / windowMs) : 0;
    }
    for (const i of spiked) this.spikeCount[i] = 0;
    this.spikedList = [];
    this.windowStartStep = this.stepIndex;
    return { timeMs: this.timeMs, windowMs, spikedIndices: spiked, neuropilSpikes, setRatesHz, totalSpikes };
  }

  /** Back to rest; keeps stimuli, silencing and pruning. */
  reset(seed = 1): void {
    this.x.fill(0);
    this.g.fill(0);
    this.refractory.fill(0);
    this.isActive.fill(0);
    this.activeLen = 0;
    for (const slot of this.ring) slot.length = 0;
    this.spikeCount.fill(0);
    this.spikedList = [];
    this.stepIndex = 0;
    this.windowStartStep = 0;
    this.pendingMs = 0;
    this.rng = mulberry32(seed);
  }

  // ---------- internals ----------

  private setIndices(setId: string): number[] {
    const s = this.connectome.sets[setId];
    if (!s) throw new Error(`Unknown neuron set "${setId}"`);
    return s.indices;
  }

  private resolveTarget(target: SilenceTarget): number[] {
    if ('setId' in target) return this.setIndices(target.setId);
    if ('indices' in target) return target.indices;
    const p = this.connectome.neuropils.indexOf(target.neuropil);
    if (p < 0) throw new Error(`Unknown neuropil "${target.neuropil}"`);
    const out: number[] = [];
    this.connectome.primaryNeuropil.forEach((v, i) => {
      if (v === p) out.push(i);
    });
    return out;
  }

  private rebuildPoisson(): void {
    this.poissonRate.fill(0);
    for (const { indices, rateHz } of this.stimulusRates.values()) {
      for (const i of indices) this.poissonRate[i] = Math.max(this.poissonRate[i], rateHz);
    }
    const list: number[] = [];
    this.poissonRate.forEach((r, i) => {
      if (r > 0) list.push(i);
    });
    this.poissonList = Int32Array.from(list);
  }

  private applyPruning(): void {
    const { weight } = this.connectome;
    const { minSynapses, weightBits } = this.pruning;
    const wSyn = this.params.weightPerSynapseMv;
    const quantise = weightBits === null ? null : makeLogQuantiser(weight, minSynapses, weightBits);
    for (let e = 0; e < weight.length; e++) {
      const w = weight[e];
      const mag = Math.abs(w);
      if (mag < minSynapses) {
        this.effWeight[e] = 0;
        continue;
      }
      const q = quantise ? quantise(mag) : mag;
      this.effWeight[e] = Math.sign(w) * q * wSyn;
    }
  }

  private activate(i: number): void {
    if (this.isActive[i]) return;
    this.isActive[i] = 1;
    if (this.activeLen === this.active.length) {
      const grown = new Int32Array(this.active.length * 2);
      grown.set(this.active);
      this.active = grown;
    }
    this.active[this.activeLen++] = i;
  }

  private stepOnce(): void {
    const { x, g, refractory, isActive, spikeCount } = this;
    const { decayM, decayS, coupling, thresholdX } = this;
    const out = this.ring[(this.stepIndex + this.delaySteps) % this.ring.length];

    // 1-2. integrate, threshold, reset (active neurons only)
    let keep = 0;
    const active = this.active;
    for (let k = 0; k < this.activeLen; k++) {
      const i = active[k];
      if (refractory[i] > 0) {
        refractory[i]--;
        active[keep++] = i;
        continue;
      }
      const gi = g[i];
      let xi = (x[i] - coupling * gi) * decayM + coupling * gi * decayS;
      const gn = gi * decayS;
      if (xi > thresholdX) {
        xi = 0;
        g[i] = 0;
        refractory[i] = this.poissonRate[i] > 0 ? 0 : this.refractorySteps;
        if (spikeCount[i] === 0) this.spikedList.push(i);
        if (spikeCount[i] < 0xffff) spikeCount[i]++;
        out.push(i);
      } else {
        g[i] = gn;
      }
      x[i] = xi;
      if (refractory[i] === 0 && Math.abs(xi) < QUIESCENT_MV && Math.abs(g[i]) < QUIESCENT_MV) {
        x[i] = 0;
        g[i] = 0;
        isActive[i] = 0;
      } else {
        active[keep++] = i;
      }
    }
    this.activeLen = keep;

    // 3. deliver spikes emitted delaySteps ago
    const slot = this.ring[this.stepIndex % this.ring.length];
    const { rowPtr, col } = this.connectome;
    const effWeight = this.effWeight;
    for (let s = 0; s < slot.length; s++) {
      const pre = slot[s];
      if (this.silenced[pre]) continue;
      for (let j = rowPtr[pre], end = rowPtr[pre + 1]; j < end; j++) {
        const w = effWeight[j];
        if (w === 0) continue;
        const post = col[j];
        g[post] += w;
        this.activate(post);
      }
    }
    slot.length = 0;

    // 4. Poisson input (optogenetic-style activation): a direct voltage kick
    const kick = this.params.weightPerSynapseMv * this.params.poissonWeightFactor;
    const pStep = this.params.dtMs / 1000;
    const list = this.poissonList;
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      if (this.rng() < this.poissonRate[i] * pStep) {
        x[i] += kick;
        this.activate(i);
      }
    }
    this.stepIndex++;
  }
}

/** Map a synapse count to one of 2^bits levels spaced evenly in log space between minSynapses and the max count. */
export function makeLogQuantiser(weight: Int16Array, minSynapses: number, bits: number): (mag: number) => number {
  let max = minSynapses;
  for (let e = 0; e < weight.length; e++) max = Math.max(max, Math.abs(weight[e]));
  const levels = 2 ** bits;
  const lo = Math.log(minSynapses);
  const span = Math.log(max) - lo;
  if (span === 0 || levels === 1) return () => Math.sqrt(minSynapses * max);
  const step = span / (levels - 1);
  return (mag) => Math.exp(lo + Math.round((Math.log(mag) - lo) / step) * step);
}
