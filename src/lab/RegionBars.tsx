import { categoryOf } from '../content/regions';
import { useI18n } from '../i18n';

const TOP_N = 8;
const MIN_HZ = 0.5;

export interface RegionRate {
  name: string;
  hz: number;
}

/** Most active brain regions right now: spikes per second of neurons whose main neuropil is that region. */
export function RegionBars({ regions }: { regions: RegionRate[] }) {
  const { t, n, lang } = useI18n();
  const top = regions.filter((r) => r.hz > MIN_HZ).slice(0, TOP_N);
  if (top.length === 0) return <p className="text-sm text-muted">{t('brain.none')}</p>;
  const max = top[0].hz;
  return (
    <ul className="space-y-1.5" aria-label={`${t('brain.bars')}, ${t('brain.barsUnit')}`}>
      {top.map((r) => {
        const cat = categoryOf(r.name);
        return (
          <li key={r.name} className="grid grid-cols-[minmax(0,9rem)_1fr_4.5rem] items-center gap-2 text-xs" title={cat?.role[lang]}>
            <span className="truncate">
              <span className="font-mono">{r.name}</span>
              {cat && <span className="text-muted"> · {cat.name[lang]}</span>}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(100 * r.hz) / max}%` }} />
            </span>
            <span className="text-right font-mono text-muted">{n(r.hz)}</span>
          </li>
        );
      })}
    </ul>
  );
}
