import { useRef, useState, type RefObject } from 'react';
import stimuliConfig from '../../config/stimuli.json';
import { useI18n, type StringKey } from '../i18n';

const DRAG_START_PX = 6;
const CATEGORIES = ['taste', 'mechano', 'climate', 'vision', 'smell'] as const;
const FALLBACK_ICON = 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16';
type Stimulus = (typeof stimuliConfig.stimuli)[number];

const ICONS: Record<string, string> = {
  sugar: 'M12 3l7 4v10l-7 4-7-4V7z',
  water: 'M12 3c3 5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6 6-11z',
  bitter: 'M6 4h12l-2 16H8z M9 9h6',
  heat: 'M12 3v10a4 4 0 1 0 0 0M12 3a2 2 0 0 1 2 2v8',
  antenna_touch: 'M8 20c0-8 2-12 8-16M12 20c0-6 3-10 7-12M5 9l3 2',
  looming: 'M4 8h16M7 4h10M2 12h20 M12 15v6',
  cold: 'M12 2v20M4 6l16 12M20 6L4 18',
  sound: 'M4 10v4h4l5 4V6L8 10zM16 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12',
  smell: 'M8 20c-2-4 2-6 0-10s2-6 0-8M14 20c-2-4 2-6 0-10s2-6 0-8',
  climate: 'M3 12h18M6 8h12M9 16h6',
  vision: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
  mechano: 'M8 20c0-8 2-12 8-16',
};

interface Props {
  active: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onActivate: (id: string) => void;
  dropTarget: RefObject<HTMLElement>;
  onDragOver: (over: boolean) => void;
}

/** Stimulus chips. Click toggles; dragging a chip onto the fly turns it on. Both work with keyboard via click. */
export function StimulusPalette({ active, onToggle, onActivate, dropTarget, onDragOver }: Props) {
  const { t } = useI18n();
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number } | null>(null);
  const drag = useRef<{ id: string; x0: number; y0: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);

  const overTarget = (x: number, y: number) => {
    const r = dropTarget.current?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  const groups: Array<{ key: StringKey; items: Stimulus[] }> = CATEGORIES.map((c) => ({
    key: `cat.${c}` as StringKey,
    items: stimuliConfig.stimuli.filter((s) => s.category === c),
  }));

  return (
    <div>
      <p className="mb-3 text-sm text-muted">{t('stim.hint')}</p>
      {groups.map((g) => (
        <div key={g.key} className="mb-3">
          <h3 className="mb-1.5 text-xs font-medium text-muted">{t(g.key)}</h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t(g.key)}>
            {g.items.map((s) => {
              const on = active.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  title={t(`stim.desc.${s.id}` as StringKey)}
                  data-testid={`stim-${s.id}`}
                  onClick={() => {
                    if (suppressClick.current) {
                      suppressClick.current = false;
                      return;
                    }
                    onToggle(s.id);
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    drag.current = { id: s.id, x0: e.clientX, y0: e.clientY, dragging: false };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const d = drag.current;
                    if (!d) return;
                    if (!d.dragging && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > DRAG_START_PX) d.dragging = true;
                    if (d.dragging) {
                      setGhost({ id: d.id, x: e.clientX, y: e.clientY });
                      onDragOver(overTarget(e.clientX, e.clientY));
                    }
                  }}
                  onPointerUp={(e) => {
                    const d = drag.current;
                    drag.current = null;
                    if (d?.dragging) {
                      suppressClick.current = true;
                      if (overTarget(e.clientX, e.clientY)) onActivate(d.id);
                    }
                    setGhost(null);
                    onDragOver(false);
                  }}
                  onPointerCancel={() => {
                    drag.current = null;
                    setGhost(null);
                    onDragOver(false);
                  }}
                  className={`flex touch-none select-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    on ? 'border-accent bg-accent text-accent-contrast' : 'border-line bg-surface-2 hover:border-accent'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d={ICONS[s.id] ?? ICONS[s.category] ?? FALLBACK_ICON} />
                  </svg>
                  {t(`stim.${s.id}` as StringKey)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {ghost && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent px-3 py-1.5 text-sm text-accent-contrast shadow-lg"
          style={{ left: ghost.x, top: ghost.y }}
          aria-hidden="true"
        >
          {t(`stim.${ghost.id}` as StringKey)}
        </div>
      )}
    </div>
  );
}
