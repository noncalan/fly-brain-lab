// How compression changes behaviour: model size and readout rates for each setting of the "Compress the brain" page.
// Skipped by default; run with COMPRESSION=1 npx vitest run src/sim/compression.probe.test.ts
// Output: tools/calibrate/results/compression.json
// COMPRESSION_SWEEP=1 runs the full grid (pruning × weight bits × merging) for the size-vs-behaviour chart instead,
// output tools/calibrate/results/compression_sweep.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, it } from 'vitest';
import { parseAtlas } from '../lab/atlas';
import { groupByTypeAndSide, mergeConnectome, modelSize } from './compress';
import { Simulator } from './engine';
import { loadBuiltConnectome } from './testing';
import type { Connectome } from './types';

const STIMULI: Array<[string, string]> = [
  ['sugar', 'shiu_sugar_r'],
  ['looming', 'vpn_looming'],
  ['antenna_touch', 'jo_wind_gravity'],
];
const READOUTS = ['mn9', 'giant_fiber', 'adn1', 'abn1', 'dnp09', 'mdn', 'dna02_l', 'dna02_r'];
type Setting = { minSynapses: number; weightBits: number | null; merge: boolean };
const LISTED: Setting[] = [
  { minSynapses: 5, weightBits: null, merge: false },
  { minSynapses: 10, weightBits: null, merge: false },
  { minSynapses: 20, weightBits: null, merge: false },
  { minSynapses: 40, weightBits: null, merge: false },
  { minSynapses: 5, weightBits: 4, merge: false },
  { minSynapses: 5, weightBits: 2, merge: false },
  { minSynapses: 5, weightBits: 1, merge: false },
  { minSynapses: 5, weightBits: null, merge: true },
  { minSynapses: 5, weightBits: 4, merge: true },
  { minSynapses: 20, weightBits: 4, merge: true },
];
const SWEEP = process.env.COMPRESSION_SWEEP === '1';
const GRID: Setting[] = [false, true].flatMap((merge) =>
  [5, 7, 10, 14, 20, 28, 40, 56, 80].flatMap((minSynapses) => [null, 8, 6, 4, 3, 2, 1].map((weightBits) => ({ minSynapses, weightBits, merge }))),
);
const SETTINGS = SWEEP ? GRID : LISTED;
/** A behaviour counts as kept when its readout's 1 s mean rate passes the config/behaviors.json threshold. */
const KEPT = [
  { behavior: 'feeding', stimulus: 'sugar', readout: 'mn9', thresholdHz: 10 },
  { behavior: 'escape', stimulus: 'looming', readout: 'giant_fiber', thresholdHz: 50 },
  { behavior: 'antennal_grooming', stimulus: 'antenna_touch', readout: 'adn1', thresholdHz: 0.5 },
] as const;
const SEEDS = [1, 2];
const DURATION_MS = 1000;
const RATE_HZ = 150;

function maxMagnitude(c: Connectome): number {
  let m = 0;
  for (let e = 0; e < c.weight.length; e++) m = Math.max(m, Math.abs(c.weight[e]));
  return m;
}

describe.runIf(process.env.COMPRESSION === '1' || SWEEP)('compression probe', () => {
  it('measures size and readouts for each setting', () => {
    const c = loadBuiltConnectome();
    const dir = resolve(__dirname, '../../public/data');
    const { file } = JSON.parse(readFileSync(resolve(dir, 'neurons.json'), 'utf8')) as { file: string };
    const raw = gunzipSync(readFileSync(resolve(dir, file)));
    const atlas = parseAtlas(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer, c.neuronCount);
    const grouping = groupByTypeAndSide(atlas.typeOf, atlas.sideOf);
    const merged = new Map<number, Connectome>();
    const graphFor = (s: Setting) => {
      if (!s.merge) return c;
      if (!merged.has(s.minSynapses)) merged.set(s.minSynapses, mergeConnectome(c, grouping, s.minSynapses).connectome);
      return merged.get(s.minSynapses)!;
    };

    const rows = [];
    for (const s of SETTINGS) {
      const graph = graphFor(s);
      const pruning = { minSynapses: s.merge ? 0 : s.minSynapses, weightBits: s.weightBits };
      const probe = new Simulator(graph, 1);
      probe.setPruning(pruning);
      const size = modelSize({
        nodes: graph.neuronCount,
        edges: probe.activeEdgeCount(),
        quantBits: s.weightBits,
        maxSynapses: maxMagnitude(graph),
        integerWeights: !s.merge,
      });
      const byStimulus: Record<string, Record<string, number>> = {};
      for (const [id, set] of STIMULI) {
        const sums: Record<string, number> = Object.fromEntries(READOUTS.map((r) => [r, 0]));
        for (const seed of SEEDS) {
          const sim = new Simulator(graph, seed);
          sim.setPruning(pruning);
          sim.stimulate(set, RATE_HZ);
          sim.step(DURATION_MS);
          const a = sim.getActivity();
          for (const r of READOUTS) sums[r] += a.setRatesHz[r] / SEEDS.length;
        }
        byStimulus[id] = sums;
      }
      const kept = KEPT.filter((k) => byStimulus[k.stimulus][k.readout] > k.thresholdHz).map((k) => k.behavior);
      rows.push({ ...s, size, meanHz: byStimulus, kept });
      if (SWEEP) console.log(`${rows.length}/${SETTINGS.length}`, s, (size.bytes / 1e6).toFixed(2), 'MB', kept.join(','));
    }
    const out = resolve(__dirname, '../../tools/calibrate/results');
    mkdirSync(out, { recursive: true });
    writeFileSync(
      resolve(out, SWEEP ? 'compression_sweep.json' : 'compression.json'),
      JSON.stringify(
        { seeds: SEEDS, durationMs: DURATION_MS, rateHz: RATE_HZ, groups: grouping.groupCount, kept: KEPT, generatedBy: 'src/sim/compression.probe.test.ts', rows },
        null,
        1,
      ),
    );
    if (!SWEEP) {
      console.table(
        rows.map((r) => ({
          min: r.minSynapses,
          bits: r.weightBits ?? '-',
          merge: r.merge,
          MB: (r.size.bytes / 1e6).toFixed(2),
          nodes: r.size.nodes,
          edges: r.size.edges,
          mn9_sugar: r.meanHz.sugar.mn9.toFixed(1),
          gf_loom: r.meanHz.looming.giant_fiber.toFixed(1),
          adn1_touch: r.meanHz.antenna_touch.adn1.toFixed(1),
        })),
      );
    }
  }, 7_200_000);
});
