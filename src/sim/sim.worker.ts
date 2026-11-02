/// <reference lib="webworker" />
import { mergeConnectome, modelSize, toGroups, type Grouping, type MergedModel, type ModelSize } from './compress';
import { Simulator } from './engine';
import { loadConnectome } from './format';
import type { CompressionSettings, FromWorker, ToWorker } from './protocol';
import type { Connectome, SilenceTarget } from './types';

const FRAME_MS = 33; // ~30 activity frames per second to the UI
const COMPUTE_BUDGET_MS = 25; // leave the worker responsive to messages
const CHUNK_MS = 1; // simulated ms per compute chunk

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let base: Simulator | null = null; // the full connectome; always receives every command
let merged: { model: MergedModel; sim: Simulator } | null = null; // runs instead of `base` while merging is on
let grouping: Grouping | null = null;
let seed = 1;
let speed = 0;
let lastWall = 0;
let model: ModelSize = { nodes: 0, edges: 0, weightBits: 0, bytes: 0 };
let maxSynapses = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let settings: CompressionSettings = { minSynapses: 5, weightBits: null, merge: false };

// What the user has switched on, replayed onto a freshly built merged simulator.
const stimuli = new Map<string, { setId?: string; indices?: number[]; rateHz: number }>();
let silences: Array<{ target: SilenceTarget; on: boolean }> = [];

function post(msg: FromWorker, transfer: Transferable[] = []): void {
  ctx.postMessage(msg, transfer);
}

const running = (): Simulator | null => merged?.sim ?? base;

/** Spiking merged nodes stand for all their members, so the UI keeps receiving original neuron indices. */
function expandGroups(groups: Uint32Array, m: MergedModel): Uint32Array {
  let n = 0;
  for (const g of groups) n += m.memberPtr[g + 1] - m.memberPtr[g];
  const out = new Uint32Array(n);
  let k = 0;
  for (const g of groups) for (let j = m.memberPtr[g]; j < m.memberPtr[g + 1]; j++) out[k++] = m.members[j];
  return out.sort();
}

function postFrame(advancedMs: number, wallMs: number): void {
  const sim = running();
  if (!sim) return;
  const activity = sim.getActivity();
  if (merged) activity.spikedIndices = expandGroups(activity.spikedIndices, merged.model);
  post(
    { type: 'frame', activity, realtimeFactor: wallMs > 0 ? advancedMs / wallMs : 0, speed, activeEdges: model.edges, model },
    [activity.spikedIndices.buffer, activity.neuropilSpikes.buffer],
  );
}

function loop(): void {
  timer = null;
  const sim = running();
  if (!sim || speed <= 0) return;
  const now = performance.now();
  const wall = Math.min(now - lastWall, 100); // after a stall, do not try to catch up more than 100 ms
  lastWall = now;
  const target = wall * speed;
  let advanced = 0;
  const t0 = performance.now();
  while (advanced < target && performance.now() - t0 < COMPUTE_BUDGET_MS) {
    const chunk = Math.min(CHUNK_MS, target - advanced);
    sim.step(chunk);
    advanced += chunk;
  }
  postFrame(advanced, wall);
  timer = setTimeout(loop, Math.max(0, FRAME_MS - (performance.now() - now)));
}

function startLoop(): void {
  if (timer !== null || speed <= 0) return;
  lastWall = performance.now();
  timer = setTimeout(loop, FRAME_MS);
}

function maxMagnitude(c: Connectome): number {
  let m = 0;
  for (let e = 0; e < c.weight.length; e++) m = Math.max(m, Math.abs(c.weight[e]));
  return m;
}

function mapTarget(target: SilenceTarget, m: MergedModel): SilenceTarget {
  return 'indices' in target ? { indices: toGroups(m, target.indices) } : target;
}

/** Apply pruning/quantisation to the full graph and (re)build or drop the merged graph. */
function applyCompression(next: CompressionSettings): void {
  if (!base) return;
  if (next.merge && !grouping) throw new Error('Merging needs a neuron grouping (setGrouping) first');
  const rebuild = next.merge && (!merged || next.minSynapses !== settings.minSynapses);
  const switched = next.merge !== settings.merge;
  settings = next;
  base.setPruning({ minSynapses: next.minSynapses, weightBits: next.weightBits });
  if (!next.merge) {
    merged = null;
    if (switched) base.reset(seed);
  } else {
    if (rebuild) {
      const m = mergeConnectome(base.connectome, grouping!, next.minSynapses);
      const sim = new Simulator(m.connectome, seed);
      merged = { model: m, sim };
      for (const [key, s] of stimuli) {
        if (s.setId) sim.stimulate(s.setId, s.rateHz);
        else sim.stimulateIndices(key, toGroups(m, s.indices ?? []), s.rateHz);
      }
      for (const s of silences) sim.silence(mapTarget(s.target, m), s.on);
    }
    merged!.sim.setPruning({ minSynapses: 0, weightBits: next.weightBits }); // weak edges were dropped before merging
  }
  const sim = running()!;
  model = modelSize({
    nodes: sim.connectome.neuronCount,
    edges: sim.activeEdgeCount(),
    quantBits: next.weightBits,
    maxSynapses: merged ? maxMagnitude(sim.connectome) : maxSynapses,
    integerWeights: !merged,
  });
}

async function handle(msg: ToWorker): Promise<void> {
  if (msg.type === 'init') {
    const c = await loadConnectome(msg.baseUrl, (loadedBytes, totalBytes) =>
      post({ type: 'progress', loadedBytes, totalBytes }),
    );
    seed = msg.seed;
    base = new Simulator(c, seed);
    maxSynapses = maxMagnitude(c);
    applyCompression(settings);
    post({
      type: 'ready',
      info: { neuronCount: c.neuronCount, edgeCount: c.edgeCount, neuropils: c.neuropils, sets: c.sets, primaryNeuropil: c.primaryNeuropil },
    });
    return;
  }
  if (!base) throw new Error(`Simulator not initialised (got "${msg.type}")`);
  switch (msg.type) {
    case 'stimulate':
      base.stimulate(msg.setId, msg.rateHz);
      merged?.sim.stimulate(msg.setId, msg.rateHz);
      if (msg.rateHz === 0) stimuli.delete(msg.setId);
      else stimuli.set(msg.setId, { setId: msg.setId, rateHz: msg.rateHz });
      break;
    case 'stimulateIndices':
      base.stimulateIndices(msg.key, msg.indices, msg.rateHz);
      if (merged) merged.sim.stimulateIndices(msg.key, toGroups(merged.model, msg.indices), msg.rateHz);
      if (msg.rateHz === 0) stimuli.delete(msg.key);
      else stimuli.set(msg.key, { indices: msg.indices, rateHz: msg.rateHz });
      break;
    case 'silence':
      base.silence(msg.target, msg.on);
      if (merged) merged.sim.silence(mapTarget(msg.target, merged.model), msg.on);
      silences.push({ target: msg.target, on: msg.on });
      break;
    case 'clearSilence':
      base.clearSilence();
      merged?.sim.clearSilence();
      silences = [];
      break;
    case 'setPruning':
      applyCompression({ ...settings, ...msg.params });
      break;
    case 'setGrouping':
      if (msg.groupOf.length !== base.connectome.neuronCount) throw new Error('Grouping does not match the connectome');
      grouping = { groupOf: msg.groupOf, groupCount: msg.groupCount };
      merged = null;
      if (settings.merge) applyCompression(settings);
      break;
    case 'setCompression':
      applyCompression(msg.settings);
      break;
    case 'setSpeed':
      if (!(msg.speed >= 0 && msg.speed <= 1)) throw new Error(`Speed must be within 0..1, got ${msg.speed}`);
      speed = msg.speed;
      startLoop();
      break;
    case 'stepOnce': {
      running()!.step(msg.ms);
      postFrame(0, 0); // a manual step has no meaningful speed
      break;
    }
    case 'reset':
      seed = msg.seed;
      base.reset(seed);
      merged?.sim.reset(seed);
      postFrame(0, 0);
      break;
    case 'connections':
      post({ type: 'connections', requestId: msg.requestId, result: base.connections(msg.neuron) });
      break;
  }
}

ctx.onmessage = (e: MessageEvent<ToWorker>) => {
  handle(e.data).catch((err: unknown) => {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  });
};
