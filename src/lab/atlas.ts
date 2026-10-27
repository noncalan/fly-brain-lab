// Per-neuron identity and position (public/data/neurons.<hash>.bin.gz, tools/build-data/build_neurons.py).

export type Side = 'left' | 'right' | 'both';

export interface Atlas {
  types: string[];
  typeOf: Uint16Array;
  classes: string[];
  classOf: Uint8Array;
  /** 0 unknown, 1 left, 2 right, 3 center */
  sideOf: Uint8Array;
  /** unit-cube positions in the same frame as the neuropil meshes (front view) */
  positions: Float32Array;
  /** neuron indices per type index, built lazily */
  byType: Map<number, number[]>;
}

const SIDE_CODE = { left: 1, right: 2 } as const;

async function gunzipIfNeeded(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const b = new Uint8Array(buf, 0, 2);
  if (b[0] !== 0x1f || b[1] !== 0x8b) return buf;
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

export function parseAtlas(buf: ArrayBuffer, neuronCount: number): Atlas {
  const view = new DataView(buf);
  const jsonLen = view.getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, jsonLen))) as { types: string[]; classes: string[] };
  const n = neuronCount;
  let off = 4 + jsonLen;
  const typeOf = new Uint16Array(buf.slice(off, off + 2 * n));
  off += 2 * n;
  const classOf = new Uint8Array(buf.slice(off, off + n));
  off += n;
  const sideOf = new Uint8Array(buf.slice(off, off + n));
  off += n;
  off += off % 2;
  const q = new Int16Array(buf.slice(off, off + 6 * n));
  const positions = new Float32Array(3 * n);
  for (let i = 0; i < positions.length; i++) positions[i] = -q[i] / 32767; // same inversion as the meshes
  return { types: header.types, typeOf, classes: header.classes, classOf, sideOf, positions, byType: new Map() };
}

let cached: Promise<Atlas> | null = null;

export function loadAtlas(baseUrl: string, neuronCount: number): Promise<Atlas> {
  cached ??= (async () => {
    const manifest = await fetch(`${baseUrl}neurons.json`);
    if (!manifest.ok) throw new Error(`HTTP ${manifest.status} loading neurons.json`);
    const { file } = (await manifest.json()) as { file: string };
    const res = await fetch(`${baseUrl}${file}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} loading ${file}`);
    return parseAtlas(await gunzipIfNeeded(await res.arrayBuffer()), neuronCount);
  })();
  return cached;
}

/** Neuron indices of a FlyWire cell type, optionally one hemisphere only. Empty if the type is unknown. */
export function indicesOfType(atlas: Atlas, type: string, side: Side = 'both'): number[] {
  const t = atlas.types.indexOf(type);
  if (t <= 0) return [];
  let all = atlas.byType.get(t);
  if (!all) {
    all = [];
    for (let i = 0; i < atlas.typeOf.length; i++) if (atlas.typeOf[i] === t) all.push(i);
    atlas.byType.set(t, all);
  }
  return side === 'both' ? all : all.filter((i) => atlas.sideOf[i] === SIDE_CODE[side]);
}

/** Cell types with their neuron counts, for the optogenetics picker. */
export function typeCounts(atlas: Atlas): Array<{ type: string; count: number }> {
  const counts = new Uint32Array(atlas.types.length);
  for (const t of atlas.typeOf) counts[t]++;
  return atlas.types.map((type, i) => ({ type, count: counts[i] })).filter((x) => x.type !== '' && x.count > 0);
}
