import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useI18n } from '../i18n';
import { HISTORY_MS, type History } from './history';

const ROWS_HEATMAP = 20;
const REDRAW_MS = 150;

function token(name: string): [number, number, number] {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/\s+/).map(Number);
  return [v[0], v[1], v[2]];
}

/** Spike raster of watched neurons and a region × time heatmap, drawn from the rolling history. */
export function ActivityHistory({ history, neuropils, labels }: { history: MutableRefObject<History>; neuropils: string[]; labels: string[] }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'raster' | 'heatmap'>('raster');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rowNames, setRowNames] = useState<string[]>([]);

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      const w = (canvas.width = canvas.clientWidth * devicePixelRatio);
      const h = (canvas.height = canvas.clientHeight * devicePixelRatio);
      const bg = token('--surface-2');
      const accent = token('--accent');
      ctx.fillStyle = `rgb(${bg.join(',')})`;
      ctx.fillRect(0, 0, w, h);
      const frames = history.current.frames;
      if (frames.length === 0) return;
      const tEnd = frames[frames.length - 1].timeMs;
      const x = (tMs: number) => w * (1 - (tEnd - tMs) / HISTORY_MS);
      if (mode === 'raster') {
        const rows = history.current.watch.length;
        if (rows === 0) return;
        const rh = h / rows;
        ctx.fillStyle = `rgb(${accent.join(',')})`;
        for (const f of frames) {
          const x0 = x(f.timeMs - f.windowMs);
          const fw = Math.max(1, x(f.timeMs) - x0);
          for (let r = 0; r < rows; r++) if (f.watched[r]) ctx.fillRect(x0, r * rh + rh * 0.15, fw, Math.max(1, rh * 0.7));
        }
      } else {
        const totals = new Float64Array(neuropils.length);
        for (const f of frames) for (let p = 0; p < totals.length; p++) totals[p] += f.neuropilSpikes[p];
        const top = Array.from(totals.keys()).sort((a, b) => totals[b] - totals[a]).slice(0, ROWS_HEATMAP).filter((p) => totals[p] > 0);
        setRowNames((prev) => (prev.join() === top.map((p) => neuropils[p]).join() ? prev : top.map((p) => neuropils[p])));
        if (top.length === 0) return;
        let max = 1;
        for (const f of frames) for (const p of top) max = Math.max(max, (f.neuropilSpikes[p] * 1000) / f.windowMs);
        const rh = h / top.length;
        for (const f of frames) {
          const x0 = x(f.timeMs - f.windowMs);
          const fw = Math.max(1, x(f.timeMs) - x0 + 0.5);
          top.forEach((p, r) => {
            const v = Math.log1p((f.neuropilSpikes[p] * 1000) / f.windowMs) / Math.log1p(max);
            ctx.fillStyle = `rgba(${accent.join(',')},${v.toFixed(3)})`;
            ctx.fillRect(x0, r * rh, fw, rh);
          });
        }
      }
    };
    const timer = setInterval(draw, REDRAW_MS);
    return () => clearInterval(timer);
  }, [history, mode, neuropils]);

  const names = mode === 'raster' ? labels : rowNames;
  return (
    <div>
      <div role="tablist" className="mb-2 flex gap-1 text-sm">
        {(['raster', 'heatmap'] as const).map((m) => (
          <button key={m} role="tab" type="button" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-md px-2 py-1 ${mode === m ? 'bg-ink text-bg' : 'text-muted'}`} data-testid={`hist-${m}`}>
            {t(`hist.${m}`)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[6.5rem_1fr] gap-2">
        <ul className="flex h-48 flex-col justify-around overflow-hidden font-mono text-[10px] leading-none text-muted" aria-hidden="true">
          {names.map((n, i) => (
            <li key={`${n}-${i}`} className="truncate">
              {n}
            </li>
          ))}
        </ul>
        <canvas ref={canvasRef} className="h-48 w-full rounded" role="img" aria-label={t(`hist.${mode}`)} data-testid="history-canvas" />
      </div>
      <p className="mt-1 text-xs text-muted">{mode === 'raster' ? t('hist.rasterHint') : t('hist.heatmapHint', { s: HISTORY_MS / 1000 })}</p>
    </div>
  );
}
