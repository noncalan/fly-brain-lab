import { Panel } from '../app/shell';
import { BRAINS, DATASETS, type Dataset, type Source } from '../content/scale';
import { useI18n, type Lang, type StringKey } from '../i18n';

/** Logarithmic bars: 10^0 … 10^LOG_MAX. */
const LOG_MAX = 11;
const BYTE_UNITS: Array<[number, Record<'latin' | 'cyrillic', string>]> = [
  [1e15, { latin: 'PB', cyrillic: 'ПБ' }],
  [1e12, { latin: 'TB', cyrillic: 'ТБ' }],
  [1e9, { latin: 'GB', cyrillic: 'ГБ' }],
  [1e6, { latin: 'MB', cyrillic: 'МБ' }],
  [1e3, { latin: 'kB', cyrillic: 'кБ' }],
];
/** What the cell count of each dataset counts. */
const COUNT_LABEL: Record<Dataset['id'], StringKey> = {
  fafb: 'scale.cells',
  flywire: 'scale.neuronsN',
  microns: 'scale.cells',
  h01: 'scale.cells',
  model: 'scale.neuronsN',
  modelMerged: 'scale.nodes',
};
const LOCALE: Record<Lang, string> = { en: 'en-US', ru: 'ru-RU', kk: 'kk-KZ' };

/** Two significant digits: ratios between rough counts should not look more precise than their inputs. */
const sig2 = (x: number) => Number(x.toPrecision(2));

function SourceLink({ source }: { source: Source }) {
  const { t } = useI18n();
  return (
    <span className="text-xs text-muted">
      {t('scale.source')}:{' '}
      {source.doi ? (
        <a className="underline decoration-line hover:text-ink" href={`https://doi.org/${source.doi}`} target="_blank" rel="noreferrer">
          {source.cite}
        </a>
      ) : (
        t('scale.thisSite')
      )}{' '}
      · {source.where}
    </span>
  );
}

export function ScalePage() {
  const { t, lang } = useI18n();
  const num = (v: number, maxDigits = 0) => v.toLocaleString(LOCALE[lang], { maximumFractionDigits: maxDigits });
  const bytes = (b: number) => {
    const [div, unit] = BYTE_UNITS.find(([d]) => b >= d) ?? [1, { latin: 'B', cyrillic: 'Б' }];
    return `${num(b / div, 2)} ${unit[lang === 'en' ? 'latin' : 'cyrillic']}`;
  };
  const mark = (d: Dataset, field: keyof Dataset['qualifier']) => (d.qualifier[field] ? `${d.qualifier[field]} ` : '');
  const fly = BRAINS[0].neurons;
  const byId = Object.fromEntries(DATASETS.map((d) => [d.id, d]));
  const imagesBytes = byId.fafb.bytes!;
  const modelBytes = byId.model.bytes!;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('scale.title')}</h1>
        <p className="mt-1 text-muted">{t('scale.intro')}</p>
      </div>

      <Panel title={t('scale.neurons')}>
        <ul className="space-y-4" data-testid="scale-brains">
          {BRAINS.map((b) => (
            <li key={b.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium">{t(`scale.brain.${b.id}` as StringKey)}</span>
                <span className="font-mono text-sm">
                  {num(b.neurons)}
                  {b.spread !== null && <span className="text-muted"> ± {num(b.spread)}</span>}
                </span>
              </div>
              <div className="relative mt-1 h-3 rounded-full bg-surface-2" aria-hidden="true">
                <div className="h-3 rounded-full bg-accent" style={{ width: `${(100 * Math.log10(b.neurons)) / LOG_MAX}%` }} />
                {Array.from({ length: LOG_MAX - 1 }, (_, k) => (
                  <span key={k} className="absolute top-0 h-3 w-0.5 bg-bg" style={{ left: `${(100 * (k + 1)) / LOG_MAX}%` }} />
                ))}
              </div>
              <div className="flex flex-wrap justify-between gap-x-3">
                <SourceLink source={b.source} />
                {b.id !== 'fly' && <span className="text-xs text-accent">{t('scale.times', { x: num(sig2(b.neurons / fly)) })}</span>}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">{t('scale.logNote')}</p>
      </Panel>

      <Panel title={t('scale.data')}>
        <ul className="divide-y divide-line" data-testid="scale-datasets">
          {DATASETS.map((d) => (
            <li key={d.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span>{t(`scale.ds.${d.id}` as StringKey)}</span>
                {d.bytes !== null && <span className="font-mono text-lg">{mark(d, 'bytes') + bytes(d.bytes)}</span>}
              </div>
              <div className="font-mono text-xs text-muted">
                {[
                  d.cells !== null && mark(d, 'cells') + t(COUNT_LABEL[d.id], { n: num(d.cells) }),
                  d.synapses !== null && mark(d, 'synapses') + t('scale.synapses', { n: num(d.synapses) }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              <SourceLink source={d.source} />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={t('scale.ratio.title')}>
        <p className="text-sm" data-testid="scale-ratio">
          {t('scale.ratio.text', {
            tb: num(imagesBytes / 1e12),
            mb: num(modelBytes / 1e6, 1),
            x: num(sig2(imagesBytes / modelBytes / 1e6)),
            pb: num(byId.h01.bytes! / 1e15, 1),
          })}
        </p>
        <p className="mt-2 text-xs text-muted">{t('scale.note')}</p>
      </Panel>
    </div>
  );
}
