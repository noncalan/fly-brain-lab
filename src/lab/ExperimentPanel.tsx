import { useMemo, useState, type ReactNode, type RefObject } from 'react';
import { categoryOf } from '../content/regions';
import { useI18n } from '../i18n';
import { indicesOfType, typeCounts, type Atlas, type Side } from './atlas';
import type { LabState, Lesion, OptoTarget } from './labState';
import { StimulusPalette } from './StimulusPalette';

const OPTO_RATES = [50, 100, 150, 200];
const MAX_SUGGESTIONS = 12;
type Tab = 'stimuli' | 'opto' | 'lesion';

interface Props {
  state: LabState;
  onChange: (s: LabState) => void;
  atlas: Atlas | null;
  neuropils: string[];
  dropTarget: RefObject<HTMLElement>;
  onDragOver: (over: boolean) => void;
  defaultRate: (stimulusId: string) => number;
  shareUrl: string;
}

function Chip({ children, onRemove, label }: { children: ReactNode; onRemove: () => void; label: string }) {
  return (
    <li className="flex items-center gap-1 rounded-full border border-accent/60 bg-accent/10 py-1 pl-3 pr-1 text-sm">
      {children}
      <button type="button" onClick={onRemove} aria-label={label} className="rounded-full px-1.5 text-muted hover:text-ink">
        ×
      </button>
    </li>
  );
}

function TypePicker({ atlas, onPick, actionLabel }: { atlas: Atlas; onPick: (type: string) => void; actionLabel: string }) {
  const { t } = useI18n();
  const all = useMemo(() => typeCounts(atlas), [atlas]);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = q ? all.filter((x) => x.type.toLowerCase().includes(q)).sort((a, b) => a.type.length - b.type.length).slice(0, MAX_SUGGESTIONS) : [];
  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('opto.search')}
        aria-label={t('opto.search')}
        className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm"
        data-testid="type-search"
      />
      {matches.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {matches.map((m) => (
            <li key={m.type}>
              <button
                type="button"
                onClick={() => {
                  onPick(m.type);
                  setQuery('');
                }}
                className="rounded-md border border-line px-2 py-1 font-mono text-xs hover:border-accent"
                aria-label={`${actionLabel}: ${m.type}`}
              >
                {m.type} <span className="text-muted">· {t('opto.neurons', { count: m.count })}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ExperimentPanel({ state, onChange, atlas, neuropils, dropTarget, onDragOver, defaultRate, shareUrl }: Props) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>('stimuli');
  const [side, setSide] = useState<Side>('both');
  const [rate, setRate] = useState(150);
  const [copied, setCopied] = useState(false);
  const [region, setRegion] = useState('');

  const toggleStimulus = (id: string, on: boolean) => {
    const stimuli = { ...state.stimuli };
    if (on) stimuli[id] = defaultRate(id);
    else delete stimuli[id];
    onChange({ ...state, stimuli });
  };
  const addOpto = (type: string) => {
    const opto = state.opto.filter((o) => !(o.type === type && o.side === side));
    onChange({ ...state, opto: [...opto, { type, side, rateHz: rate }] });
  };
  const removeOpto = (o: OptoTarget) => onChange({ ...state, opto: state.opto.filter((x) => x !== o) });
  const addLesion = (l: Lesion) => {
    const key = (x: Lesion) => ('neuropil' in x ? `n:${x.neuropil}` : `t:${x.type}`);
    if (state.lesions.some((x) => key(x) === key(l))) return;
    onChange({ ...state, lesions: [...state.lesions, l] });
  };

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'stimuli', label: t('tab.stimuli'), count: Object.keys(state.stimuli).length },
    { id: 'opto', label: t('tab.opto'), count: state.opto.length },
    { id: 'lesion', label: t('tab.lesion'), count: state.lesions.length },
  ];
  const regions = neuropils.filter((n) => n !== 'UNASGD').sort();

  return (
    <div>
      <div role="tablist" aria-label={t('exp.title')} className="mb-3 flex flex-wrap gap-1 border-b border-line">
        {tabs.map((x) => (
          <button
            key={x.id}
            role="tab"
            type="button"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            data-testid={`tab-${x.id}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === x.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {x.label}
            {x.count > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 text-xs text-accent-contrast">{x.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'stimuli' && (
        <StimulusPalette
          active={new Set(Object.keys(state.stimuli))}
          onToggle={(id) => toggleStimulus(id, !(id in state.stimuli))}
          onActivate={(id) => toggleStimulus(id, true)}
          dropTarget={dropTarget}
          onDragOver={onDragOver}
        />
      )}

      {tab === 'opto' && (
        <div className="space-y-3">
          <p className="text-sm text-muted">{t('opto.hint')}</p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted">{t('opto.side')}</span>
            <div role="radiogroup" aria-label={t('opto.side')} className="flex overflow-hidden rounded-md border border-line">
              {(['both', 'left', 'right'] as const).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={side === s} onClick={() => setSide(s)} className={`px-2.5 py-1 ${side === s ? 'bg-ink text-bg' : 'text-muted'}`}>
                  {t(`opto.${s}`)}
                </button>
              ))}
            </div>
            <span className="text-muted">{t('opto.rate')}</span>
            <div role="radiogroup" aria-label={t('opto.rate')} className="flex overflow-hidden rounded-md border border-line font-mono">
              {OPTO_RATES.map((r) => (
                <button key={r} type="button" role="radio" aria-checked={rate === r} onClick={() => setRate(r)} className={`px-2 py-1 ${rate === r ? 'bg-ink text-bg' : 'text-muted'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          {atlas ? <TypePicker atlas={atlas} onPick={addOpto} actionLabel={t('opto.add')} /> : <p className="text-sm text-muted">{t('opto.loading')}</p>}
          <h3 className="text-xs font-medium text-muted">{t('opto.active')}</h3>
          {state.opto.length === 0 ? (
            <p className="text-sm text-muted">{t('opto.none')}</p>
          ) : (
            <ul className="flex flex-wrap gap-2" data-testid="opto-active">
              {state.opto.map((o) => (
                <Chip key={`${o.type}.${o.side}`} onRemove={() => removeOpto(o)} label={`${t('common.remove')} ${o.type}`}>
                  <span className="font-mono">{o.type}</span>
                  <span className="text-muted">
                    {o.side !== 'both' ? ` · ${t(`opto.${o.side}`)}` : ''} · {o.rateHz} Hz
                    {atlas ? ` · ${t('opto.neurons', { count: indicesOfType(atlas, o.type, o.side).length })}` : ''}
                  </span>
                </Chip>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'lesion' && (
        <div className="space-y-3">
          <p className="text-sm text-muted">{t('lesion.hint')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-muted" htmlFor="lesion-region">
              {t('lesion.region')}
            </label>
            <select
              id="lesion-region"
              value={region}
              onChange={(e) => {
                setRegion('');
                if (e.target.value) addLesion({ neuropil: e.target.value });
              }}
              className="rounded-md border border-line bg-surface-2 px-2 py-1.5 text-sm"
              data-testid="lesion-region"
            >
              <option value="">{t('lesion.pick')}</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                  {categoryOf(r) ? ` · ${categoryOf(r)!.name[lang]}` : ''}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-muted">{t('lesion.type')}</p>
          {atlas ? <TypePicker atlas={atlas} onPick={(type) => addLesion({ type })} actionLabel={t('lesion.type')} /> : <p className="text-sm text-muted">{t('opto.loading')}</p>}
          <h3 className="text-xs font-medium text-muted">{t('lesion.active')}</h3>
          {state.lesions.length === 0 ? (
            <p className="text-sm text-muted">{t('lesion.none')}</p>
          ) : (
            <ul className="flex flex-wrap gap-2" data-testid="lesion-active">
              {state.lesions.map((l) => {
                const name = 'neuropil' in l ? l.neuropil : l.type;
                return (
                  <Chip key={name} onRemove={() => onChange({ ...state, lesions: state.lesions.filter((x) => x !== l) })} label={`${t('common.remove')} ${name}`}>
                    <span className="font-mono">{name}</span>
                  </Chip>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3 text-sm">
        <button
          type="button"
          className="rounded-md border border-line px-3 py-1.5 hover:border-accent"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shareUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              window.prompt(t('common.share'), shareUrl);
            }
          }}
        >
          {copied ? t('common.copied') : t('common.share')}
        </button>
        <button type="button" className="rounded-md border border-line px-3 py-1.5 hover:border-accent" onClick={() => onChange({ stimuli: {}, opto: [], lesions: [] })}>
          {t('common.clearAll')}
        </button>
      </div>
    </div>
  );
}
