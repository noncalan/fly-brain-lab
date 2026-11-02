import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRAINS, DATASETS } from './scale';

interface Row {
  minSynapses: number;
  weightBits: number | null;
  merge: boolean;
  size: { bytes: number; nodes: number };
}

describe('Scale page numbers', () => {
  it('model sizes match the compression probe results file', () => {
    const { rows } = JSON.parse(readFileSync(resolve(__dirname, '../../tools/calibrate/results/compression.json'), 'utf8')) as { rows: Row[] };
    const full = rows.find((r) => r.minSynapses === 5 && r.weightBits === null && !r.merge)!;
    const merged = rows.find((r) => r.minSynapses === 5 && r.weightBits === 4 && r.merge)!;
    const byId = Object.fromEntries(DATASETS.map((d) => [d.id, d]));
    expect(byId.model.bytes).toBe(full.size.bytes);
    expect(byId.model.cells).toBe(full.size.nodes);
    expect(byId.modelMerged.bytes).toBe(merged.size.bytes);
    expect(byId.modelMerged.cells).toBe(merged.size.nodes);
  });

  it('the fly neuron count matches the connectome the site loads', () => {
    const meta = JSON.parse(readFileSync(resolve(__dirname, '../../public/data/meta.json'), 'utf8')) as { neuron_count: number };
    expect(BRAINS.find((b) => b.id === 'fly')!.neurons).toBe(meta.neuron_count);
  });

  it('every published number has a DOI', () => {
    for (const x of [...BRAINS, ...DATASETS]) {
      if (x.source.cite !== '') expect(x.source.doi, x.id).toMatch(/^10\.\d{4,}\//);
    }
  });
});
