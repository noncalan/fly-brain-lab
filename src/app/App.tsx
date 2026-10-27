import { useCallback, useRef, useState } from 'react';
import behaviorsConfig from '../../config/behaviors.json';
import stimuliConfig from '../../config/stimuli.json';
import { FlyCanvas } from '../fly/FlyCanvas';
import type { BehaviorState } from '../sim';
import { NeuronCloud, type NeuronCloudHandle } from './NeuronCloud';
import { RegionBars } from './RegionBars';
import { useSimulation, type SimFrame } from './useSimulation';

const SPEEDS = [0, 0.1, 0.5, 1];
const STEP_MS = 10;
/** Simulated time a stimulus must run before we say the model does not reproduce the expected behaviour. */
const VERDICT_AFTER_MS = 1000;
const REGION_SMOOTHING = 0.8;

interface Status {
  timeMs: number;
  realtimeFactor: number;
  behaviors: BehaviorState[];
  regionHz: Float32Array;
}

export function App() {
  const cloudRef = useRef<NeuronCloudHandle>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [activeStimuli, setActiveStimuli] = useState<Record<string, number>>({}); // id -> sim time started
  const regionRef = useRef<Float32Array | null>(null);

  const onFrame = useCallback((f: SimFrame) => {
    cloudRef.current?.addSpikes(f.activity.spikedIndices);
    const { neuropilSpikes, windowMs } = f.activity;
    if (!regionRef.current) regionRef.current = new Float32Array(neuropilSpikes.length);
    const r = regionRef.current;
    if (windowMs > 0) {
      for (let p = 0; p < r.length; p++) {
        r[p] = REGION_SMOOTHING * r[p] + (1 - REGION_SMOOTHING) * (neuropilSpikes[p] * 1000) / windowMs;
      }
    }
    setStatus({ timeMs: f.activity.timeMs, realtimeFactor: f.realtimeFactor, behaviors: f.behaviors, regionHz: r.slice() });
  }, []);

  const sim = useSimulation(onFrame);

  const toggleStimulus = (id: string, set: string, rateHz: number) => {
    setActiveStimuli((prev) => {
      const next = { ...prev };
      if (id in next) {
        delete next[id];
        sim.stimulate(set, 0);
      } else {
        next[id] = status?.timeMs ?? 0;
        sim.stimulate(set, rateHz);
      }
      return next;
    });
  };

  if (sim.load.status === 'error') {
    return <p className="p-6 text-red-400">Simulation failed to load: {sim.load.message}</p>;
  }
  if (sim.load.status === 'loading') {
    const { loadedBytes, totalBytes } = sim.load;
    return (
      <p className="p-6 font-mono text-sm" role="status">
        Loading connectome… {(loadedBytes / 1e6).toFixed(1)}
        {totalBytes > 0 ? ` / ${(totalBytes / 1e6).toFixed(1)}` : ''} MB
      </p>
    );
  }

  const { info } = sim.load;
  const on = (id: string) => status?.behaviors.find((b) => b.id === id)?.active ?? false;
  const notReproduced = stimuliConfig.stimuli.filter(
    (s) =>
      s.id in activeStimuli &&
      s.expects.length > 0 &&
      (status?.timeMs ?? 0) - activeStimuli[s.id] > VERDICT_AFTER_MS &&
      !s.expects.some(on),
  );

  return (
    <main className="mx-auto grid max-w-6xl gap-4 p-4 md:grid-cols-[1fr_1fr]">
      <header className="md:col-span-2">
        <h1 className="text-xl font-semibold">Fly Brain Lab</h1>
        <p className="text-sm text-neutral-400">
          {info.neuronCount.toLocaleString()} neurons · {info.edgeCount.toLocaleString()} connections (≥5 synapses) ·
          FlyWire v783 · Shiu et al. LIF model
        </p>
      </header>

      <section aria-label="Fly" className="flex flex-col gap-3 rounded-lg border border-neutral-800 p-3">
        <div className="h-72">
          <FlyCanvas
            pose={{ feeding: on('feeding'), escape: on('escape'), antennalGrooming: on('antennal_grooming') }}
            label="Simulated fly"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Stimuli">
          {stimuliConfig.stimuli.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id in activeStimuli}
              onClick={() => toggleStimulus(s.id, s.set, s.defaultRateHz)}
              className={`rounded px-3 py-1 text-sm ${s.id in activeStimuli ? 'bg-emerald-400 text-neutral-950' : 'bg-neutral-800'}`}
            >
              {s.id.replace('_', ' ')}
            </button>
          ))}
        </div>
        <ul className="space-y-1 font-mono text-sm" aria-label="Behaviours">
          {behaviorsConfig.behaviors.map((b) => {
            const st = status?.behaviors.find((x) => x.id === b.id);
            return (
              <li key={b.id} className={st?.active ? 'text-emerald-300' : 'text-neutral-400'}>
                {st?.active ? '●' : '○'} {b.id.replace('_', ' ')} — {b.readout} {(st?.rateHz ?? 0).toFixed(1)} Hz (threshold{' '}
                {b.thresholdHz})
              </li>
            );
          })}
        </ul>
        {notReproduced.map((s) => (
          <p key={s.id} className="text-sm text-amber-300" role="status">
            {s.id}: the model does not reproduce the expected {s.expects.join(', ')}.
          </p>
        ))}
      </section>

      <section aria-label="Brain activity" className="flex flex-col gap-3 rounded-lg border border-neutral-800 p-3">
        <div className="h-48">
          <NeuronCloud ref={cloudRef} primaryNeuropil={info.primaryNeuropil} label="All neurons, grouped by brain region" />
        </div>
        <RegionBars neuropils={info.neuropils} regionHz={status?.regionHz ?? null} />
      </section>

      <footer className="flex flex-wrap items-center gap-2 font-mono text-sm md:col-span-2" aria-label="Time controls">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={sim.speed === s}
            onClick={() => sim.setSpeed(s)}
            className={`rounded px-2 py-1 ${sim.speed === s ? 'bg-emerald-400 text-neutral-950' : 'bg-neutral-800'}`}
          >
            {s === 0 ? 'pause' : `×${s}`}
          </button>
        ))}
        <button type="button" className="rounded bg-neutral-800 px-2 py-1" onClick={() => sim.stepOnce(STEP_MS)}>
          +{STEP_MS} ms
        </button>
        <button type="button" className="rounded bg-neutral-800 px-2 py-1" onClick={sim.reset}>
          reset
        </button>
        <span className="ml-auto text-neutral-400">
          t = {((status?.timeMs ?? 0) / 1000).toFixed(2)} s ·{' '}
          {sim.speed === 0 ? 'paused' : `actual speed ×${(status?.realtimeFactor ?? 0).toFixed(2)} of real time`}
        </span>
      </footer>
    </main>
  );
}
