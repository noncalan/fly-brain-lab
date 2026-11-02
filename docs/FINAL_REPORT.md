# Fly Brain Lab — final report

Date: 2026-11-03. Site: https://fly.noncalan.xyz (Vercel, auto-deploy from `main`). Repository:
https://github.com/noncalan/fly-brain-lab. Detailed history: `docs/CHANGELOG.md`; model details: `docs/MODEL_NOTES.md`.

## What was built

- **Simulation core** (`src/sim/`): event-driven leaky integrate-and-fire network with the equations and parameters of
  Shiu et al. 2024, running in a Web Worker on the FlyWire v783 wiring (139,255 neurons, 2,700,513 connections with ≥ 5
  synapses). It replaced the fork's core, whose weights were too small for any spike to cross a synapse and whose
  behaviour was scripted (`docs/MODEL_NOTES.md` §3–5).
- **Lab** (`/`): 21 data-backed stimuli in 5 senses, optogenetics of any of 8,846 cell types, lesions of regions or
  types, a 3D NeuroMechFly body that walks with a recorded step, a 3D brain with all neurons as points, neuron
  inspector, signal path, spike raster and heatmap, PNG/GIF/CSV export, spike sonification, shareable URL state.
- **Alive fly** (Lab, on by default): the body lives on a script of needs (wandering, flying, hunger, thirst, fear,
  pain, tiredness, curiosity); whenever the model's neurons drive a behaviour (feeding, escape, grooming, walking)
  they take over, and a badge says which one moves the fly. Script and brain meet only through real sensory sets:
  sugar and water under the proboscis, antenna touch, a clap as auditory input; hunger drops only while MN9 feeds.
- **Experiments** (15 cards with their published sources), **Compare** (two flies, one changed), **Compress the
  brain** (pruning, weight bits, merging neurons by cell type; honest model size), **Scale** (fly, mouse, human, and
  the data needed to map them, every number with a DOI), **Lessons** (6 lessons with demos, quizzes, teacher mode),
  **About** (what the model is and is not, all sources, licences).
- Three languages (RU/KK/EN), dark and light themes, mobile layout with automatic 3D quality.

## Final check (2026-11-03)

| Check | Result | Where |
|---|---|---|
| Unit tests | 97 passed (+2 probe runs skipped by default) | `npm test` |
| E2E, desktop + mobile, production build | 59/59 pass; every stimulus, every experiment card, every page in 3 languages | `e2e/` |
| Lighthouse, production, mobile (all 7 pages) | performance 98–99, accessibility 100, best practices 100, SEO 100 | `tools/lighthouse/results/2026-11-03.json` |
| Lighthouse, production, desktop | 100 / 100 / 100 / 100 | same file |
| Phone (Pixel 7 emulation) | every page fits the screen width, time bar one row (~5 % of the screen) | `e2e/smoke.spec.ts`, `docs/screenshots/*-phone.png` |
| UI frame rate under the heaviest stimulus | ≥ 30 FPS (GPU) | `e2e/perf.spec.ts` |

## What the model reproduces

From `docs/MODEL_NOTES.md` and `tools/calibrate/results/`: sugar → MN9 (proboscis extension); bitter added → MN9
suppressed; looming (LC4, LPLC2) → Giant Fiber → escape; Johnston's organ → aBN1 → aDN1 → antennal grooming;
optogenetic DNp09 → forward walking (one side → turning to that side), MDN → backward walking, DNa02 → turning;
silencing the GNG removes sugar feeding.

## What did not work, and why

- **Water does not trigger feeding.** Shiu et al. report it, but with the v783 annotations this model does not
  reproduce it; the lab says so instead of faking it.
- **No sensory stimulus makes the fly walk.** Walking appears only with optogenetics of the descending neurons, as in
  the cited experiments; the alive-fly script provides wandering and is labelled as script.
- **Suspected artefact:** heat, cold, humidity and all odours fall into one large state (~8.5k neurons) where left
  DNa02 fires and the fly turns left. Not checked against the original Brian2 code; shown as the model's output.
- **Antennal grooming is weak** on the ≥ 5-synapse graph (aDN1 ~2 Hz; 15 Hz on the full graph).
- **Pain and body touch** exist only in the alive-fly script: the FlyWire brain connectome has no body or ventral
  nerve cord, so there are no pain neurons to stimulate.
- **Learning and memory are not modelled:** all weights are a fixed snapshot (said plainly in the memory lesson).
- **Merging neurons by type** keeps feeding, escape and grooming at 1.82 MB vs 10.85 MB, but changes the rates: it is
  a coarser model, not a lossless one (`tools/calibrate/results/compression.json`).
- **Kazakh text** was written without a native speaker and needs review.
- **Download size:** the connectome file is 9.5 MB (gzip); the delta+varint idea to shrink it was not measured. The
  first load right after a deploy can take 10–30 s while the CDN warms up.
- **`legacy/`** (the original fork code and the retired game page) is still in the repository: deleting it needs Nurik.

## Open follow-ups

Native review of Kazakh; a Brian2 reference run for the attractor state; a smaller connectome encoding; deciding
whether to delete `legacy/`.
