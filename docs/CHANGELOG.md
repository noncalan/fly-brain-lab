# Changelog

## 2026-10-27 — Step 4: 3D fly, walking neurons, detailed brain, many experiments

- 3D fly: NeuroMechFly v2 body (flygym, Apache-2.0; 45 meshes, 69 segments, 451 kB) in an arena; joint rig with the
  neutral pose; tripod gait, proboscis extension, antennal grooming and escape hops, each driven only by readout
  neurons. Joint signs checked by computing segment world positions in Node.
- Walking from descending neurons (DNp09, MDN, DNa02 with L/R) — sources verified and approved by Nurik.
- Brain: all 139,255 neurons as points at their soma positions (FlyWire annotations), flashing on spikes, inside the
  neuropil meshes.
- Experiments: 21 data-backed stimuli in 5 modalities; optogenetics of any of 8,846 cell types (both/left/right,
  50–200 Hz); lesions by region or cell type; experiment state in the URL with a copy-link button; Experiments page
  with 15 cards (sources: Shiu 2024, Bidaye 2014/2020, Rayshubskiy 2025, von Reyn 2014); first-visit intro dialog.
- Arena interactions: click to drop sugar (taste contact at the proboscis), click the head to touch the antennae.
- Data: `neurons.*.bin.gz` (type, class, side, position; 1.1 MB), `fly.*.bin.gz`, new sets in `data/NEURON_SETS.md`,
  calibration `tools/calibrate/results/matrix_all.json`.
- Tests: 57 Vitest, 30 Playwright (every stimulus, optogenetic walking, lesion, experiments page, mobile, FPS).

## 2026-10-27 — Step 3: MVP, deployed to https://fly.noncalan.xyz

- Lab page: stimuli (click or drag onto the fly), fly animation driven only by readout neurons, behaviour list with
  live rates and thresholds, "model does not reproduce" notices (water; heat/bitter show no reaction).
- 3D brain (react-three-fiber) from FlyWire neuropil meshes `neuropil_mesh_v141_v3` (78 regions, 510 kB,
  `tools/build-data/build_meshes.py`); regions glow with live spike rate; hover shows name and role in RU/KK/EN.
- Signal path receptor → processing → motor/descending neuron → action, lit by live rates.
- Region bars, 139k-neuron activity map, time controls (pause, ×0.1/0.25/0.5/1, +10 ms, measured real-time factor).
- Dark "lab" and light themes, Inter + JetBrains Mono, one accent colour, RU/KK/EN with browser default.
- About page (what it is / is not, attribution, author, licence), SEO meta, OG image 1200×630, fly favicon.
- Deploy: Vercel project `fly-brain-lab`, GitHub auto-deploy from `main`, previews from branches,
  domain `fly.noncalan.xyz` (DNS on Vercel), content-hashed data served `immutable`, Vercel Web Analytics.
- Playwright: every stimulus, drag-and-drop, 3 languages, mobile, no horizontal scroll, pause/step,
  UI ≥30 FPS under the heaviest stimulus (GPU). 13/13 pass against production.

## 2026-10-27 — Step 2: Vite + React + TypeScript, new simulation core

- New simulation core `src/sim/` (TypeScript): event-driven LIF with Shiu et al. equations and parameters, exact
  per-step integration, 1.8 ms delay, 2.2 ms refractory, seeded Poisson input, silencing as in Shiu et al.,
  pruning (min synapses, log-quantised weights). API: `loadConnectome`, `Simulator.step/stimulate/silence/setPruning/getActivity`.
- Runs in a Web Worker (`sim.worker.ts`) with a typed client (`client.ts`); speed 0..1 of real time, measured speed reported.
- New data format FBL1 (`tools/build-data/build_connectome.py` → `public/data/`, 9.5 MB gzip): graph equals Shiu
  Connectivity_783 restricted to ≥5 synapses, edge for edge (signs from `data/shiu_signs_783.csv.gz`).
- Behaviours from readout neurons only (`config/behaviors.json`): feeding (MN9), escape (Giant Fiber), antennal
  grooming (aDN1). Stimuli limited to data-backed sets (`config/stimuli.json`): sugar, water, bitter, heat, antenna touch, looming.
- Removed (not backed by data): nociception, body touch, light/phototaxis, food odour, cold, wind, withdrawal, freezing,
  walking, leg grooming, all JS "drives". Legacy app moved to `legacy/` (caretaker/LLM server and iOS wrapper not ported).
- Tests: 32 Vitest tests (synthetic-network unit tests, real-connectome Shiu effects, golden snapshots, behaviour config).
  Calibration matrix: `tools/calibrate/results/matrix.json`.
- Minimal React UI: fly canvas, stimulus toggles, 139k-neuron activity map, region bars, behaviour readouts, time controls.

## 2026-10-27 — Step 1: fork audit (no app changes yet)

- Forked `snedea/flybrain@9191824` as `noncalan/fly-brain-lab`; added our copyright under the original MIT notice.
- `docs/ARCHITECTURE.md`: audit of data format, worker, groups, stimuli and the scripted behaviour layer.
- `docs/MODEL_NOTES.md`: parameter and connectome comparison with Shiu et al. and Eon; propagation probe.
- `docs/DATA_LICENSES.md`: FlyWire / annotation / code licences, non-commercial decision.
- `data/NEURON_SETS.md`, `data/neuron_sets.json`, `tools/neuron-sets/build_sets.py`: sourced stimulus and readout sets.
- `tools/probe/`: probe scripts and raw results.
