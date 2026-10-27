/** Public types of the simulation core. Units: time in ms, rates in Hz, voltages in mV. */

export interface NeuronSet {
  kind: 'stimulus' | 'readout';
  source: string;
  rule: string;
  note: string;
  indices: number[];
}

export interface Connectome {
  neuronCount: number;
  edgeCount: number;
  /** CSR over presynaptic neurons, length neuronCount + 1. */
  rowPtr: Uint32Array;
  /** Postsynaptic index per edge. */
  col: Uint32Array;
  /** Signed synapse count per edge (negative = inhibitory). */
  weight: Int16Array;
  /** Index into `neuropils` per neuron, 255 = none. */
  primaryNeuropil: Uint8Array;
  neuropils: string[];
  sets: Record<string, NeuronSet>;
}

export interface ModelParams {
  dtMs: number;
  vRestMv: number;
  vThresholdMv: number;
  tauMembraneMs: number;
  tauSynapseMs: number;
  refractoryMs: number;
  delayMs: number;
  /** mV per synapse. */
  weightPerSynapseMv: number;
  /** Multiplier of weightPerSynapseMv for one Poisson input spike. */
  poissonWeightFactor: number;
}

export interface PruningParams {
  /** Drop connections with fewer synapses than this (the loaded graph already has >= 5). */
  minSynapses: number;
  /** Quantise |synapse count| to 2^bits log-spaced levels; null keeps exact counts. */
  weightBits: number | null;
}

/** A silencing target: a named set, a neuropil name, or explicit neuron indices. */
export type SilenceTarget = { setId: string } | { neuropil: string } | { indices: number[] };

export interface ActivitySnapshot {
  /** Simulated time at the end of the window. */
  timeMs: number;
  windowMs: number;
  /** Neurons that spiked at least once in the window (unique, ascending). */
  spikedIndices: Uint32Array;
  /** Spike count per neuropil in the window (same order as Connectome.neuropils). */
  neuropilSpikes: Uint32Array;
  /** Mean rate per neuron of each named set over the window. */
  setRatesHz: Record<string, number>;
  totalSpikes: number;
}

export interface Synapse {
  neuron: number;
  /** signed synapse count, negative = inhibitory */
  synapses: number;
}

export interface NeuronConnections {
  neuron: number;
  inputCount: number;
  outputCount: number;
  inputs: Synapse[];
  outputs: Synapse[];
}
