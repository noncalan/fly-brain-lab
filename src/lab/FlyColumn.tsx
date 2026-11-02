// One simulated fly in its own worker, shared by the Compare and Compress pages.
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import behaviorsConfig from '../../config/behaviors.json';
import stimuliConfig from '../../config/stimuli.json';
import { Panel } from '../app/shell';
import { useSimulation, type SimFrame } from '../app/useSimulation';
import type { ArenaMark, FlyDrive } from '../fly/Fly3D';
import { locomotionFromRates, type FlyState } from '../fly/locomotion';
import { useI18n, type StringKey } from '../i18n';
import type { Grouping, ModelSize } from '../sim/compress';
import { indicesOfType, type Atlas } from './atlas';

const Fly3D = lazy(() => import('../fly/Fly3D'));
const NO_MARKS: ArenaMark[] = [];
const WALK_MIN = 0.3;
/** Readout rates are smoothed with this time constant (simulated ms) before they are reported. */
const RATE_TAU_MS = 300;
const STATS_EVERY_MS = 500;

export interface FlyMods {
  lesion: string;
  opto: string;
  minSynapses: number;
  weightBits: number | null;
  merge: boolean;
}

export interface FlyStats {
  /** smoothed rate of every named set, Hz */
  rates: Record<string, number>;
  model: ModelSize;
}

/** One simulated fly: its own worker, the shared stimuli, and optional changes. Reports what it does. */
export function FlyColumn({ title, stimuli, mods, atlas, grouping, onBehaviors, onInfo, onStats, footer }: {
  title: string;
  stimuli: Record<string, number>;
  mods: FlyMods | null;
  atlas: Atlas | null;
  grouping?: Grouping | null;
  onBehaviors: (active: string[]) => void;
  onInfo?: (neuronCount: number, neuropils: string[]) => void;
  onStats?: (stats: FlyStats) => void;
  footer?: ReactNode;
}) {
  const { t } = useI18n();
  const drive = useRef<FlyDrive>({ command: { speed: 0, turnRate: 0 }, feeding: false, escape: false, grooming: false, pendingSimMs: 0 });
  const fly = useRef<FlyState>({ x: 0, z: 0, heading: Math.PI / 2 });
  const [active, setActive] = useState<string[]>([]);
  const onBehaviorsRef = useRef(onBehaviors);
  onBehaviorsRef.current = onBehaviors;
  const onStatsRef = useRef(onStats);
  onStatsRef.current = onStats;
  const smoothed = useRef<Record<string, number>>({});
  const lastStats = useRef(0);

  const onFrame = useCallback((f: SimFrame) => {
    const on = (id: string) => f.behaviors.find((b) => b.id === id)?.active ?? false;
    const cmd = locomotionFromRates(f.activity.setRatesHz);
    const d = drive.current;
    d.command = cmd;
    d.feeding = on('feeding');
    d.escape = on('escape');
    d.grooming = on('antennal_grooming');
    d.pendingSimMs += f.activity.windowMs;
    const list = [
      ...behaviorsConfig.behaviors.filter((b) => on(b.id)).map((b) => b.id),
      ...(cmd.speed > WALK_MIN ? ['walk_forward'] : []),
      ...(cmd.speed < -WALK_MIN ? ['walk_backward'] : []),
    ];
    setActive((prev) => (prev.join() === list.join() ? prev : list));
    onBehaviorsRef.current(list);

    if (!onStatsRef.current) return;
    const k = f.activity.windowMs > 0 ? 1 - Math.exp(-f.activity.windowMs / RATE_TAU_MS) : 0;
    const s = smoothed.current;
    for (const [id, hz] of Object.entries(f.activity.setRatesHz)) s[id] = (s[id] ?? 0) + k * (hz - (s[id] ?? 0));
    const now = performance.now();
    if (now - lastStats.current >= STATS_EVERY_MS) {
      lastStats.current = now;
      onStatsRef.current({ rates: { ...s }, model: f.model });
    }
  }, []);
  const sim = useSimulation(onFrame);
  const { stimulate, stimulateIndices, silenceNeuropil, clearSilence, setCompression, setGrouping } = sim;
  const info = sim.load.status === 'ready' ? sim.load.info : null;
  const loadError = sim.load.status === 'error' ? sim.load.message : null;
  const groupingSent = useRef<Grouping | null>(null);

  useEffect(() => {
    if (info) onInfo?.(info.neuronCount, info.neuropils);
  }, [info, onInfo]);
  useEffect(() => {
    if (!info) return;
    for (const st of stimuliConfig.stimuli) stimulate(st.set, stimuli[st.id] ?? 0);
  }, [info, stimuli, stimulate]);
  useEffect(() => {
    if (!info || !mods) return;
    clearSilence();
    if (mods.lesion) silenceNeuropil(mods.lesion);
    stimulateIndices('cmp:opto', mods.opto && atlas ? indicesOfType(atlas, mods.opto) : [], mods.opto ? 150 : 0);
    const merge = mods.merge && !!grouping;
    if (merge && groupingSent.current !== grouping) {
      setGrouping(grouping!.groupOf, grouping!.groupCount);
      groupingSent.current = grouping!;
    }
    setCompression({ minSynapses: mods.minSynapses, weightBits: mods.weightBits, merge });
  }, [info, mods, atlas, grouping, clearSilence, silenceNeuropil, stimulateIndices, setCompression, setGrouping]);

  return (
    <Panel title={title}>
      <div className="h-64 overflow-hidden rounded-lg sm:h-80" data-testid={mods ? 'fly-b' : 'fly-a'}>
        {info ? (
          <Suspense fallback={<div className="h-full animate-pulse bg-surface-2" />}>
            <Fly3D drive={drive} state={fly} marks={NO_MARKS} label={title} />
          </Suspense>
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center font-mono text-sm text-muted" role="status">
            {loadError ? t('load.error', { message: loadError }) : t('load.parsing')}
          </div>
        )}
      </div>
      <ul className="mt-2 flex min-h-[1.75rem] flex-wrap gap-2 text-sm" aria-live="polite" data-testid={mods ? 'beh-b' : 'beh-a'}>
        {active.length === 0 ? (
          <li className="text-muted">{t('beh.none')}</li>
        ) : (
          active.map((b) => (
            <li key={b} className="rounded-full bg-accent/15 px-2 py-0.5 text-accent">
              {t(`beh.${b}` as StringKey)}
            </li>
          ))
        )}
      </ul>
      {info && footer}
    </Panel>
  );
}

/** Toggle chips for the stimuli both flies receive. */
export function StimulusChips({ stimuli, onChange }: { stimuli: Record<string, number>; onChange: (next: Record<string, number>) => void }) {
  const { t } = useI18n();
  return (
    <Panel title={t('stim.title')}>
      {/* one scrolling row on phones, so the chips do not fill the whole first screen */}
      <div className="-mx-4 flex gap-2 overflow-x-auto whitespace-nowrap px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:whitespace-normal sm:px-0 sm:pb-0">
        {stimuliConfig.stimuli.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id in stimuli}
            onClick={() => {
              const next = { ...stimuli };
              if (s.id in next) delete next[s.id];
              else next[s.id] = s.defaultRateHz;
              onChange(next);
            }}
            className={`rounded-full border px-3 py-1 text-sm ${s.id in stimuli ? 'border-accent bg-accent text-accent-contrast' : 'border-line bg-surface-2'}`}
          >
            {t(`stim.${s.id}` as StringKey)}
          </button>
        ))}
      </div>
    </Panel>
  );
}

export type Verdict = 'yes' | 'partly' | 'no';

/** Kept = fly B shows exactly fly A's behaviours; partly = some overlap; no = none of them. */
export function behaviourVerdict(a: string[], b: string[]): Verdict {
  const kept = a.filter((x) => b.includes(x)).length;
  if (kept === a.length && b.length === a.length) return 'yes';
  return kept > 0 ? 'partly' : 'no';
}
