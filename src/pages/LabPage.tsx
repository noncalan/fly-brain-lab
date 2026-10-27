import { Suspense, lazy, useCallback, useRef, useState } from 'react';
import behaviorsConfig from '../../config/behaviors.json';
import stimuliConfig from '../../config/stimuli.json';
import { Panel } from '../app/shell';
import { NeuronCloud, type NeuronCloudHandle } from '../app/NeuronCloud';
import { useSimulation, type SimFrame } from '../app/useSimulation';
import type { LevelsRef } from '../brain/BrainView';
import { FlyCanvas } from '../fly/FlyCanvas';
import { useI18n, type StringKey } from '../i18n';
import { RegionBars, type RegionRate } from '../lab/RegionBars';
import { SignalPath } from '../lab/SignalPath';
import { StimulusPalette } from '../lab/StimulusPalette';
import { TimeControls } from '../lab/TimeControls';
import type { BehaviorState } from '../sim';

const BrainView = lazy(() => import('../brain/BrainView'));

/** Simulated time a stimulus must run before we say the model does not reproduce the expected behaviour. */
const VERDICT_AFTER_MS = 1000;
const REGION_SMOOTHING = 0.8;
/** spikes/s in a region that maps to full glow (log scale) */
const GLOW_REF_HZ = 20000;
const NEURON_LABEL: Record<string, string> = { mn9: 'MN9', giant_fiber: 'Giant Fiber', adn1: 'aDN1' };

interface Status {
  timeMs: number;
  realtimeFactor: number;
  behaviors: BehaviorState[];
  setRatesHz: Record<string, number>;
  regions: RegionRate[];
}

export function LabPage() {
  const { t, n } = useI18n();
  const cloudRef = useRef<NeuronCloudHandle>(null);
  const flyRef = useRef<HTMLDivElement>(null);
  const levels: LevelsRef = useRef(new Map<string, number>());
  const smoothed = useRef<Float32Array | null>(null);
  const neuropilsRef = useRef<string[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [active, setActive] = useState<Map<string, number>>(new Map()); // stimulus id -> sim time when turned on
  const [lastStimulus, setLastStimulus] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);

  const onFrame = useCallback((f: SimFrame) => {
    cloudRef.current?.addSpikes(f.activity.spikedIndices);
    const { neuropilSpikes, windowMs } = f.activity;
    const names = neuropilsRef.current;
    if (!smoothed.current) smoothed.current = new Float32Array(neuropilSpikes.length);
    const r = smoothed.current;
    if (windowMs > 0) {
      for (let p = 0; p < r.length; p++) r[p] = REGION_SMOOTHING * r[p] + ((1 - REGION_SMOOTHING) * neuropilSpikes[p] * 1000) / windowMs;
    }
    const regions: RegionRate[] = [];
    for (let p = 0; p < r.length; p++) {
      levels.current.set(names[p], Math.min(1, Math.log10(1 + r[p]) / Math.log10(1 + GLOW_REF_HZ)));
      if (names[p] !== 'UNASGD') regions.push({ name: names[p], hz: r[p] });
    }
    regions.sort((a, b) => b.hz - a.hz);
    setStatus({
      timeMs: f.activity.timeMs,
      realtimeFactor: f.realtimeFactor,
      behaviors: f.behaviors,
      setRatesHz: f.activity.setRatesHz,
      regions,
    });
  }, []);

  const sim = useSimulation(onFrame);
  if (sim.load.status === 'ready') neuropilsRef.current = sim.load.info.neuropils;

  const setStimulus = (id: string, on: boolean) => {
    const s = stimuliConfig.stimuli.find((x) => x.id === id);
    if (!s) return;
    setActive((prev) => {
      if (prev.has(id) === on) return prev;
      const next = new Map(prev);
      if (on) next.set(id, status?.timeMs ?? 0);
      else next.delete(id);
      return next;
    });
    sim.stimulate(s.set, on ? s.defaultRateHz : 0);
    if (on) setLastStimulus(id);
    else if (lastStimulus === id) setLastStimulus(null);
  };

  const applySpeed = (s: number, p: boolean) => {
    setSpeed(s);
    setPaused(p);
    sim.setSpeed(p ? 0 : s);
  };

  if (sim.load.status === 'error') {
    return <p className="mx-auto max-w-3xl p-6 text-warn">{t('load.error', { message: sim.load.message })}</p>;
  }
  if (sim.load.status === 'loading') {
    const { loadedBytes, totalBytes } = sim.load;
    const done = totalBytes > 0 && loadedBytes >= totalBytes;
    return (
      <div className="mx-auto max-w-md p-10 text-center" role="status">
        <p className="font-mono text-sm text-muted">
          {done
            ? t('load.parsing')
            : t('load.loading', { loaded: n(loadedBytes / 1e6, 1), total: totalBytes ? n(totalBytes / 1e6, 1) : '…' })}
        </p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-accent transition-[width]" style={{ width: `${totalBytes ? (100 * loadedBytes) / totalBytes : 10}%` }} />
        </div>
      </div>
    );
  }

  const { info } = sim.load;
  const isOn = (id: string) => status?.behaviors.find((b) => b.id === id)?.active ?? false;
  const activeBehaviors = behaviorsConfig.behaviors.filter((b) => isOn(b.id));
  const notReproduced = stimuliConfig.stimuli.filter(
    (s) => active.has(s.id) && s.expects.length > 0 && (status?.timeMs ?? 0) - active.get(s.id)! > VERDICT_AFTER_MS && !s.expects.some(isOn),
  );
  const activeRegionCount = status?.regions.filter((r) => r.hz > 0.5).length ?? 0;

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="lg:col-span-2">
        <p className="text-muted">{t('app.tagline')}</p>
        <p className="mt-1 font-mono text-xs text-muted">
          {t('app.stats', { neurons: n(info.neuronCount), edges: n(info.edgeCount) })}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Panel title={t('stim.title')}>
          <StimulusPalette
            active={new Set(active.keys())}
            onToggle={(id) => setStimulus(id, !active.has(id))}
            onActivate={(id) => setStimulus(id, true)}
            dropTarget={flyRef}
            onDragOver={setDragOver}
          />
        </Panel>
        <Panel title={t('beh.title')}>
          <div
            ref={flyRef}
            data-testid="fly"
            className={`relative h-64 rounded-lg border-2 border-dashed transition-colors sm:h-72 ${dragOver ? 'border-accent bg-accent/5' : 'border-transparent'}`}
          >
            <FlyCanvas
              pose={{ feeding: isOn('feeding'), escape: isOn('escape'), antennalGrooming: isOn('antennal_grooming') }}
              label={t('fly.label', {
                behaviors: activeBehaviors.length ? activeBehaviors.map((b) => t(`beh.${b.id}` as StringKey)).join(', ') : t('beh.none'),
              })}
            />
            {dragOver && <p className="absolute inset-x-0 bottom-2 text-center text-sm text-accent">{t('stim.dropHere')}</p>}
          </div>
          <ul className="mt-3 space-y-1.5" aria-live="polite" data-testid="behaviors">
            {behaviorsConfig.behaviors.map((b) => {
              const st = status?.behaviors.find((x) => x.id === b.id);
              return (
                <li key={b.id} data-active={st?.active ? 'true' : 'false'} data-behavior={b.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full ${st?.active ? 'bg-accent' : 'bg-surface-2 ring-1 ring-line'}`} />
                  <span className={st?.active ? 'font-medium' : 'text-muted'}>{t(`beh.${b.id}` as StringKey)}</span>
                  <span className="ml-auto font-mono text-xs text-muted">
                    {t('beh.readout', { neuron: NEURON_LABEL[b.readout] ?? b.readout, hz: n(st?.rateHz ?? 0, 1), threshold: n(b.thresholdHz, 1) })}
                  </span>
                </li>
              );
            })}
          </ul>
          {notReproduced.map((s) => (
            <p key={s.id} role="status" data-testid={`not-reproduced-${s.id}`} className="mt-2 rounded-md border border-warn/40 bg-warn/10 p-2 text-sm text-warn">
              {t('beh.notReproduced', {
                stimulus: t(`stim.${s.id}` as StringKey),
                behavior: s.expects.map((e) => t(`beh.${e}` as StringKey)).join(', '),
              })}
            </p>
          ))}
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Panel title={t('brain.title')} aside={<span className="hidden text-xs text-muted sm:inline">{t('brain.hint')}</span>}>
          <div className="h-72 sm:h-96">
            <Suspense fallback={<div className="h-full animate-pulse rounded-lg bg-surface-2" />}>
              <BrainView levels={levels} activeCount={activeRegionCount} />
            </Suspense>
          </div>
          <p className="mt-2 text-xs text-muted">{t('brain.disclaimer')}</p>
        </Panel>
        <Panel title={t('path.title')}>
          <SignalPath
            stimulusId={lastStimulus}
            setRatesHz={status?.setRatesHz ?? {}}
            topRegions={(status?.regions ?? []).filter((r) => r.hz > 0.5).map((r) => r.name)}
            behaviors={status?.behaviors ?? []}
          />
        </Panel>
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title={t('brain.bars')}>
            <RegionBars regions={status?.regions ?? []} />
          </Panel>
          <Panel title={t('brain.neurons')}>
            <div className="h-40">
              <NeuronCloud ref={cloudRef} primaryNeuropil={info.primaryNeuropil} label={t('brain.neurons')} />
            </div>
          </Panel>
        </div>
      </div>

      <section
        aria-label={t('time.title')}
        className="sticky bottom-2 z-10 rounded-xl border border-line bg-surface/95 p-2 shadow-lg backdrop-blur lg:col-span-2"
      >
        <TimeControls
          speed={speed}
          paused={paused}
          timeMs={status?.timeMs ?? 0}
          realtimeFactor={status?.realtimeFactor ?? 0}
          onPause={(p) => applySpeed(speed, p)}
          onSpeed={(s) => applySpeed(s, paused)}
          onStep={sim.stepOnce}
          onReset={() => {
            sim.reset();
            smoothed.current?.fill(0);
          }}
        />
      </section>
    </div>
  );
}
