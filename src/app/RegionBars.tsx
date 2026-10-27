const TOP_N = 10;

/** Most active brain regions right now (spikes per second in neurons whose primary neuropil is that region). */
export function RegionBars({ neuropils, regionHz }: { neuropils: string[]; regionHz: Float32Array | null }) {
  if (!regionHz) return null;
  const top = neuropils
    .map((name, i) => ({ name, hz: regionHz[i] }))
    .filter((r) => r.hz > 0.5)
    .sort((a, b) => b.hz - a.hz)
    .slice(0, TOP_N);
  const max = top[0]?.hz ?? 1;
  if (top.length === 0) return <p className="text-sm text-neutral-500">No activity. Choose a stimulus.</p>;
  return (
    <ul className="space-y-1 font-mono text-xs" aria-label="Activity by region, spikes per second">
      {top.map((r) => (
        <li key={r.name} className="grid grid-cols-[4.5rem_1fr_4rem] items-center gap-2">
          <span>{r.name}</span>
          <span className="h-2 rounded bg-emerald-400" style={{ width: `${(100 * r.hz) / max}%` }} />
          <span className="text-right text-neutral-400">{Math.round(r.hz)}/s</span>
        </li>
      ))}
    </ul>
  );
}
