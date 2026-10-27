// Everything that defines an experiment, and its compact URL form so it can be shared as a link.
//   ?s=sugar:150,bitter:100   stimuli (id:rate Hz)
//   &o=DNp09.r:150            optogenetic activation of a FlyWire cell type (.l / .r = one side)
//   &x=GNG,t.MN9              lesions: neuropil names, or t.<cell type> to silence a type
import type { Side } from './atlas';

export interface OptoTarget {
  type: string;
  side: Side;
  rateHz: number;
}

export type Lesion = { neuropil: string } | { type: string };

export interface LabState {
  stimuli: Record<string, number>;
  opto: OptoTarget[];
  lesions: Lesion[];
}

export const EMPTY_STATE: LabState = { stimuli: {}, opto: [], lesions: [] };
const MAX_RATE_HZ = 500;
const NAME = /^[\w.+-]{1,64}$/;

function rate(v: string | undefined): number | null {
  const r = Number(v);
  return Number.isFinite(r) && r > 0 && r <= MAX_RATE_HZ ? r : null;
}

export function encodeState(s: LabState): string {
  const p = new URLSearchParams();
  const stim = Object.entries(s.stimuli).map(([id, hz]) => `${id}:${hz}`);
  if (stim.length) p.set('s', stim.join(','));
  const opto = s.opto.map((o) => `${o.type}${o.side === 'both' ? '' : o.side === 'left' ? '.l' : '.r'}:${o.rateHz}`);
  if (opto.length) p.set('o', opto.join(','));
  const les = s.lesions.map((l) => ('neuropil' in l ? l.neuropil : `t.${l.type}`));
  if (les.length) p.set('x', les.join(','));
  return p.toString();
}

/** Parses untrusted URL input; anything malformed is dropped. */
export function decodeState(query: string, knownStimuli: ReadonlySet<string>): LabState {
  const p = new URLSearchParams(query);
  const stimuli: Record<string, number> = {};
  for (const item of (p.get('s') ?? '').split(',')) {
    const [id, hz] = item.split(':');
    const r = rate(hz);
    if (knownStimuli.has(id) && r !== null) stimuli[id] = r;
  }
  const opto: OptoTarget[] = [];
  for (const item of (p.get('o') ?? '').split(',')) {
    const [name, hz] = item.split(':');
    const r = rate(hz);
    if (!name || r === null) continue;
    const m = /^(.*?)(\.(l|r))?$/.exec(name)!;
    if (!NAME.test(m[1])) continue;
    opto.push({ type: m[1], side: m[3] === 'l' ? 'left' : m[3] === 'r' ? 'right' : 'both', rateHz: r });
  }
  const lesions: Lesion[] = [];
  for (const item of (p.get('x') ?? '').split(',')) {
    if (!item) continue;
    if (item.startsWith('t.') && NAME.test(item.slice(2))) lesions.push({ type: item.slice(2) });
    else if (NAME.test(item)) lesions.push({ neuropil: item });
  }
  return { stimuli, opto, lesions };
}
