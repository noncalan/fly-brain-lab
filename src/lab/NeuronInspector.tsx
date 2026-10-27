import { useEffect, useState } from 'react';
import { NEUROPIL_NAMES, categoryOf, neuropilBase } from '../content/regions';
import { useI18n, type StringKey } from '../i18n';
import type { NeuronConnections } from '../sim';
import { loadRootIds, type Atlas } from './atlas';

const SIDE_KEY: Array<StringKey | null> = [null, 'opto.left', 'opto.right', 'opto.both'];
const CODEX = 'https://codex.flywire.ai/app/cell_details?cell_names_or_id=';

interface Props {
  neuron: number;
  atlas: Atlas;
  neuropils: string[];
  primaryNeuropil: Uint8Array;
  /** simulated ms of this neuron's last spike, or -1 */
  lastSpikeMs: number;
  nowMs: number;
  connections: (neuron: number) => Promise<NeuronConnections>;
  onActivateType: (type: string) => void;
  onSilenceType: (type: string) => void;
  onPick: (neuron: number) => void;
  onClose: () => void;
}

export function NeuronInspector(p: Props) {
  const { t, n, lang } = useI18n();
  const [conn, setConn] = useState<NeuronConnections | null>(null);
  const [rootId, setRootId] = useState<string | null>(null);
  const { atlas, neuron, connections } = p;
  const type = atlas.types[atlas.typeOf[neuron]];
  const region = p.neuropils[p.primaryNeuropil[neuron]] ?? '';
  const cat = categoryOf(region);
  const sideKey = SIDE_KEY[atlas.sideOf[neuron]];

  useEffect(() => {
    setConn(null);
    connections(neuron).then(setConn, () => setConn(null));
    loadRootIds(`${import.meta.env.BASE_URL}data/`, atlas).then((ids) => setRootId(ids[neuron].toString()), () => setRootId(null));
  }, [neuron, atlas, connections]);

  const label = (i: number) => atlas.types[atlas.typeOf[i]] || `#${i}`;
  const list = (items: NeuronConnections['inputs']) => (
    <ul className="space-y-0.5 font-mono text-xs">
      {items.map((s) => (
        <li key={s.neuron}>
          <button type="button" className="text-left hover:text-accent" onClick={() => p.onPick(s.neuron)}>
            <span className={s.synapses < 0 ? 'text-warn' : ''}>{s.synapses < 0 ? '−' : '+'}</span> {label(s.neuron)}{' '}
            <span className="text-muted">· {t('insp.synapses', { n: Math.abs(s.synapses) })}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-label={t('insp.title')} className="rounded-lg border border-accent/50 bg-surface-2 p-3 text-sm" data-testid="inspector">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-base font-semibold">{type || t('insp.untyped')}</p>
          <p className="text-xs text-muted">
            {p.lastSpikeMs >= 0 ? t('insp.firing', { ago: `${n((p.nowMs - p.lastSpikeMs) / 1000, 2)} s` }) : t('insp.silent')}
          </p>
        </div>
        <button type="button" onClick={p.onClose} className="rounded px-2 text-muted hover:text-ink" aria-label={t('insp.close')}>
          ×
        </button>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-muted">{t('insp.class')}</dt>
        <dd>{atlas.classes[atlas.classOf[neuron]] || '—'}</dd>
        <dt className="text-muted">{t('insp.side')}</dt>
        <dd>{sideKey ? t(sideKey) : '—'}</dd>
        <dt className="text-muted">{t('insp.nt')}</dt>
        <dd>{atlas.nts[atlas.ntOf[neuron]] || '—'}</dd>
        <dt className="text-muted">{t('insp.region')}</dt>
        <dd>
          <span className="font-mono">{region}</span> {NEUROPIL_NAMES[neuropilBase(region)] ? `· ${NEUROPIL_NAMES[neuropilBase(region)]}` : ''}
          {cat ? ` · ${cat.name[lang]}` : ''}
        </dd>
      </dl>
      {conn ? (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-muted">{t('insp.inputs', { count: conn.inputCount })}</p>
            {list(conn.inputs)}
          </div>
          <div>
            <p className="mb-1 text-xs text-muted">{t('insp.outputs', { count: conn.outputCount })}</p>
            {list(conn.outputs)}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">{t('insp.loading')}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {type && (
          <>
            <button type="button" className="rounded-md bg-accent px-2 py-1 text-accent-contrast" onClick={() => p.onActivateType(type)}>
              {t('insp.activate')}
            </button>
            <button type="button" className="rounded-md border border-line px-2 py-1" onClick={() => p.onSilenceType(type)}>
              {t('insp.silence')}
            </button>
          </>
        )}
        {rootId && (
          <a href={`${CODEX}${rootId}`} target="_blank" rel="noreferrer" className="rounded-md border border-line px-2 py-1 text-accent">
            {t('insp.codex')} ↗
          </a>
        )}
      </div>
    </section>
  );
}
