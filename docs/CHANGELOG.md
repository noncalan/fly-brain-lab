# Changelog

## 2026-11-02 — One lab with an alive fly (game page merged in)

- Nurik asked to merge the Lab and the Game fly into one page. `/play` is gone (page moved to `legacy/`); the Lab has
  an "Alive fly" switch (on by default, `?life=0` turns it off). The body runs on the needs script (wandering, flying,
  hunger, thirst, fear, pain, tiredness, curiosity); the moment the model's neurons drive a behaviour — feeding (MN9),
  escape (Giant Fiber), grooming (aDN1), walking/turning (DNp09, MDN, DNa02) — they take over, and a badge always says
  who moves the fly. Code: `src/play/useLife.ts` (arbitration), `src/lab/LifePanel.tsx` (needs, tools).
- The script and the brain are coupled only through real sensory sets: a hungry fly walks to sugar, the sugar under
  the proboscis drives the sugar taste neurons, and hunger drops only while MN9 makes the fly feed (silence the GNG
  and the fly gives up and walks away). Water drops drive the water taste neurons; a click on the head is the antenna
  touch (JO neurons); the Clap button is a 1 s pulse on the auditory JO neurons. Hits on the body and fear exist
  only in the script.
- Tests: unit tests for the feeding coupling and the take-over rule; e2e for the alive fly and `?life=0`.

## 2026-11-02 — Game fly (Nurik's request) and rate bars in the lab

- Nurik asked for a lively fly with hunger, fear, pain and chaotic flight, and chose: keep the Lab honest and add a
  separate, clearly labelled game. New page `/play` "Game fly": a scripted fly (`src/play/gameFly.ts`, not the brain
  model) with six needs — hunger, thirst, fear, pain, tiredness, curiosity — and modes: wandering, standing, grooming,
  exploring, flying, fleeing, landing, resting, looking for and eating food / water. Flight is straight stretches with
  sudden turns, climbing and sinking, banking into turns, inside the arena and under a 30 mm ceiling. Click the fly to
  hit it (pain + fear → it bolts), drop sugar or water, tap the floor or clap to scare it; counters for hits, meals,
  drinks and time in the air. A banner says it is a game, not the model, and that the fly feels nothing.
- Fly3D: optional externally set pose (game only; the lab never sets it) and a "wide" camera that follows smoothly.
- Lab: each behaviour row now has a bar of its readout neuron's rate with a tick at the threshold.
- Tests: 6 unit tests for the game fly, e2e for the game page.

## 2026-11-02 — v2 wrap-up

- About page lists the new sources (Zheng 2018 by DOI, Herculano-Houzel 2006, Azevedo 2009, Shapson-Coe 2024, MICrONS 2025).
- Phones: the stimulus chips on Compare/Compress are one horizontally scrolling row instead of a full screen of chips.
- `tools/og/screens.mjs` also shoots the v2 pages (desktop and phone) and takes a name filter.
- `docs/STATUS.md` updated. Last full run: 89 Vitest passed (+2 probes skipped), 40/40 Playwright on the production
  build (desktop + mobile).

## 2026-11-02 — v2: lessons, quiz and teacher mode

- New page `/lessons` with 6 step-by-step lessons (RU/KK/EN): what a neuron is; receptor neurons; a signal's path
  (looming → LC4/LPLC2 → Giant Fiber → escape, and sugar → GNG → MN9); memory and the mushroom bodies (says plainly
  that this model has fixed weights and cannot learn; demo switches on KCg-m Kenyon cells); how scientists switch
  neurons on and off (MDN, DNp09, GNG silencing); how much a brain "weighs" in data. Steps link to live lab demos,
  each lesson ends with a two-question quiz with explanations and a score, and lists its sources (DOIs or result
  files). Content: `src/content/lessons.ts`; facts only from already verified sources and this model's results.
- Teacher mode: full screen (Fullscreen API, with an overlay fallback for browsers without it), large text,
  ← / → between steps, Esc to leave.
- Tests: content test (three languages filled, quiz answers valid, every demo link resolves to known stimuli,
  cell types and regions); e2e for a lesson with teacher mode and quiz score, and for the Kenyon cell demo
  (mushroom body is the most active region).

## 2026-11-02 — v2: Scale page

- New page `/scale`: neurons in a fly (139,255), a mouse (70.89 ± 10.41 million) and a human (86.1 ± 8.1 billion) on a
  log scale, and how much data maps a brain: FAFB fly EM ≈ 106 TB, FlyWire (≈ 5×10⁷ synapses), MICrONS (> 200,000
  cells, 0.5 billion synapses), H01 (1 mm³ of human cortex, 1.4 PB), and this site's model (10.85 MB; 1.82 MB merged).
  Every number links to its DOI and says where in the paper it is (`src/content/scale.ts`); sources opened via Europe
  PMC / PMC: Dorkenwald 2024, Herculano-Houzel 2006 (Table 1), Azevedo 2009, Zheng 2018, MICrONS 2025,
  Shapson-Coe 2024. Ratios are computed and rounded to two significant digits.
- Tests: unit test ties the model sizes to `compression.json` and the fly count to `meta.json`; e2e for the page.

## 2026-11-02 — v2: mobile version and automatic 3D quality

- Automatic quality for every 3D view (`src/app/quality.ts`): phones start at "medium" (pixel ratio ≤ 1.25), and
  when the page holds less than 30 FPS for 2 s (after a 4 s loading grace) all 3D views step down together:
  high (pixel ratio ≤ 2, shadows, all 139,255 neuron points) → medium → low (pixel ratio 1, no shadows, every 3rd
  neuron point; clicking a point still picks the real neuron). `?quality=high|medium|low` forces a level.
- Phone time bar is one compact row (icons, short status): 40 px, ~5 % of a Pixel 7 screen instead of ~15 %.
- Header navigation scrolls sideways on phones instead of widening the page; the sound region picker no longer
  widens the lab on phones.
- Tests: governor and initial-quality unit tests; e2e "pages fit the screen width" compares with the device width
  (the old check compared with `clientWidth`, which grows with the overflow on phones and so missed it).

## 2026-11-02 — v2: spike sonification

- Lab page, under the 3D brain: "Listen to spikes" plays one short click per spike of the chosen brain region (or the
  whole brain), like an electrophysiology audio monitor (Web Audio, capped at 400 clicks per second, clicks spread
  over the frame's wall time). Turning it on picks the most active region. Off by default; RU/KK/EN.
- Tests: unit test for the click cap, e2e for switching the sound on and off.

## 2026-11-02 — v2: "Compress the brain" page

- New page `/compress`: an original fly and a compressed fly side by side with the same stimuli. Controls: drop
  connections weaker than N synapses (5–80), bits per weight (exact/8/4/2/1), and merge neurons of one cell type
  (per side) into one node; presets. Shows model size in MB for both flies and the ratio, nodes, connections, bits per
  weight, smoothed rates of the readout neurons (MN9, Giant Fiber, aDN1, DNp09, MDN), and the verdict
  "kept / partly / lost". Explains how the size is counted and why compression matters for brain emulation.
- Engine: neuron merging by cell type and side (`src/sim/compress.ts`, mean-field weights = synapse sum / target
  group size), honest model size (bit-packed CSR, before gzip). The worker runs the merged graph instead of the full
  one when merging is on and reports spikes as original neuron indices. `minSynapses: 0` now keeps every edge;
  the log quantiser spans the weights actually present (unchanged for the integer graph).
- Measured (`tools/calibrate/results/compression.json`): merge + 4 bits = 1.82 MB vs 10.85 MB (6.0×) keeps feeding,
  escape and grooming; dropping edges < 40 synapses loses feeding. Details in `docs/MODEL_NOTES.md` §7.
- Refactor: the fly column and stimulus chips moved from the Compare page to `src/lab/FlyColumn.tsx`.
- Tests: 77 Vitest (+ compression probe, skipped by default), new e2e `e2e/v2.spec.ts`.

## 2026-10-27 — Step 5: realistic walking and running, rest of v1

- Gait: the 3D legs now replay a recorded walking step of a real fly (NeuroMechFly preprogrammed steps, flygym,
  Apache-2.0; 45 samples × 3 ms = 7.41 Hz) as a tripod, with periodic cubic interpolation. Step frequency and stride
  scale with the descending command so feet do not slide (speed = stride × amplitude × frequency); running = up to
  16 Hz and 1.35× stride (≤ 21 mm/s); turning = unequal sides, turning in place = sides in opposition; body bob.
  Walking command is low-pass filtered (150 ms simulated). "Running" label and speed readout.
- Neuron inspector: click a neuron in the 3D brain → type, class, side, predicted transmitter, main region, strongest
  inputs/outputs (computed in the worker), FlyWire Codex link (root IDs loaded on demand), switch the type on or off.
- Spike raster (readout neurons + sampled stimulated neurons) and region × time heatmap over the last 10 s.
- Exports: PNG (fly + brain), 5 s GIF of the fly (gifenc, MIT), CSV of all set and region rates.
- Compare page: two flies with separate simulations and the same stimuli; fly B can get a lesion, optogenetics,
  connection pruning (min synapses) and weight quantisation; verdict "kept / partly / lost".
- Tests: 68 Vitest, 33 Playwright.

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
