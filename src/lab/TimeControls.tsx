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

/** One compact row on phones (icons, short status); full labels from the `sm` breakpoint up. */
export function TimeControls({ speed, paused, timeMs, realtimeFactor, onPause, onSpeed, onStep, onReset }: Props) {
  const { t, n } = useI18n();
  const slow = !paused && realtimeFactor < speed * SLOW_FRACTION;
  const btn = 'shrink-0 rounded-md border border-line bg-surface-2 px-2 py-1 hover:border-accent disabled:opacity-40 sm:px-3 sm:py-1.5';
  return (
    <div className="flex items-center gap-1.5 text-sm sm:flex-wrap sm:gap-3">
      <button type="button" className={btn} onClick={() => onPause(!paused)} aria-label={paused ? t('time.play') : t('time.pause')} data-testid="pause">
        <span aria-hidden="true">{paused ? '▶' : '❚❚'}</span>
        <span className="hidden sm:inline"> {paused ? t('time.play') : t('time.pause')}</span>
      </button>
      <div role="radiogroup" aria-label={t('time.speed')} className="flex shrink-0 overflow-hidden rounded-md border border-line">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={speed === s}
            onClick={() => onSpeed(s)}
            className={`px-1.5 py-1 font-mono text-xs sm:px-2.5 sm:py-1.5 sm:text-sm ${speed === s ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}
          >
            ×{s}
          </button>
        ))}
      </div>
      <button type="button" className={btn} onClick={() => onStep(STEP_MS)} disabled={!paused} aria-label={t('time.stepLabel')}>
        {t('time.step')}
      </button>
      <button type="button" className={btn} onClick={onReset} aria-label={t('time.reset')}>
        <span aria-hidden="true" className="sm:hidden">↺</span>
        <span className="hidden sm:inline">{t('time.reset')}</span>
      </button>
      <p className="ml-auto min-w-0 truncate text-right font-mono text-xs text-muted" aria-live="off" data-testid="time-status">
        <span className="hidden sm:inline">{t('time.simTime', { t: n(timeMs / 1000, 2) })} · </span>
        <span className={slow ? 'text-warn' : ''} title={slow ? t('time.slow') : undefined}>
          {paused ? (
            t('time.paused')
          ) : (
            <>
              <span className="sm:hidden">×{n(realtimeFactor, 2)}</span>
              <span className="hidden sm:inline">{t('time.realtime', { factor: n(realtimeFactor, 2) })}</span>
            </>
          )}
        </span>
      </p>
    </div>
  );
}
