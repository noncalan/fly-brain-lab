import { useCallback, useMemo, useState } from 'react';
import { Panel } from '../app/shell';
import { categoryOf } from '../content/regions';
import { useI18n, type StringKey } from '../i18n';
import { loadAtlas, typeCounts, type Atlas } from '../lab/atlas';
import { FlyColumn, StimulusChips, behaviourVerdict, type FlyMods, type FlyStats } from '../lab/FlyColumn';

const PRUNE_STEPS = [5, 10, 20, 40, 80];
const BIT_STEPS: Array<number | null> = [null, 8, 4, 2, 1];

export function ComparePage() {
  const { t, n, lang } = useI18n();
  const [stimuli, setStimuli] = useState<Record<string, number>>({ sugar: 150 });
  const [mods, setMods] = useState<FlyMods>({ lesion: 'GNG', opto: '', minSynapses: 5, weightBits: null, merge: false });
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [neuropils, setNeuropils] = useState<string[]>([]);
  const [a, setA] = useState<string[]>([]);
  const [b, setB] = useState<string[]>([]);
  const [edgesB, setEdgesB] = useState(0);
  const [optoQuery, setOptoQuery] = useState('');
  // fly B starts after fly A has loaded, so its connectome comes from the HTTP cache instead of a second
  // simultaneous download of the same 9.5 MB file (Chrome can fail that one with ERR_CACHE_WRITE_FAILURE)
  const [aReady, setAReady] = useState(false);

  const onInfo = useCallback((count: number, nps: string[]) => {
    setAReady(true);
    setNeuropils(nps);
    loadAtlas(`${import.meta.env.BASE_URL}data/`, count).then(setAtlas, () => setAtlas(null));
  }, []);
  const onA = useCallback((x: string[]) => setA((p) => (p.join() === x.join() ? p : x)), []);
  const onB = useCallback((x: string[]) => setB((p) => (p.join() === x.join() ? p : x)), []);
  const onStatsB = useCallback((s: FlyStats) => setEdgesB(s.model.edges), []);
  const types = useMemo(() => (atlas ? typeCounts(atlas) : []), [atlas]);
  const matches = optoQuery ? types.filter((x) => x.type.toLowerCase().includes(optoQuery.toLowerCase())).slice(0, 8) : [];
  const verdict = behaviourVerdict(a, b);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('cmp.title')}</h1>
        <p className="mt-1 max-w-3xl text-muted">{t('cmp.intro')}</p>
      </div>
      <StimulusChips stimuli={stimuli} onChange={setStimuli} />
      <div className="grid gap-4 lg:grid-cols-2">
        <FlyColumn title={t('cmp.a')} stimuli={stimuli} mods={null} atlas={atlas} onBehaviors={onA} onInfo={onInfo} />
        <div className="space-y-4">
          {aReady ? (
            <FlyColumn
              title={t('cmp.b')}
              stimuli={stimuli}
              mods={mods}
              atlas={atlas}
              onBehaviors={onB}
              onStats={onStatsB}
              footer={<p className="mt-1 font-mono text-xs text-muted" data-testid="cmp-edges">{t('cmp.edges', { n: n(edgesB) })}</p>}
            />
          ) : (
            <Panel title={t('cmp.b')}>
              <div className="flex h-64 items-center justify-center font-mono text-sm text-muted sm:h-80">{t('load.parsing')}</div>
            </Panel>
          )}
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
