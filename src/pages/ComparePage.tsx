import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import behaviorsConfig from '../../config/behaviors.json';
import stimuliConfig from '../../config/stimuli.json';
import { Panel } from '../app/shell';
import { useSimulation, type SimFrame } from '../app/useSimulation';
import { categoryOf } from '../content/regions';
import type { ArenaMark, FlyDrive } from '../fly/Fly3D';
import { locomotionFromRates, type FlyState } from '../fly/locomotion';
import { useI18n, type StringKey } from '../i18n';
import { indicesOfType, loadAtlas, typeCounts, type Atlas } from '../lab/atlas';

const Fly3D = lazy(() => import('../fly/Fly3D'));
const NO_MARKS: ArenaMark[] = [];
const PRUNE_STEPS = [5, 10, 20, 40, 80];
const BIT_STEPS: Array<number | null> = [null, 8, 4, 2, 1];
const WALK_MIN = 0.3;

interface Mods {
  lesion: string;
  opto: string;
  minSynapses: number;
  weightBits: number | null;
}

/** One simulated fly: its own worker, the shared stimuli, and optional changes. Reports what it does. */
function FlyColumn({ title, stimuli, mods, atlas, onBehaviors, onInfo }: {
  title: string;
  stimuli: Record<string, number>;
  mods: Mods | null;
  atlas: Atlas | null;
  onBehaviors: (active: string[]) => void;
  onInfo?: (neuronCount: number, neuropils: string[]) => void;
}) {
  const { t, n } = useI18n();
  const drive = useRef<FlyDrive>({ command: { speed: 0, turnRate: 0 }, feeding: false, escape: false, grooming: false, pendingSimMs: 0 });
  const fly = useRef<FlyState>({ x: 0, z: 0, heading: Math.PI / 2 });
  const [active, setActive] = useState<string[]>([]);
  const [edges, setEdges] = useState(0);
  const onBehaviorsRef = useRef(onBehaviors);
  onBehaviorsRef.current = onBehaviors;

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
    setEdges(f.activeEdges);
    onBehaviorsRef.current(list);
  }, []);
  const sim = useSimulation(onFrame);
  const { stimulate, stimulateIndices, silenceNeuropil, clearSilence, setPruning } = sim;
  const info = sim.load.status === 'ready' ? sim.load.info : null;

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
    setPruning({ minSynapses: mods.minSynapses, weightBits: mods.weightBits });
  }, [info, mods, atlas, clearSilence, silenceNeuropil, stimulateIndices, setPruning]);

  return (
    <Panel title={title}>
      <div className="h-64 overflow-hidden rounded-lg sm:h-80" data-testid={mods ? 'fly-b' : 'fly-a'}>
        {info ? (
          <Suspense fallback={<div className="h-full animate-pulse bg-surface-2" />}>
            <Fly3D drive={drive} state={fly} marks={NO_MARKS} label={title} />
          </Suspense>
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-sm text-muted">{t('load.parsing')}</div>
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
      {mods && info && <p className="mt-1 font-mono text-xs text-muted" data-testid="cmp-edges">{t('cmp.edges', { n: n(edges) })}</p>}
    </Panel>
  );
}

export function ComparePage() {
  const { t, lang } = useI18n();
  const [stimuli, setStimuli] = useState<Record<string, number>>({ sugar: 150 });
  const [mods, setMods] = useState<Mods>({ lesion: 'GNG', opto: '', minSynapses: 5, weightBits: null });
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [neuropils, setNeuropils] = useState<string[]>([]);
  const [a, setA] = useState<string[]>([]);
  const [b, setB] = useState<string[]>([]);
  const [optoQuery, setOptoQuery] = useState('');

  const onInfo = useCallback((count: number, nps: string[]) => {
    setNeuropils(nps);
    loadAtlas(`${import.meta.env.BASE_URL}data/`, count).then(setAtlas, () => setAtlas(null));
  }, []);
  const onA = useCallback((x: string[]) => setA((p) => (p.join() === x.join() ? p : x)), []);
  const onB = useCallback((x: string[]) => setB((p) => (p.join() === x.join() ? p : x)), []);
  const types = useMemo(() => (atlas ? typeCounts(atlas) : []), [atlas]);
  const matches = optoQuery ? types.filter((x) => x.type.toLowerCase().includes(optoQuery.toLowerCase())).slice(0, 8) : [];

  const kept = a.filter((x) => b.includes(x)).length;
  const verdict = kept === a.length && b.length === a.length ? 'yes' : kept > 0 ? 'partly' : 'no';

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('cmp.title')}</h1>
        <p className="mt-1 max-w-3xl text-muted">{t('cmp.intro')}</p>
      </div>
      <Panel title={t('stim.title')}>
        <div className="flex flex-wrap gap-2">
          {stimuliConfig.stimuli.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id in stimuli}
              onClick={() =>
                setStimuli((p) => {
                  const next = { ...p };
                  if (s.id in next) delete next[s.id];
                  else next[s.id] = s.defaultRateHz;
                  return next;
                })
              }
              className={`rounded-full border px-3 py-1 text-sm ${s.id in stimuli ? 'border-accent bg-accent text-accent-contrast' : 'border-line bg-surface-2'}`}
            >
              {t(`stim.${s.id}` as StringKey)}
            </button>
          ))}
        </div>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <FlyColumn title={t('cmp.a')} stimuli={stimuli} mods={null} atlas={atlas} onBehaviors={onA} onInfo={onInfo} />
        <div className="space-y-4">
          <FlyColumn title={t('cmp.b')} stimuli={stimuli} mods={mods} atlas={atlas} onBehaviors={onB} />
          <Panel title={t('cmp.b')}>
            <div className="space-y-3 text-sm">
              <label className="flex flex-wrap items-center gap-2">
                <span className="text-muted">{t('lesion.region')}</span>
                <select value={mods.lesion} onChange={(e) => setMods({ ...mods, lesion: e.target.value })} className="rounded-md border border-line bg-surface-2 px-2 py-1" data-testid="cmp-lesion">
                  <option value="">—</option>
                  {neuropils
                    .filter((x) => x !== 'UNASGD')
                    .sort()
                    .map((r) => (
                      <option key={r} value={r}>
                        {r}
                        {categoryOf(r) ? ` · ${categoryOf(r)!.name[lang]}` : ''}
                      </option>
                    ))}
                </select>
              </label>
              <div>
                <span className="text-muted">{t('tab.opto')}: </span>
                {mods.opto ? (
                  <button type="button" className="font-mono text-accent" onClick={() => setMods({ ...mods, opto: '' })}>
                    {mods.opto} ×
                  </button>
                ) : (
                  <input value={optoQuery} onChange={(e) => setOptoQuery(e.target.value)} placeholder={t('opto.search')} aria-label={t('opto.search')} className="w-full rounded-md border border-line bg-surface-2 px-2 py-1" />
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  {matches.map((m) => (
                    <button
                      key={m.type}
                      type="button"
                      className="rounded border border-line px-1.5 font-mono text-xs"
                      onClick={() => {
                        setMods({ ...mods, opto: m.type });
                        setOptoQuery('');
                      }}
                    >
                      {m.type}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="text-muted">{t('cmp.prune', { n: mods.minSynapses })}</span>
                <input
                  type="range"
                  min={0}
                  max={PRUNE_STEPS.length - 1}
                  value={PRUNE_STEPS.indexOf(mods.minSynapses)}
                  onChange={(e) => setMods({ ...mods, minSynapses: PRUNE_STEPS[+e.target.value] })}
                  className="w-full"
                  data-testid="cmp-prune"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted">{t('cmp.bits')}</span>
                {BIT_STEPS.map((bits) => (
                  <button
                    key={String(bits)}
                    type="button"
                    aria-pressed={mods.weightBits === bits}
                    onClick={() => setMods({ ...mods, weightBits: bits })}
                    className={`rounded px-2 py-0.5 font-mono ${mods.weightBits === bits ? 'bg-ink text-bg' : 'text-muted'}`}
                  >
                    {bits === null ? t('cmp.exact') : t('cmp.bitsN', { n: bits })}
                  </button>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </div>
      <p className={`rounded-lg border p-3 text-sm ${verdict === 'yes' ? 'border-accent/50 text-accent' : 'border-warn/50 text-warn'}`} role="status" data-testid="cmp-verdict">
        {t(`cmp.verdict.${verdict}` as StringKey)}
      </p>
    </div>
  );
}
