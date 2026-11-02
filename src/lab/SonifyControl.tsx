import { useEffect, useState } from 'react';
import { categoryOf } from '../content/regions';
import { useI18n } from '../i18n';
import { MAX_CLICKS_PER_SEC, type SpikeSonifier } from './sonify';

/** Switch the spike sound on and choose which brain region to listen to. */
export function SonifyControl({ sonifier, neuropils, suggest }: { sonifier: SpikeSonifier; neuropils: string[]; suggest: () => string | null }) {
  const { t, lang } = useI18n();
  const [on, setOn] = useState(false);
  const [region, setRegion] = useState('all');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const p = neuropils.indexOf(region);
    sonifier.source = p >= 0 ? { region: p } : 'all';
  }, [region, neuropils, sonifier]);
  useEffect(() => () => sonifier.stop(), [sonifier]);

  const toggle = async () => {
    if (on) {
      sonifier.stop();
      setOn(false);
      return;
    }
    try {
      if (region === 'all') {
        const top = suggest();
        if (top) setRegion(top);
      }
      await sonifier.start();
      setFailed(false);
      setOn(true);
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="sonify">
      <button
        type="button"
        aria-pressed={on}
        onClick={toggle}
        className={`rounded-md border px-3 py-1 ${on ? 'border-accent bg-accent text-accent-contrast' : 'border-line hover:border-accent'}`}
        data-testid="sonify-toggle"
      >
        {on ? t('snd.off') : t('snd.on')}
      </button>
      <label className="flex items-center gap-1">
        <span className="text-muted">{t('snd.region')}</span>
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="rounded-md border border-line bg-surface-2 px-2 py-1" data-testid="sonify-region">
          <option value="all">{t('snd.all')}</option>
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
      <p className="w-full text-xs text-muted">{failed ? t('snd.failed') : t('snd.hint', { max: MAX_CLICKS_PER_SEC })}</p>
    </div>
  );
}
