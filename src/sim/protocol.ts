import type { ActivitySnapshot, NeuronConnections, NeuronSet, PruningParams, SilenceTarget } from './types';

/** Messages from the main thread to the simulation worker. */
export type ToWorker =
  | { type: 'init'; baseUrl: string; seed: number }
  | { type: 'stimulate'; setId: string; rateHz: number }
  | { type: 'stimulateIndices'; key: string; indices: number[]; rateHz: number }
  | { type: 'silence'; target: SilenceTarget; on: boolean }
  | { type: 'clearSilence' }
  | { type: 'setPruning'; params: Partial<PruningParams> }
  /** Simulated ms per wall-clock ms; 0 pauses. */
  | { type: 'setSpeed'; speed: number }
  | { type: 'stepOnce'; ms: number }
  | { type: 'reset'; seed: number }
  | { type: 'connections'; requestId: number; neuron: number };

export interface ConnectomeInfo {
  neuronCount: number;
  edgeCount: number;
  neuropils: string[];
  sets: Record<string, NeuronSet>;
  primaryNeuropil: Uint8Array;
}

/** Messages from the worker to the main thread. */
export type FromWorker =
  | { type: 'progress'; loadedBytes: number; totalBytes: number }
  | { type: 'ready'; info: ConnectomeInfo }
  | {
      type: 'frame';
      activity: ActivitySnapshot;
      /** Simulated ms advanced per wall ms over the last frame (what the user actually gets). */
      realtimeFactor: number;
      speed: number;
      activeEdges: number;
    }
  | { type: 'connections'; requestId: number; result: NeuronConnections }
  | { type: 'error'; message: string };
