# Changelog

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
