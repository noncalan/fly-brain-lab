import { useCallback, useMemo, useState } from 'react';
import { Panel } from '../app/shell';
import { useI18n, type StringKey } from '../i18n';
import { loadAtlas, type Atlas } from '../lab/atlas';
import { FlyColumn, StimulusChips, behaviourVerdict, type FlyMods, type FlyStats } from '../lab/FlyColumn';
import { groupByTypeAndSide, type ModelSize } from '../sim';

const PRUNE_STEPS = [5, 10, 20, 40, 80];
const BIT_STEPS: Array<number | null> = [null, 8, 4, 2, 1];
const READOUTS = ['mn9', 'giant_fiber', 'adn1', 'dnp09', 'mdn'] as const;

type Settings = Pick<FlyMods, 'minSynapses' | 'weightBits' | 'merge'>;
const PRESETS: Array<{ id: string; settings: Settings }> = [
  { id: 'original', settings: { minSynapses: 5, weightBits: null, merge: false } },
  { id: 'merge4', settings: { minSynapses: 5, weightBits: 4, merge: true } },
  { id: 'strong', settings: { minSynapses: 40, weightBits: null, merge: false } },
  { id: 'bit1', settings: { minSynapses: 5, weightBits: 1, merge: false } },
];

const sameSettings = (a: Settings, b: Settings) => a.minSynapses === b.minSynapses && a.weightBits === b.weightBits && a.merge === b.merge;

function SizeCard({ title, model, base, testId }: { title: string; model: ModelSize | null; base: ModelSize | null; testId: string }) {
  const { t, n } = useI18n();
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3" data-testid={testId}>
      <div className="text-xs uppercase tracking-wide text-muted">{title}</div>
      <div className="mt-1 font-mono text-2xl">{model ? t('zip.mb', { mb: n(model.bytes / 1e6, 2) }) : '…'}</div>
      {model && base && (
        <div className="text-sm text-accent" data-testid={`${testId}-ratio`}>
          {t('zip.ratio', { x: n(base.bytes / model.bytes, 1) })}
        </div>
      )}
      {model && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 font-mono text-xs text-muted">
          <dt>{t('zip.nodes')}</dt>
          <dd>{n(model.nodes)}</dd>
          <dt>{t('zip.edges')}</dt>
          <dd>{n(model.edges)}</dd>
          <dt>{t('zip.wbits')}</dt>
          <dd>{model.weightBits}</dd>
        </dl>
      )}
    </div>
  );
}

export function CompressPage() {
  const { t, n } = useI18n();
  const [stimuli, setStimuli] = useState<Record<string, number>>({ sugar: 150 });
  const [settings, setSettings] = useState<Settings>(PRESETS[1].settings);
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [neuronCount, setNeuronCount] = useState(0);
  const [a, setA] = useState<string[]>([]);
  const [b, setB] = useState<string[]>([]);
  const [statsA, setStatsA] = useState<FlyStats | null>(null);
  const [statsB, setStatsB] = useState<FlyStats | null>(null);
  // fly B starts after fly A has loaded (see ComparePage: two simultaneous downloads of one file can fail)
  const [aReady, setAReady] = useState(false);

  const onInfo = useCallback((count: number) => {
    setAReady(true);
    setNeuronCount(count);
    loadAtlas(`${import.meta.env.BASE_URL}data/`, count).then(setAtlas, () => setAtlas(null));
  }, []);
  const onA = useCallback((x: string[]) => setA((p) => (p.join() === x.join() ? p : x)), []);
  const onB = useCallback((x: string[]) => setB((p) => (p.join() === x.join() ? p : x)), []);
  const grouping = useMemo(() => (atlas ? groupByTypeAndSide(atlas.typeOf, atlas.sideOf) : null), [atlas]);
  const mods = useMemo<FlyMods>(() => ({ lesion: '', opto: '', ...settings }), [settings]);
  const verdict = behaviourVerdict(a, b);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('zip.title')}</h1>
        <p className="mt-1 max-w-3xl text-muted">{t('zip.intro')}</p>
      </div>
      <StimulusChips stimuli={stimuli} onChange={setStimuli} />
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Panel title={t('zip.controls')}>
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted">{t('zip.presets')}:</span>
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={sameSettings(settings, p.settings)}
                  onClick={() => setSettings(p.settings)}
                  className={`rounded-full border px-3 py-1 ${sameSettings(settings, p.settings) ? 'border-accent bg-accent text-accent-contrast' : 'border-line bg-surface-2'}`}
                  data-testid={`zip-preset-${p.id}`}
                >
                  {t(`zip.preset.${p.id}` as StringKey)}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="text-muted">{t('zip.prune', { n: settings.minSynapses })}</span>
              <input
                type="range"
                min={0}
                max={PRUNE_STEPS.length - 1}
                value={PRUNE_STEPS.indexOf(settings.minSynapses)}
                onChange={(e) => setSettings({ ...settings, minSynapses: PRUNE_STEPS[+e.target.value] })}
                className="w-full"
                data-testid="zip-prune"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('zip.bits')}>
              <span className="text-muted">{t('zip.bits')}</span>
              {BIT_STEPS.map((bits) => (
                <button
                  key={String(bits)}
                  type="button"
                  aria-pressed={settings.weightBits === bits}
                  onClick={() => setSettings({ ...settings, weightBits: bits })}
                  className={`rounded px-2 py-0.5 font-mono ${settings.weightBits === bits ? 'bg-ink text-bg' : 'text-muted'}`}
                >
                  {bits === null ? t('cmp.exact') : t('cmp.bitsN', { n: bits })}
                </button>
              ))}
            </div>
            <div>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={settings.merge}
                  disabled={!grouping}
                  onChange={(e) => setSettings({ ...settings, merge: e.target.checked })}
                  className="mt-1"
                  data-testid="zip-merge"
                />
                <span>{t('zip.merge')}</span>
              </label>
              <p className="mt-1 text-xs text-muted">
                {grouping ? t('zip.mergeHint', { groups: n(grouping.groupCount), neurons: n(neuronCount) }) : t('zip.mergeWait')}
              </p>
            </div>
          </div>
        </Panel>
        <Panel title={t('zip.size')}>
          <div className="grid grid-cols-2 gap-3">
            <SizeCard title={t('zip.a')} model={statsA?.model ?? null} base={null} testId="zip-size-a" />
            <SizeCard title={t('zip.b')} model={statsB?.model ?? null} base={statsA?.model ?? null} testId="zip-size-b" />
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted">{t('zip.how.title')}</summary>
            <p className="mt-2 text-muted">{t('zip.how.text')}</p>
          </details>
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <FlyColumn title={t('zip.a')} stimuli={stimuli} mods={null} atlas={atlas} onBehaviors={onA} onInfo={onInfo} onStats={setStatsA} />
        {aReady ? (
          <FlyColumn title={t('zip.b')} stimuli={stimuli} mods={mods} atlas={atlas} grouping={grouping} onBehaviors={onB} onStats={setStatsB} />
        ) : (
          <Panel title={t('zip.b')}>
            <div className="flex h-64 items-center justify-center font-mono text-sm text-muted sm:h-80">{t('load.parsing')}</div>
          </Panel>
        )}
      </div>
      <p className={`rounded-lg border p-3 text-sm ${verdict === 'yes' ? 'border-accent/50 text-accent' : 'border-warn/50 text-warn'}`} role="status" data-testid="zip-verdict">
        {t(`cmp.verdict.${verdict}` as StringKey)}
      </p>
      <Panel title={t('zip.readouts')}>
        <table className="w-full text-sm" data-testid="zip-readouts">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 font-normal">{t('zip.col.neuron')}</th>
              <th className="py-1 text-right font-normal">{t('zip.a')}</th>
              <th className="py-1 text-right font-normal">{t('zip.b')}</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {READOUTS.map((r) => (
              <tr key={r} className="border-t border-line">
                <td className="py-1 font-sans">{t(`zip.ro.${r}` as StringKey)}</td>
                <td className="py-1 text-right">{statsA ? n(statsA.rates[r] ?? 0, 1) : '…'}</td>
                <td className="py-1 text-right">{statsB ? n(statsB.rates[r] ?? 0, 1) : '…'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">{t('zip.caveat')}</p>
      </Panel>
      <Panel title={t('zip.why.title')}>
        <p className="max-w-3xl text-sm text-muted">{t('zip.why.text')}</p>
      </Panel>
    </div>
  );
}
