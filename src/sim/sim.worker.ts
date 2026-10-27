/// <reference lib="webworker" />
import { Simulator } from './engine';
import { loadConnectome } from './format';
import type { FromWorker, ToWorker } from './protocol';

const FRAME_MS = 33; // ~30 activity frames per second to the UI
const COMPUTE_BUDGET_MS = 25; // leave the worker responsive to messages
const CHUNK_MS = 1; // simulated ms per compute chunk

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let sim: Simulator | null = null;
let speed = 0;
let lastWall = 0;
let activeEdges = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

function post(msg: FromWorker, transfer: Transferable[] = []): void {
  ctx.postMessage(msg, transfer);
}

function postFrame(advancedMs: number, wallMs: number): void {
  if (!sim) return;
  const activity = sim.getActivity();
  post(
    { type: 'frame', activity, realtimeFactor: wallMs > 0 ? advancedMs / wallMs : 0, speed, activeEdges },
    [activity.spikedIndices.buffer, activity.neuropilSpikes.buffer],
  );
}

function loop(): void {
  timer = null;
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

async function handle(msg: ToWorker): Promise<void> {
  if (msg.type === 'init') {
    const c = await loadConnectome(msg.baseUrl, (loadedBytes, totalBytes) =>
      post({ type: 'progress', loadedBytes, totalBytes }),
    );
    sim = new Simulator(c, msg.seed);
    activeEdges = sim.activeEdgeCount();
    post({
      type: 'ready',
      info: { neuronCount: c.neuronCount, edgeCount: c.edgeCount, neuropils: c.neuropils, sets: c.sets, primaryNeuropil: c.primaryNeuropil },
    });
    return;
  }
  if (!sim) throw new Error(`Simulator not initialised (got "${msg.type}")`);
  switch (msg.type) {
    case 'stimulate':
      sim.stimulate(msg.setId, msg.rateHz);
      break;
    case 'stimulateIndices':
      sim.stimulateIndices(msg.key, msg.indices, msg.rateHz);
      break;
    case 'silence':
      sim.silence(msg.target, msg.on);
      break;
    case 'clearSilence':
      sim.clearSilence();
      break;
    case 'setPruning':
      sim.setPruning(msg.params);
      activeEdges = sim.activeEdgeCount();
      break;
    case 'setSpeed':
      if (!(msg.speed >= 0 && msg.speed <= 1)) throw new Error(`Speed must be within 0..1, got ${msg.speed}`);
      speed = msg.speed;
      startLoop();
      break;
    case 'stepOnce': {
      sim.step(msg.ms);
      postFrame(0, 0); // a manual step has no meaningful speed
      break;
    }
    case 'reset':
      sim.reset(msg.seed);
      postFrame(0, 0);
      break;
    case 'connections':
      post({ type: 'connections', requestId: msg.requestId, result: sim.connections(msg.neuron) });
      break;
  }
}

ctx.onmessage = (e: MessageEvent<ToWorker>) => {
  handle(e.data).catch((err: unknown) => {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  });
};
