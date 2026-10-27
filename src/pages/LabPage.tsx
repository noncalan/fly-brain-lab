import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import behaviorsConfig from '../../config/behaviors.json';
import stimuliConfig from '../../config/stimuli.json';
import { Panel } from '../app/shell';
import { NeuronCloud, type NeuronCloudHandle } from '../app/NeuronCloud';
import { useSimulation, type SimFrame } from '../app/useSimulation';
import type { LevelsRef, SpikeQueueRef } from '../brain/BrainView';
import type { ArenaMark, FlyDrive } from '../fly/Fly3D';
import { locomotionFromRates, type FlyState } from '../fly/locomotion';
import { useI18n, type StringKey } from '../i18n';
import { indicesOfType, loadAtlas, type Atlas } from '../lab/atlas';
import { ExperimentPanel } from '../lab/ExperimentPanel';
import { decodeState, encodeState, type LabState, type OptoTarget } from '../lab/labState';
import { RegionBars, type RegionRate } from '../lab/RegionBars';
import { SignalPath } from '../lab/SignalPath';
import { TimeControls } from '../lab/TimeControls';
import type { BehaviorState } from '../sim';

const BrainView = lazy(() => import('../brain/BrainView'));
const Fly3D = lazy(() => import('../fly/Fly3D'));

/** Simulated time a stimulus must run before we say the model does not reproduce the expected behaviour. */
const VERDICT_AFTER_MS = 1000;
const REGION_SMOOTHING = 0.8;
/** spikes/s in a region that maps to full glow (log scale) */
const GLOW_REF_HZ = 20000;
/** food closer than this to the proboscis tip counts as taste contact */
const CONTACT_MM = 2.2;
/** the proboscis tip sits this far in front of the fly's centre */
const HEAD_OFFSET_MM = 1.6;
const TOUCH_PULSE_MS = 4000;
/** the brain view drains spike frames every animation frame; cap the queue if it is not drawing */
const MAX_QUEUED_FRAMES = 8;
const ARENA_STIMULUS = { food: 'shiu_sugar_r', touch: 'jo_wind_gravity' } as const;
const WALK_SPEED_MIN = 0.3;
const TURN_MIN = 0.15;
const NEURON_LABEL: Record<string, string> = { mn9: 'MN9', giant_fiber: 'Giant Fiber', adn1: 'aDN1' };
const KNOWN_STIMULI = new Set(stimuliConfig.stimuli.map((s) => s.id));

interface Status {
  timeMs: number;
  realtimeFactor: number;
  behaviors: BehaviorState[];
  setRatesHz: Record<string, number>;
  regions: RegionRate[];
}

const optoKey = (o: OptoTarget) => `opto:${o.type}.${o.side}`;

function useUrlState(): [LabState, (s: LabState) => void] {
  const [state, setState] = useState<LabState>(() => decodeState(window.location.search, KNOWN_STIMULI));
  const update = useCallback((s: LabState) => {
    setState(s);
    const q = encodeState(s);
    window.history.replaceState({}, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
  }, []);
  return [state, update];
}

export function LabPage() {
  const { t, n } = useI18n();
  const cloudRef = useRef<NeuronCloudHandle>(null);
  const arenaRef = useRef<HTMLDivElement>(null);
  const levels: LevelsRef = useRef(new Map<string, number>());
  const spikeQueue: SpikeQueueRef = useRef<Uint32Array[]>([]);
  const smoothed = useRef<Float32Array | null>(null);
  const neuropilsRef = useRef<string[]>([]);
  const drive = useRef<FlyDrive>({ command: { speed: 0, turnRate: 0 }, feeding: false, escape: false, grooming: false, pendingSimMs: 0 });
  const flyState = useRef<FlyState>({ x: 0, z: 0, heading: Math.PI / 2 });
  const marksRef = useRef<ArenaMark[]>([]);
  const [marks, setMarks] = useState<ArenaMark[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [state, setState] = useUrlState();
  const [startedAt, setStartedAt] = useState<Record<string, number>>({});
  const [lastStimulus, setLastStimulus] = useState<string | null>(() => Object.keys(decodeState(window.location.search, KNOWN_STIMULI).stimuli)[0] ?? null);
  const [dragOver, setDragOver] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [touching, setTouching] = useState(false);
  const [foodContact, setFoodContact] = useState(false);

  const onFrame = useCallback((f: SimFrame) => {
    cloudRef.current?.addSpikes(f.activity.spikedIndices);
    spikeQueue.current.push(f.activity.spikedIndices);
    if (spikeQueue.current.length > MAX_QUEUED_FRAMES) spikeQueue.current.shift();
    const { neuropilSpikes, windowMs, setRatesHz } = f.activity;
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
    const on = (id: string) => f.behaviors.find((b) => b.id === id)?.active ?? false;
    const d = drive.current;
    d.command = locomotionFromRates(setRatesHz);
    d.feeding = on('feeding');
    d.escape = on('escape');
    d.grooming = on('antennal_grooming');
    d.pendingSimMs += windowMs;
    // taste contact: is any food mark at the proboscis tip?
    const s = flyState.current;
    const hx = s.x + Math.cos(s.heading) * HEAD_OFFSET_MM;
    const hz = s.z - Math.sin(s.heading) * HEAD_OFFSET_MM;
    setFoodContact(marksRef.current.some((m) => Math.hypot(m.x - hx, m.z - hz) < CONTACT_MM));
    setStatus({ timeMs: f.activity.timeMs, realtimeFactor: f.realtimeFactor, behaviors: f.behaviors, setRatesHz, regions });
  }, []);

  const sim = useSimulation(onFrame);
  const { stimulate, stimulateIndices, silenceIndices, silenceNeuropil, clearSilence } = sim;
  const info = sim.load.status === 'ready' ? sim.load.info : null;
  if (info) neuropilsRef.current = info.neuropils;

  useEffect(() => {
    if (!info) return;
    loadAtlas(`${import.meta.env.BASE_URL}data/`, info.neuronCount).then(setAtlas, () => setAtlas(null));
  }, [info]);

  // apply the experiment to the simulation whenever it changes
  const applied = useRef<{ stimuli: Record<string, number>; opto: Map<string, number[]> }>({ stimuli: {}, opto: new Map() });
  useEffect(() => {
    if (!info) return;
    const prev = applied.current;
    for (const st of stimuliConfig.stimuli) {
      const want = state.stimuli[st.id] ?? 0;
      if ((prev.stimuli[st.id] ?? 0) !== want) stimulate(st.set, want);
    }
    if (atlas) {
      const want = new Map(state.opto.map((o) => [optoKey(o), o] as const));
      for (const key of prev.opto.keys()) if (!want.has(key)) stimulateIndices(key, [], 0);
      const next = new Map<string, number[]>();
      for (const [key, o] of want) {
        const idx = indicesOfType(atlas, o.type, o.side);
        stimulateIndices(key, idx, o.rateHz);
        next.set(key, idx);
      }
      prev.opto = next;
      clearSilence();
      for (const l of state.lesions) {
        if ('neuropil' in l) silenceNeuropil(l.neuropil);
        else silenceIndices(indicesOfType(atlas, l.type));
      }
    } else {
      clearSilence();
      for (const l of state.lesions) if ('neuropil' in l) silenceNeuropil(l.neuropil);
    }
    prev.stimuli = { ...state.stimuli };
  }, [state, info, atlas, stimulate, stimulateIndices, silenceIndices, silenceNeuropil, clearSilence]);

  // arena interactions drive their own stimulus channels so they never change the shared experiment state
  useEffect(() => {
    if (!info) return;
    stimulateIndices('arena:food', foodContact ? info.sets[ARENA_STIMULUS.food].indices : [], foodContact ? 150 : 0);
  }, [foodContact, info, stimulateIndices]);
  useEffect(() => {
    if (!info) return;
    stimulateIndices('arena:touch', touching ? info.sets[ARENA_STIMULUS.touch].indices : [], touching ? 150 : 0);
    if (!touching) return;
    const timer = setTimeout(() => setTouching(false), TOUCH_PULSE_MS);
    return () => clearTimeout(timer);
  }, [touching, info, stimulateIndices]);

  const changeState = (s: LabState) => {
    const added = Object.keys(s.stimuli).filter((id) => !(id in state.stimuli));
    if (added.length) setLastStimulus(added[added.length - 1]);
    else if (lastStimulus && !(lastStimulus in s.stimuli)) setLastStimulus(Object.keys(s.stimuli)[0] ?? null);
    setStartedAt((prev) => {
      const next = { ...prev };
      for (const id of added) next[id] = status?.timeMs ?? 0;
      return next;
    });
    setState(s);
  };

  const dropFood = useCallback((x: number, z: number) => {
    const mark: ArenaMark = { id: `${Date.now()}`, x, z, kind: 'food' };
    marksRef.current = [...marksRef.current.slice(-4), mark];
    setMarks(marksRef.current);
  }, []);

  const applySpeed = (s: number, p: boolean) => {
    setSpeed(s);
    setPaused(p);
    sim.setSpeed(p ? 0 : s);
  };

  const shareUrl = useMemo(() => {
    const q = encodeState(state);
    return `${window.location.origin}/${q ? `?${q}` : ''}`;
  }, [state]);

  if (sim.load.status === 'error') {
    return <p className="mx-auto max-w-3xl p-6 text-warn">{t('load.error', { message: sim.load.message })}</p>;
  }
  if (!info) {
    const { loadedBytes, totalBytes } = sim.load as { loadedBytes: number; totalBytes: number };
    const done = totalBytes > 0 && loadedBytes >= totalBytes;
    return (
      <div className="mx-auto max-w-md p-10 text-center" role="status">
        <p className="font-mono text-sm text-muted">
          {done ? t('load.parsing') : t('load.loading', { loaded: n(loadedBytes / 1e6, 1), total: totalBytes ? n(totalBytes / 1e6, 1) : '…' })}
        </p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-accent transition-[width]" style={{ width: `${totalBytes ? (100 * loadedBytes) / totalBytes : 10}%` }} />
        </div>
      </div>
    );
  }

  const rates = status?.setRatesHz ?? {};
  const isOn = (id: string) => status?.behaviors.find((b) => b.id === id)?.active ?? false;
  const cmd = locomotionFromRates(rates);
  const walking: Array<{ id: StringKey; on: boolean }> = [
    { id: 'beh.walk_forward', on: cmd.speed > WALK_SPEED_MIN },
    { id: 'beh.walk_backward', on: cmd.speed < -WALK_SPEED_MIN },
    { id: 'beh.turn_right', on: cmd.turnRate > TURN_MIN },
    { id: 'beh.turn_left', on: cmd.turnRate < -TURN_MIN },
  ];
  const activeLabels = [
    ...behaviorsConfig.behaviors.filter((b) => isOn(b.id)).map((b) => t(`beh.${b.id}` as StringKey)),
    ...walking.filter((w) => w.on).map((w) => t(w.id)),
  ];
  const notReproduced = stimuliConfig.stimuli.filter(
    (s) => s.id in state.stimuli && s.expects.length > 0 && (status?.timeMs ?? 0) - (startedAt[s.id] ?? 0) > VERDICT_AFTER_MS && !s.expects.some(isOn),
  );
  const activeRegionCount = status?.regions.filter((r) => r.hz > 0.5).length ?? 0;
  const hz = (k: string) => n(rates[k] ?? 0, 1);

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <p className="text-muted">{t('app.tagline')}</p>
        <p className="mt-1 font-mono text-xs text-muted">{t('app.stats', { neurons: n(info.neuronCount), edges: n(info.edgeCount) })}</p>
      </div>

      <Panel title={t('beh.title')} aside={<span className="hidden text-xs text-muted sm:inline">{t('arena.hint')}</span>}>
        <div
          ref={arenaRef}
          data-testid="fly"
          className={`relative h-72 overflow-hidden rounded-lg border-2 border-dashed transition-colors sm:h-96 ${dragOver ? 'border-accent' : 'border-transparent'}`}
        >
          <Suspense fallback={<div className="h-full animate-pulse rounded-lg bg-surface-2" />}>
            <Fly3D
              drive={drive}
              state={flyState}
              marks={marks}
              label={t('arena.label', { behaviors: activeLabels.length ? activeLabels.join(', ') : t('beh.none') })}
              onArenaClick={dropFood}
              onFlyClick={(part) => part === 'head' && setTouching(true)}
            />
          </Suspense>
          {dragOver && <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-sm text-accent">{t('stim.dropHere')}</p>}
          {activeLabels.length > 0 && (
            <p className="pointer-events-none absolute left-2 top-2 rounded-md bg-surface/90 px-2 py-1 text-sm font-medium text-accent" aria-live="polite">
              {activeLabels.join(' · ')}
            </p>
          )}
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
          {walking.map((w) => (
            <li key={w.id} data-active={w.on ? 'true' : 'false'} data-behavior={w.id.slice(4)} className="flex items-baseline gap-2 text-sm">
              <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full ${w.on ? 'bg-accent' : 'bg-surface-2 ring-1 ring-line'}`} />
              <span className={w.on ? 'font-medium' : 'text-muted'}>{t(w.id)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 font-mono text-xs text-muted" data-testid="walk-readout">
          {t('walk.readout', { l: hz('dnp09_l'), r: hz('dnp09_r'), mdn: hz('mdn'), al: hz('dna02_l'), ar: hz('dna02_r') })}
        </p>
        <p className="text-xs text-muted">{t('walk.note')}</p>
        {notReproduced.map((s) => (
          <p key={s.id} role="status" data-testid={`not-reproduced-${s.id}`} className="mt-2 rounded-md border border-warn/40 bg-warn/10 p-2 text-sm text-warn">
            {t('beh.notReproduced', { stimulus: t(`stim.${s.id}` as StringKey), behavior: s.expects.map((e) => t(`beh.${e}` as StringKey)).join(', ') })}
          </p>
        ))}
      </Panel>

      <Panel title={t('brain.title')} aside={<span className="hidden text-xs text-muted sm:inline">{t('brain.hint')}</span>}>
        <div className="h-72 sm:h-96">
          <Suspense fallback={<div className="h-full animate-pulse rounded-lg bg-surface-2" />}>
            <BrainView levels={levels} activeCount={activeRegionCount} atlas={atlas} spikes={spikeQueue} />
          </Suspense>
        </div>
        <p className="mt-2 text-xs text-muted">{t('brain.disclaimer')}</p>
      </Panel>

      <Panel title={t('exp.title')}>
        <ExperimentPanel
          state={state}
          onChange={changeState}
          atlas={atlas}
          neuropils={info.neuropils}
          dropTarget={arenaRef}
          onDragOver={setDragOver}
          defaultRate={(id) => stimuliConfig.stimuli.find((s) => s.id === id)?.defaultRateHz ?? 150}
          shareUrl={shareUrl}
        />
      </Panel>

      <div className="flex flex-col gap-4">
        <Panel title={t('path.title')}>
          <SignalPath stimulusId={lastStimulus} setRatesHz={rates} topRegions={(status?.regions ?? []).filter((r) => r.hz > 0.5).map((r) => r.name)} behaviors={status?.behaviors ?? []} />
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

      <section aria-label={t('time.title')} className="sticky bottom-2 z-10 rounded-xl border border-line bg-surface/95 p-2 shadow-lg backdrop-blur lg:col-span-2">
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
            flyState.current = { x: 0, z: 0, heading: Math.PI / 2 };
          }}
        />
      </section>
    </div>
  );
}
