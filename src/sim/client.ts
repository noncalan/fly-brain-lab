import type { ConnectomeInfo, FromWorker, ToWorker } from './protocol';
import type { PruningParams, SilenceTarget } from './types';

type FrameMessage = Extract<FromWorker, { type: 'frame' }>;

export interface SimClientEvents {
  progress: (loadedBytes: number, totalBytes: number) => void;
  frame: (frame: FrameMessage) => void;
  error: (message: string) => void;
}

/** Main-thread handle to the simulation worker. All simulation work happens off the UI thread. */
export class SimClient {
  private readonly worker: Worker;
  private readonly listeners: { [K in keyof SimClientEvents]: Set<SimClientEvents[K]> } = {
    progress: new Set(),
    frame: new Set(),
    error: new Set(),
  };
  readonly ready: Promise<ConnectomeInfo>;

  constructor(baseUrl = `${import.meta.env.BASE_URL}data/`, seed = 1) {
    this.worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
    this.ready = new Promise((resolve, reject) => {
      this.worker.onmessage = (e: MessageEvent<FromWorker>) => {
        const msg = e.data;
        switch (msg.type) {
          case 'ready':
            resolve(msg.info);
            break;
          case 'progress':
            this.listeners.progress.forEach((f) => f(msg.loadedBytes, msg.totalBytes));
            break;
          case 'frame':
            this.listeners.frame.forEach((f) => f(msg));
            break;
          case 'error':
            reject(new Error(msg.message));
            this.listeners.error.forEach((f) => f(msg.message));
            break;
        }
      };
      this.worker.onerror = (e) => {
        reject(new Error(e.message));
        this.listeners.error.forEach((f) => f(e.message));
      };
    });
    this.send({ type: 'init', baseUrl, seed });
  }

  on<K extends keyof SimClientEvents>(event: K, fn: SimClientEvents[K]): () => void {
    this.listeners[event].add(fn);
    return () => this.listeners[event].delete(fn);
  }

  stimulate(setId: string, rateHz: number): void {
    this.send({ type: 'stimulate', setId, rateHz });
  }

  stimulateIndices(key: string, indices: number[], rateHz: number): void {
    this.send({ type: 'stimulateIndices', key, indices, rateHz });
  }

  silence(target: SilenceTarget, on = true): void {
    this.send({ type: 'silence', target, on });
  }

  clearSilence(): void {
    this.send({ type: 'clearSilence' });
  }

  setPruning(params: Partial<PruningParams>): void {
    this.send({ type: 'setPruning', params });
  }

  /** Simulated time per real time, 0 = pause, max 1. */
  setSpeed(speed: number): void {
    this.send({ type: 'setSpeed', speed });
  }

  stepOnce(ms: number): void {
    this.send({ type: 'stepOnce', ms });
  }

  reset(seed = 1): void {
    this.send({ type: 'reset', seed });
  }

  dispose(): void {
    this.worker.terminate();
  }

  private send(msg: ToWorker): void {
    this.worker.postMessage(msg);
  }
}
