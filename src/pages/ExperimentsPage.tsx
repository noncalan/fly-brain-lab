import experimentsConfig from '../../config/experiments.json';
import { useI18n, type StringKey } from '../i18n';

type SourceId = keyof typeof experimentsConfig.sources;

export function ExperimentsPage({ open }: { open: (query: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-7xl p-4 py-8">
      <h1 className="text-3xl font-semibold">{t('exp.title')}</h1>
      <p className="mt-2 max-w-3xl text-muted">{t('exp.intro')}</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {experimentsConfig.experiments.map((e) => {
          const source = e.source ? experimentsConfig.sources[e.source as SourceId] : null;
          return (
            <li key={e.id} className="flex flex-col rounded-xl border border-line bg-surface p-4" data-testid={`exp-${e.id}`}>
              <h2 className="font-semibold">{t(`exp.${e.id}.title` as StringKey)}</h2>
              <p className="mt-2 flex-1 text-sm">{t(`exp.${e.id}.text` as StringKey)}</p>
              {source ? (
                <p className="mt-3 text-xs text-muted">
                  {t('exp.source')}:{' '}
                  <a href={`https://doi.org/${source.doi}`} target="_blank" rel="noreferrer" className="text-accent underline-offset-4 hover:underline">
                    {source.cite}
                  </a>
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted">{t('exp.noClaim')}</p>
              )}
              <a
                href={`/?${e.query}`}
                onClick={(ev) => {
                  ev.preventDefault();
                  open(e.query);
                }}
                className="mt-3 inline-block self-start rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast"
              >
                {t('exp.open')}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
