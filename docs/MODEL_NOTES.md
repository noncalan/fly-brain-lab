# Model notes: flybrain fork vs Shiu et al. vs Eon fly-brain

Sources compared (read-only):

* Shiu et al., *A leaky integrate-and-fire computational model based on the connectome of the entire adult
  Drosophila brain reveals insights into sensorimotor processing*, bioRxiv 10.1101/2023.05.02.539144; published as
  Nature 634 (2024), 10.1038/s41586-024-07763-9. Code: `philshiu/Drosophila_brain_model@91bdd1e7` (**MIT**).
* `eonsystemspbc/fly-brain@a3db62f9` (**GPL-2.0**). Only read to compare parameters; nothing copied.
* Fork: `snedea/flybrain@9191824` (MIT), see `ARCHITECTURE.md`.

## 1. Parameters

| Item | flybrain fork | Shiu et al. (`model.py`) | Eon (`code/run_pytorch.py`) |
|------|---------------|--------------------------|-----------------------------|
| Time | dimensionless tick, 10 ticks/s wall-clock | dt 0.1 ms (Brian2 default), 1000 ms trials × 30 | dt 0.1 ms |
| Membrane | `V *= 0.95` per tick | dv/dt = (v0 − v + g)/20 ms | τ_mem 20 ms |
| Rest / reset / threshold | 0 / 0 / 1.0 | −52 / −52 / −45 mV | same as Shiu |
| Synapse | instant `V += w` | alpha-like current: dg/dt = −g/5 ms, `g += w` on spike | τ_syn 5 ms |
| Delay | none | 1.8 ms | 1.8 ms |
| Refractory | 3 ticks | 2.2 ms | 2.2 ms |
| Weight | Σsyn × sign / max\|w\| × 0.15 (median 0.0005) | syn × sign × 0.275 mV | same as Shiu |
| Sign | −1 GABA only; **Glu excitatory** | −1 GABA **and Glu** (inhibitory), +1 others | same as Shiu |
| Input | constant +0.15/tick to whole groups | Poisson 150 Hz (default; 10–260 Hz in figures), weight 0.275 × 250 mV, stimulated neurons have no refractory | same as Shiu |
| Noise / seed | none, deterministic | Poisson, 30 trials averaged | seeded generator |
| Silencing | not implemented | zero all outgoing weights of the neuron | same |

## 2. Connectome size

| | Neurons | Connections (pre→post pairs) | Synapses | Threshold |
|---|---|---|---|---|
| flybrain fork (Codex `connections.csv`, v783) | 139,255 | 2,698,236 (2,700,513 in Shiu file at ≥5) | 34.2 M | ≥5 synapses per pair |
| Shiu `Connectivity_783.parquet` | 138,639 | 15,091,983 | 54.49 M | ≥1 synapse |
| Eon README claim | "~138k neurons, ~5M synapses" | — | — | — |

So the "about 5M" figure from Eon's README does not match the data: the full v783 graph has **15.1 M connections /
54.5 M synapses**; the fork keeps the 2.7 M strongest pairs (≥5 synapses), i.e. 18 % of pairs and 63 % of synapses.
Fraction of inhibitory connections in Shiu's file: 40.0 %. Numbers: `tools/probe/results/` and the commands in
`tools/probe/README.md`.

## 3. Does activity propagate? (probe, 2026-10-27)

`tools/probe/probe.js` runs (a) the fork's update rule exactly as in `sim-worker.js` (no gating) and (b) a JS port of
Shiu's equations on Shiu's v783 connectivity. Stimulus sets come from `data/neuron_sets.json`. Rates are mean Hz per
readout neuron. Results: `tools/probe/results/probe_fork.json`, `probe_shiu.json`.

**Fork model:** every readout stays at 0 Hz for every stimulus, and the number of neurons that ever spike equals the
number of stimulated neurons (sugar 57/57, looming 314/314, …). With a median weight of 0.0005 and threshold 1.0 a
spike cannot cross a single synapse. The fork's on-screen behaviour is produced by the scripted layer
(`ARCHITECTURE.md` §5), not by the connectome.

**Shiu port (150 Hz, 3 trials × 1 s):**

| Stimulus set | MN9 (feeding) | Giant Fiber (DNp01) | aDN1 (DNg62) | aBN1 (SAD093) | DNa02 | active neurons |
|---|---|---|---|---|---|---|
| sugar GRNs, both sides (57) | **48.0** | 0 | 0 | 0 | 24.0 | 8,785 |
| water GRNs (30) | 0 | 0 | 0 | 0 | 0 | 109 |
| bitter GRNs (42) | 0 | 0 | 0 | 0 | 0 | 128 |
| heat TRN_VP2 (7) | 0.3 | 0 | 0 | 0 | 25.8 | 8,500 |
| cold TRN_VP3 (9) | 0.2 | 0 | 0 | 0 | 28.8 | 8,478 |
| JO wind/gravity (484) | 0 | 0 | 15.0 | **33.5** | 0 | 1,089 |
| JO "grooming" (192) | 0 | 0 | 0 | 0 | 0 | 271 |
| antennal bristles BM_Ant (41) | 0 | 0 | 0 | 0 | 11.2 | 367 |
| LC4 + LPLC2 (314) | 0 | **187.7** | 0 | 0 | 0 | 1,411 |

Cross-check against Shiu's own example (`tools/probe/results/probe2.log`): their 21 right sugar GRN IDs (20 still exist
in v783) at 100 Hz give **343 active neurons** (Shiu's notebook: "only about 400 neurons show activity") and MN9 at
69 / 51 Hz. Sugar + bitter at 150 Hz: MN9 drops from **70.7 to 9.5 Hz** (Shiu Fig. 3A: bitter suppresses MN9).

With connections ≥5 synapses only (`probe3_min5.log`, 2,700,513 edges): Shiu sugar → MN9 64 Hz (353 active),
looming → GF 180 Hz, JO wind → aBN1 19.5 Hz / aDN1 2.5 Hz. The effects survive pruning to the fork's edge set; aDN1 weakens.

### Caveats (to fix before quoting any of this in the app)

1. My port integrates with forward Euler, Brian2 uses exact linear integration; synaptic input is dropped while the
   target is refractory (Brian2 still adds it to `g`). Not yet validated spike-by-spike against Brian2.
2. 1–3 trials instead of 30.
3. Large bilateral sets (sugar 57, heat, cold) recruit ~8.5 k neurons, 25× more than Shiu's 20-neuron set. This may be
   real recurrent excitation in v783 or a port artefact. Needs a Brian2 reference run before the app uses
   "whole class" stimuli; until then use Shiu's exact sets for gustatory stimuli.
4. Water → MN9 = 0 in v783 with the current water annotation (LB3a). Shiu's water list (v630) included 7 neurons that
   v3.2.0 annotations now call sugar (LB3c). Annotations drift between versions; the app must pin the version.

## 4. Consequences for Fly Brain Lab

* The fork's simulation core cannot be kept as is. Proposal: keep the worker/CSR architecture, replace the update rule
  and parameters with Shiu's (MIT, so the equations and constants can be used with attribution), use signed synapse
  counts with Glu inhibitory.
* Edge set: the ≥5-synapse graph (2.7 M) keeps the core effects and fits the load budget better than 15.1 M edges.
  The choice is user-visible ("model uses connections ≥5 synapses") and becomes the baseline for the v2 "compress the
  brain" slider.
* Speed: the naïve JS port needed 151.7 s wall-clock for 27 simulated seconds (9 sets × 3 trials × 1 s), i.e. ~5.6 s
  per simulated second on this machine (Node 24, all 138 k neurons updated every 0.1 ms; timing from the
  `time node probe.js shiu` run). Real-time needs an event-driven update (only neurons with v ≠ v0 or g ≠ 0) and probably a coarser dt
  (0.25–0.5 ms, to be validated). Until then the UI shows "×0.2 of real time" honestly.
* Determinism: seeded PRNG (mulberry32) in the worker; Vitest compares against stored spike counts for fixed seeds.
