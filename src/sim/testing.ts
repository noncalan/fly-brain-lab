// Test helpers (Node only): load the built connectome from public/data and build tiny synthetic networks.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { parseFbl1, type ConnectomeMeta } from './format';
import type { Connectome, NeuronSet } from './types';

let cached: Connectome | null = null;

export function loadBuiltConnectome(): Connectome {
  if (cached) return cached;
  const dir = resolve(__dirname, '../../public/data');
  const meta = JSON.parse(readFileSync(resolve(dir, 'meta.json'), 'utf8')) as ConnectomeMeta;
  const raw = gunzipSync(readFileSync(resolve(dir, 'connectome.fbl1.bin.gz')));
  const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
  cached = parseFbl1(buffer, meta);
  return cached;
}

/** Build a connectome from an edge list [pre, post, signedSynapses]. */
export function syntheticConnectome(
  neuronCount: number,
  edges: Array<[number, number, number]>,
  sets: Record<string, number[]> = {},
): Connectome {
  const sorted = [...edges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const rowPtr = new Uint32Array(neuronCount + 1);
  for (const [pre] of sorted) rowPtr[pre + 1]++;
  for (let i = 1; i <= neuronCount; i++) rowPtr[i] += rowPtr[i - 1];
  const namedSets: Record<string, NeuronSet> = {};
  for (const [id, indices] of Object.entries(sets)) {
    namedSets[id] = { kind: 'stimulus', source: 'test', rule: 'test', note: '', indices };
  }
  return {
    neuronCount,
    edgeCount: sorted.length,
    rowPtr,
    col: Uint32Array.from(sorted.map((e) => e[1])),
    weight: Int16Array.from(sorted.map((e) => e[2])),
    primaryNeuropil: new Uint8Array(neuronCount),
    neuropils: ['TEST'],
    sets: namedSets,
  };
}
