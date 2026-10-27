// Stimulus x readout matrix used to choose thresholds in config/behaviors.json.
// Skipped by default; run with CALIBRATE=1 npx vitest run src/sim/calibration.test.ts
// Output: tools/calibrate/results/matrix.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';
import { Simulator } from './engine';
import { loadBuiltConnectome } from './testing';

// CALIBRATE_ALL=1: every stimulus and readout set in meta.json, one rate, two seeds -> matrix_all.json
const ALL = process.env.CALIBRATE_ALL === '1';
const SETS = loadBuiltConnectome().sets;
const STIMULI = ALL
  ? Object.keys(SETS).filter((k) => SETS[k].kind === 'stimulus')
  : ['shiu_sugar_r', 'grn_sugar', 'grn_water', 'grn_bitter', 'trn_heat', 'jo_wind_gravity', 'bm_antenna', 'vpn_looming'];
const READOUTS = ALL ? Object.keys(SETS).filter((k) => SETS[k].kind === 'readout') : ['mn9', 'giant_fiber', 'adn1', 'abn1'];
const RATES_HZ = ALL ? [150] : [50, 100, 150];
const SEEDS = ALL ? [1, 2] : [1, 2, 3];
const DURATION_MS = 1000;

describe.runIf(process.env.CALIBRATE === '1')('calibration matrix', () => {
  it('measures readout rates for every stimulus', () => {
    const c = loadBuiltConnectome();
    const rows = [];
    for (const stimulus of [null, ...STIMULI]) {
      for (const hz of stimulus ? RATES_HZ : [0]) {
        const rates: Record<string, number[]> = Object.fromEntries(READOUTS.map((r) => [r, []]));
        let wallMs = 0;
        for (const seed of SEEDS) {
          const sim = new Simulator(c, seed);
          if (stimulus) sim.stimulate(stimulus, hz);
          const t0 = performance.now();
          sim.step(DURATION_MS);
          wallMs += performance.now() - t0;
          const a = sim.getActivity();
          for (const r of READOUTS) rates[r].push(a.setRatesHz[r]);
        }
        const mean = Object.fromEntries(READOUTS.map((r) => [r, rates[r].reduce((s, x) => s + x, 0) / SEEDS.length]));
        rows.push({ stimulus: stimulus ?? 'none', hz, meanHz: mean, perSeedHz: rates, wallMsPerSimSecond: wallMs / SEEDS.length });
      }
    }
    const out = resolve(__dirname, '../../tools/calibrate/results');
    mkdirSync(out, { recursive: true });
    writeFileSync(
      resolve(out, ALL ? 'matrix_all.json' : 'matrix.json'),
      JSON.stringify({ seeds: SEEDS, durationMs: DURATION_MS, generatedBy: 'src/sim/calibration.test.ts', rows }, null, 1),
    );
    console.table(rows.map((r) => ({ stim: r.stimulus, hz: r.hz, ...Object.fromEntries(Object.entries(r.meanHz).map(([k, v]) => [k, v.toFixed(1)])) })));
  }, 900_000);
});
