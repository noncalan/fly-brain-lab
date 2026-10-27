import { useI18n } from '../i18n';

export const SPEEDS = [0.1, 0.25, 0.5, 1];
const STEP_MS = 10;
/** Below this fraction of the requested speed we tell the user their device is the bottleneck. */
const SLOW_FRACTION = 0.8;

interface Props {
  speed: number;
  paused: boolean;
  timeMs: number;
  realtimeFactor: number;
  onPause: (paused: boolean) => void;
  onSpeed: (s: number) => void;
  onStep: (ms: number) => void;
  onReset: () => void;
}

export function TimeControls({ speed, paused, timeMs, realtimeFactor, onPause, onSpeed, onStep, onReset }: Props) {
  const { t, n } = useI18n();
  const slow = !paused && realtimeFactor < speed * SLOW_FRACTION;
  const btn = 'rounded-md border border-line bg-surface-2 px-3 py-1.5 hover:border-accent disabled:opacity-40';
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <button type="button" className={btn} onClick={() => onPause(!paused)} data-testid="pause">
        {paused ? `▶ ${t('time.play')}` : `❚❚ ${t('time.pause')}`}
      </button>
      <div role="radiogroup" aria-label={t('time.speed')} className="flex overflow-hidden rounded-md border border-line">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={speed === s}
            onClick={() => onSpeed(s)}
            className={`px-2.5 py-1.5 font-mono ${speed === s ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}
          >
            ×{s}
          </button>
        ))}
      </div>
      <button type="button" className={btn} onClick={() => onStep(STEP_MS)} disabled={!paused} aria-label={t('time.stepLabel')}>
        {t('time.step')}
      </button>
      <button type="button" className={btn} onClick={onReset}>
        {t('time.reset')}
      </button>
      <p className="ml-auto font-mono text-xs text-muted" aria-live="off" data-testid="time-status">
        {t('time.simTime', { t: n(timeMs / 1000, 2) })} ·{' '}
        <span className={slow ? 'text-warn' : ''} title={slow ? t('time.slow') : undefined}>
          {paused ? t('time.paused') : t('time.realtime', { factor: n(realtimeFactor, 2) })}
        </span>
      </p>
    </div>
  );
}
