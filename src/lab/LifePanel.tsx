// Controls and readouts of the "alive fly" layer in the lab: who drives the fly, the body's needs, arena tools.
import { Hint } from '../app/Hint';
import { useI18n, type StringKey } from '../i18n';
import { NEEDS, type Need } from '../play/gameFly';
import type { LifeView } from '../play/useLife';

export const ARENA_TOOLS = ['food', 'water', 'poke'] as const;
export type ArenaTool = (typeof ARENA_TOOLS)[number];

const NEED_COLOR: Record<Need, string> = {
  hunger: '#c08a1e',
  thirst: '#3b9ee0',
  fear: '#8b5cf6',
  pain: '#e0453b',
  fatigue: '#8a94a6',
  curiosity: '#2f9e55',
};

export function LifePanel({ view, enabled, onEnabled, tool, onTool, onClap, onReset }: {
  view: LifeView | null;
  enabled: boolean;
  onEnabled: (on: boolean) => void;
  tool: ArenaTool;
  onTool: (t: ArenaTool) => void;
  onClap: () => void;
  onReset: () => void;
}) {
  const { t, n } = useI18n();
  const btn = 'rounded-md border border-line px-3 py-1 hover:border-accent';
  const control = !enabled ? t('life.off') : view?.control === 'script' ? t('life.script', { mode: t(`play.mode.${view.fly.mode}` as StringKey) }) : t('life.neurons');
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-line p-3 text-sm" data-testid="life">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 font-medium">
          <input type="checkbox" checked={enabled} onChange={(e) => onEnabled(e.target.checked)} data-testid="life-toggle" />
          {t('life.toggle')}
        </label>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${enabled && view?.control === 'script' ? 'bg-surface-2 text-muted' : 'bg-accent/15 text-accent'}`}
          aria-live="polite"
          data-testid="life-control"
          data-control={enabled ? (view?.control ?? 'neurons') : 'neurons'}
        >
          {control}
        </span>
      </div>
      {enabled && view && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">{t('life.needs')}</p>
          <ul className="mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-2" data-testid="life-needs">
            {NEEDS.map((need) => (
              <li key={need} className="grid grid-cols-[6rem_1fr_2rem] items-center gap-2">
                <span>{t(`play.need.${need}` as StringKey)}</span>
                <span className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  <span className="block h-full rounded-full" style={{ width: `${view.fly.needs[need] * 100}%`, background: NEED_COLOR[need] }} />
                </span>
                <span className="text-right font-mono text-xs text-muted" data-testid={`life-need-${need}`}>
                  {n(view.fly.needs[need] * 100)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 font-mono text-xs text-muted">
            {t('play.hits')} <span data-testid="life-hits">{view.fly.stats.hits}</span> · {t('play.eaten')} {view.fly.stats.eaten} · {t('play.drunk')} {view.fly.stats.drunk} · {t('play.flight')}{' '}
            {t('play.seconds', { n: n(view.fly.stats.flightS, 1) })}
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted">{t('play.tool')}:</span>
        <div role="radiogroup" aria-label={t('play.tool')} className="flex overflow-hidden rounded-md border border-line">
          {ARENA_TOOLS.map((x) => (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={tool === x}
              onClick={() => onTool(x)}
              className={`px-2.5 py-1 ${tool === x ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}
              data-testid={`tool-${x}`}
            >
              {t(`play.tool.${x}` as StringKey)}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClap} className={btn} data-testid="clap">
          {t('play.clap')}
        </button>
        <button type="button" onClick={onReset} className={btn}>
          {t('play.clear')}
        </button>
      </div>
      <p className="flex items-center gap-2 text-xs text-muted">
        {t('life.short')}
        <Hint>{t('life.hint')}</Hint>
      </p>
    </div>
  );
}
