import { useI18n } from '../i18n';

const CREDITS: Array<{ who: string; what: string; url: string }> = [
  {
    who: 'FlyWire Consortium — Dorkenwald et al., Nature 634, 124–138 (2024)',
    what: 'Neuronal wiring diagram of an adult brain (connectome v783)',
    url: 'https://doi.org/10.1038/s41586-024-07558-y',
  },
  {
    who: 'Schlegel et al., Nature 634, 139–152 (2024)',
    what: 'Cell type annotations (flywire_annotations v3.2.0)',
    url: 'https://doi.org/10.1038/s41586-024-07686-5',
  },
  {
    who: 'Shiu et al., Nature 634, 210–219 (2024)',
    what: 'Leaky integrate-and-fire brain model, parameters and neuron sets (code: MIT)',
    url: 'https://doi.org/10.1038/s41586-024-07763-9',
  },
  {
    who: 'FlyWire Codex (Matsliah et al.)',
    what: 'Data downloads, neuropil meshes and region names',
    url: 'https://codex.flywire.ai',
  },
  {
    who: 'flybrain — snedea; worm-sim — Seth Miller',
    what: 'The browser project this lab was forked from (MIT)',
    url: 'https://github.com/snedea/flybrain',
  },
];

export function AboutPage() {
  const { t } = useI18n();
  return (
    <article className="mx-auto max-w-3xl space-y-8 p-4 py-8 leading-relaxed">
      <h1 className="text-3xl font-semibold">{t('about.title')}</h1>
      <section>
        <h2 className="mb-2 text-xl font-semibold">{t('about.what')}</h2>
        <p>{t('about.whatText')}</p>
      </section>
      <section className="rounded-xl border border-warn/40 bg-warn/10 p-4">
        <h2 className="mb-2 text-xl font-semibold">{t('about.not')}</h2>
        <p>{t('about.notText')}</p>
      </section>
      <section>
        <h2 className="mb-2 text-xl font-semibold">{t('about.credits')}</h2>
        <ul className="space-y-3">
          {CREDITS.map((c) => (
            <li key={c.url}>
              <a href={c.url} className="font-medium text-accent underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
                {c.who}
              </a>
              <p className="text-sm text-muted">{c.what}</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-xl font-semibold">{t('about.author')}</h2>
        <p>Нурдаулет Бейсенбек (Nurdaulet Beisenbek)</p>
      </section>
      <section>
        <h2 className="mb-2 text-xl font-semibold">{t('about.license')}</h2>
        <p>{t('about.licenseText')}</p>
        <p className="mt-2">
          <a href="https://github.com/noncalan/fly-brain-lab" className="text-accent underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
            {t('about.source')}: github.com/noncalan/fly-brain-lab
          </a>
        </p>
      </section>
    </article>
  );
}
