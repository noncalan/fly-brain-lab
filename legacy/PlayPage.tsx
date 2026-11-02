import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Panel } from '../app/shell';
import type { ArenaMark, FlyDrive } from '../fly/Fly3D';
import type { FlyState } from '../fly/locomotion';
import { useI18n, type StringKey } from '../i18n';
import { NEEDS, createFly, hit, isAirborne, render, scare, stepFly, type GameFly, type Item, type Need } from '../play/gameFly';

const Fly3D = lazy(() => import('../fly/Fly3D'));
const ARENA_MM = 60;
const UI_EVERY_MS = 100;
/** a tap on the floor closer than this (mm) startles the fly more */
const NEAR_TAP_MM = 12;
/** a click on the floor this close (mm) to a fly on the ground hits it */
const HIT_MM = 4;
const USED_UP = 0.02;
const TOOLS = ['food', 'water', 'poke'] as const;
type Tool = (typeof TOOLS)[number];
const NEED_COLOR: Record<Need, string> = {
  hunger: '#c08a1e',
  thirst: '#3b9ee0',
  fear: '#8b5cf6',
  pain: '#e0453b',
  fatigue: '#8a94a6',
  curiosity: '#2f9e55',
};
const rng = Math.random;

export function PlayPage() {
  const { t, n } = useI18n();
  const flyRef = useRef<GameFly>(createFly(rng));
  const items = useRef<Item[]>([]);
  const drive = useRef<FlyDrive>({ command: { speed: 0, turnRate: 0 }, feeding: false, escape: false, grooming: false, pendingSimMs: 0, pose: null });
  const flyState = useRef<FlyState>({ x: 0, z: 0, heading: 0 });
  const [view, setView] = useState<GameFly>(flyRef.current);
  const [marks, setMarks] = useState<ArenaMark[]>([]);
  const [tool, setTool] = useState<Tool>('food');
  const nextId = useRef(1);

  const syncMarks = useCallback(() => {
    items.current = items.current.filter((i) => i.amount > USED_UP);
    setMarks(items.current.map((i) => ({ id: i.id, x: i.x, z: i.z, kind: i.kind })));
  }, []);

  // the game loop: the script decides, Fly3D only draws the pose it is given
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const f = stepFly(flyRef.current, dt, { items: items.current, arenaRadius: ARENA_MM }, rng);
      flyRef.current = f;
      const r = render(f);
      const d = drive.current;
      d.pose = r.pose;
      d.command = r.command;
      d.feeding = r.feeding;
      d.grooming = r.grooming;
      d.pendingSimMs += Math.min(dt, 0.1) * 1000;
      if (now - lastUi > UI_EVERY_MS) {
        lastUi = now;
        setView(f);
        if (items.current.some((i) => i.amount <= USED_UP)) syncMarks();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [syncMarks]);

  const onArenaClick = useCallback(
    (x: number, z: number) => {
      const f = flyRef.current;
      const d = Math.hypot(f.x - x, f.z - z);
      // the fly is only a few millimetres long: a click right next to it on the floor counts as hitting it
      if (d < HIT_MM && !isAirborne(f)) {
        flyRef.current = hit(f, 1);
        return;
      }
      if (tool === 'poke') {
        flyRef.current = scare(f, d < NEAR_TAP_MM ? 0.8 : 0.25);
        return;
      }
      items.current = [...items.current, { id: `i${nextId.current++}`, kind: tool, x, z, amount: 1 }];
      syncMarks();
    },
    [tool, syncMarks],
  );
  const onFlyClick = useCallback(() => {
    flyRef.current = hit(flyRef.current, 1);
  }, []);
  const reset = () => {
    flyRef.current = createFly(rng);
    items.current = [];
    syncMarks();
  };
  const btn = 'rounded-md border border-line px-3 py-1 hover:border-accent';

  const f = view;
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('play.title')}</h1>
        <p className="mt-2 max-w-4xl rounded-lg border border-warn/50 bg-warn/10 p-3 text-sm text-warn" role="note" data-testid="play-banner">
          {t('play.banner')}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Panel title={t('play.title')}>
          <div className="h-80 overflow-hidden rounded-lg sm:h-[28rem]" data-testid="play-arena">
            <Suspense fallback={<div className="h-full animate-pulse bg-surface-2" />}>
              <Fly3D drive={drive} state={flyState} marks={marks} label={t('play.arena')} onArenaClick={onArenaClick} onFlyClick={onFlyClick} view="wide" />
            </Suspense>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{t('play.tool')}:</span>
            <div role="radiogroup" aria-label={t('play.tool')} className="flex overflow-hidden rounded-md border border-line">
              {TOOLS.map((x) => (
                <button
                  key={x}
                  type="button"
                  role="radio"
                  aria-checked={tool === x}
                  onClick={() => setTool(x)}
                  className={`px-3 py-1 ${tool === x ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}
                  data-testid={`play-tool-${x}`}
                >
                  {t(`play.tool.${x}` as StringKey)}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => (flyRef.current = scare(flyRef.current, 0.9))} className={btn} data-testid="play-clap">
              {t('play.clap')}
            </button>
            <button
              type="button"
              onClick={() => {
                items.current = [];
                syncMarks();
              }}
              className={btn}
            >
              {t('play.clear')}
            </button>
            <button type="button" onClick={reset} className={btn}>
              {t('play.reset')}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">{t('play.hint')}</p>
        </Panel>
        <Panel title={t('play.state')}>
          <p className="text-sm">
            {t('play.state')}{' '}
            <span className="font-mono font-semibold uppercase tracking-wide text-accent" data-testid="play-mode">
              {t(`play.mode.${f.mode}` as StringKey)}
            </span>
          </p>
          <ul className="mt-3 space-y-2" data-testid="play-needs">
            {NEEDS.map((need) => (
              <li key={need} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-sm">
                <span>{t(`play.need.${need}` as StringKey)}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full" style={{ width: `${f.needs[need] * 100}%`, background: NEED_COLOR[need] }} />
                </span>
                <span className="text-right font-mono text-xs text-muted" data-testid={`play-need-${need}`}>
                  {n(f.needs[need] * 100)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs text-muted">
            <dt>{t('play.hits')}</dt>
            <dd data-testid="play-hits">{f.stats.hits}</dd>
            <dt>{t('play.eaten')}</dt>
            <dd>{f.stats.eaten}</dd>
            <dt>{t('play.drunk')}</dt>
            <dd>{f.stats.drunk}</dd>
            <dt>{t('play.flight')}</dt>
            <dd>{t('play.seconds', { n: n(f.stats.flightS, 1) })}</dd>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
