import type { Connectome, NeuronSet } from './types';

/** Shape of public/data/meta.json written by tools/build-data/build_connectome.py. */
export interface ConnectomeMeta {
  format: 'FBL1';
  neuron_count: number;
  edge_count: number;
  synapse_count: number;
  inhibitory_edge_fraction: number;
  min_synapses: number;
  neuropils: string[];
  sets: Record<string, NeuronSet>;
  source: string;
}

const MAGIC = 'FBL1';
const HEADER_BYTES = 16;

/** Parse an uncompressed FBL1 buffer (see build_connectome.py for the layout). */
export function parseFbl1(buffer: ArrayBuffer, meta: ConnectomeMeta): Connectome {
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== MAGIC) throw new Error(`Not an FBL1 connectome (magic "${magic}")`);
  const n = view.getUint32(4, true);
  const e = view.getUint32(8, true);
  const p = view.getUint32(12, true);
  if (n !== meta.neuron_count || e !== meta.edge_count || p !== meta.neuropils.length) {
    throw new Error(`Connectome/meta mismatch: binary N=${n} E=${e} P=${p}, meta N=${meta.neuron_count} E=${meta.edge_count}`);
  }
  const expected = HEADER_BYTES + 4 * (n + 1) + 4 * e + 2 * e + n;
  if (buffer.byteLength !== expected) throw new Error(`FBL1 size ${buffer.byteLength}, expected ${expected}`);

  // Copy into aligned typed arrays (the i16/u8 sections are not 4-byte aligned in general).
  let offset = HEADER_BYTES;
  const rowPtr = new Uint32Array(buffer.slice(offset, offset + 4 * (n + 1)));
  offset += 4 * (n + 1);
  const col = new Uint32Array(buffer.slice(offset, offset + 4 * e));
  offset += 4 * e;
  const weight = new Int16Array(buffer.slice(offset, offset + 2 * e));
  offset += 2 * e;
  const primaryNeuropil = new Uint8Array(buffer.slice(offset, offset + n));

  if (rowPtr[n] !== e) throw new Error('FBL1 row_ptr does not end at edge_count');
  return { neuronCount: n, edgeCount: e, rowPtr, col, weight, primaryNeuropil, neuropils: meta.neuropils, sets: meta.sets };
}

async function gunzip(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

/** Fetch meta.json and the gzipped connectome from `baseUrl` (e.g. "/data/"). */
export async function loadConnectome(
  baseUrl: string,
  onProgress?: (loadedBytes: number, totalBytes: number) => void,
): Promise<Connectome> {
  const metaRes = await fetch(`${baseUrl}meta.json`);
  if (!metaRes.ok) throw new Error(`HTTP ${metaRes.status} loading meta.json`);
  const meta = (await metaRes.json()) as ConnectomeMeta;

  const binRes = await fetch(`${baseUrl}connectome.fbl1.bin.gz`);
  if (!binRes.ok || !binRes.body) throw new Error(`HTTP ${binRes.status} loading connectome`);
  const total = Number(binRes.headers.get('content-length') ?? 0);
  const reader = binRes.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress?.(loaded, total);
  }
  const packed = await new Blob(chunks).arrayBuffer();
  // Some hosts serve .gz with Content-Encoding: gzip, so the browser has already inflated it.
  const bytes = new Uint8Array(packed, 0, 2);
  const raw = bytes[0] === 0x1f && bytes[1] === 0x8b ? await gunzip(packed) : packed;
  return parseFbl1(raw, meta);
}
