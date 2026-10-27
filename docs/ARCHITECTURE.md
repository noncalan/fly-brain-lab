# Architecture of the upstream fork (snedea/flybrain @ 9191824)

Audit written before any refactor. It describes the code as forked, not the target design.

## 1. Files that matter

| Path | Role |
|------|------|
| `index.html` | Single page, plain `<script>` tags, no bundler. Loads `three.min.js` from `js/vendor/`. |
| `js/sim-worker.js` | Web Worker. LIF-like simulation over the full connectome (CSR, neuropil gating). |
| `js/brain-worker-bridge.js` | Main thread. Fetches data, owns the worker, maps stimuli to neuron groups, aggregates spikes, **synthesises motor output**. |
| `js/connectome.js` | `BRAIN` global: legacy 59-group connectome from worm-sim, drives, `motorcontrol()` accumulators. |
| `js/constants.js` | Hand-written weights between the 59 legacy groups (fallback path only). |
| `js/fly-logic.js` | `BEHAVIOR_THRESHOLDS` and `evaluateBehaviorEntry()` (behaviour state machine). |
| `js/main.js` (68 KB) | Canvas 2D fly, toolbar, input handling, behaviour execution, animation. |
| `js/neuro-renderer.js` | WebGL2 point cloud of 139K neurons, coloured by region, brightness from fire state. |
| `js/brain3d.js` | Three.js "3D brain": **hand-placed spheres/ellipsoids**, not FlyWire meshes. |
| `js/education.js` | Tooltips/explanations for regions. |
| `js/caretaker-*.js`, `server/`, `agent/` | Optional LLM "caretaker" (Anthropic SDK, SQLite, WebSocket). Not needed for the lab. |
| `ios/` | Xcode wrapper app. Not needed. |
| `scripts/build_connectome.py` | Builds `data/connectome.bin.gz` + `data/neuron_meta.json` from FlyWire CSVs. |
| `tests/` | 99 Node unit tests (`node tests/run-node.js` → 99/99 pass). They test the behaviour layer, not the dynamics. |

## 2. Data files

The readme mentions `data/neuron_meta.bin.gz`; **that file does not exist**. The real files are:

| File | Size | Content |
|------|------|---------|
| `data/connectome.bin.gz` | 12.4 MB | Binary connectome (format below). This is what the browser loads. |
| `data/neuron_meta.json` | 8 KB | 63 group names, region per group, neuron count per group. |
| `data/neurons.csv.gz` | 1.7 MB | FlyWire Codex `neurons.csv`: `root_id, group, nt_type, nt_type_score, *_avg`. 139,255 rows. **Row order = neuron index in the binary.** |
| `data/classification.csv.gz` | 0.9 MB | Codex `classification.csv`: `root_id, flow, super_class, class, sub_class, hemilineage, side, nerve`. No `cell_type` column. |
| `data/connections.csv.gz` | 50 MB | Codex `connections.csv`: `pre_root_id, post_root_id, neuropil, syn_count, nt_type`. 3,869,878 rows (one per pair and neuropil), 34,153,566 synapses. Only pairs with ≥5 synapses in total (Codex default). |
| `data/coordinates.csv.gz` | 5.3 MB | Codex `coordinates.csv`: `root_id, position, supervoxel_id`. Not used by the app. |

### `connectome.bin.gz` (little-endian, gzip)

```
uint32 neuron_count (139255)
uint32 edge_count   (2698236)
edge_count  x { uint32 pre_index, uint32 post_index, float32 weight }   sorted by pre
neuron_count x { uint8 region_type, uint16 group_id }
```

* `weight = Σ_neuropils syn_count × sign(nt_type)`; sign = −1 for GABA only, +1 for ACh, Glu, DA, 5-HT, OA.
* No root IDs in the binary. Index → root_id comes from `neurons.csv.gz` row order.
* 12 bytes/edge uncompressed (32 MB), 12.4 MB gzipped.

## 3. Neuron groups

`build_connectome.py::determine_group()` assigns every neuron to one of 63 groups by substring matching on
Codex `class`/`sub_class` strings. Groups are coarse and partly empty:

| Region | Non-empty groups (neurons) | Empty groups |
|--------|---------------------------|--------------|
| sensory | VIS_R1R6 11487, VIS_ME 82318, VIS_LO 1793, VIS_LPTC 1907, OLF_ORN_FOOD 1851, OLF_ORN_DANGER 430, OLF_LN 453, OLF_PN 699, MECH_BRISTLE 1927, MECH_JO 879, THERMO_WARM 49, THERMO_COOL 54 | VIS_R7R8, VIS_LC, MECH_CHORD, ANTENNAL_MECH, **NOCI**, GENERIC_SENSORY |
| central | MB_KC 5177, MB_MBON_APP 96, MB_DAN_REW 335, LH_APP 559, CX_EPG 428, CX_PFN 1244, CX_FC 822, CX_HDELTA 611, SEZ_FEED 34, GUS_GRN_SWEET 214, GUS_GRN_BITTER 65, GUS_GRN_WATER 131, GNG_DESC 3581, GENERIC_CENTRAL 21955 | MB_APL, MB_MBON_AV, MB_DAN_PUN, LH_AV, SEZ_GROOM, SEZ_WATER, CLOCK_DN |
| drives | DRIVE_HUNGER 46, DRIVE_FATIGUE 34 | DRIVE_FEAR, DRIVE_CURIOSITY, DRIVE_GROOM, GENERIC_DRIVES |
| motor | VNC_CPG 4, MN_PROBOSCIS 24, MN_HEAD 40, MN_ABDOMEN 8 | **all DN_* (walk, flight, turn, backup, startle)**, all MN_LEG_*, MN_WING_*, GENERIC_MOTOR |

Notes: "drives" are endocrine neurons relabelled as hunger/fatigue; "GUS_*" are counted as central although GRNs are
sensory; all descending neurons fall into GNG_DESC because Codex descending neurons have empty `class`.
Source: `data/neuron_meta.json`.

## 4. Web Worker (`sim-worker.js`)

* Dimensionless discrete LIF, one tick = no physical time; ticks at 10 Hz wall-clock (`setTimeout`).
* `V *= 0.95` per tick, threshold 1.0, reset 0, refractory 3 ticks, no delay, no synaptic current (instant `V += w`).
* Weights normalised: `w / max|w| × 0.15`. `max|w|` = 2405 synapses, median |w| = 8 → median scaled weight 0.0005.
* Neuropil gating: neurons reordered so each group is contiguous; only "active" groups are ticked; a group goes idle
  (and its state is zeroed) after 20 ticks without input.
* Deterministic (no noise, no seed). Messages: `init, start, stop, stimulate, setStimulusState, reset, setParams` →
  `ready, tick (full Uint8 fireState + groupSpikeCounts), stats, error`.

## 5. Stimuli and behaviour (where the fork is scripted)

Stimulus path: toolbar → `BRAIN.stimulate.*` flags → `collectStimulationSegments()` injects a constant 0.15 per tick
into **whole groups** (e.g. food contact → all of GUS_GRN_SWEET; touch → all of MECH_BRISTLE; temperature → THERMO_*;
"nociception" = 3 touches in 4 s → NOCI, which has 0 neurons). Tonic input is always added to CX_FC/EPG/PFN.

Behaviour path: group spike fraction × 100 → `BRAIN.postSynaptic[group]` → `synthesizeMotorOutputs()` → `motorcontrol()`
accumulators → `evaluateBehaviorEntry()` thresholds (`startle 30, fly 15, feed 8, groom 8, walk 5`).

What is **not** driven by simulated neurons:

1. `BRAIN.drives` (hunger, fear, fatigue, curiosity, groom) are JS counters (e.g. `fear += 0.3` on touch,
   `curiosity += random`). DRIVE_FEAR / CURIOSITY / GROOM have no neurons; their values are written straight
   into `postSynaptic` (`vd.fear * 100`).
2. Leg, wing, startle and groom motor outputs are synthesised by a "virtual VNC" formula from those drives and
   group activations (`flightIntent = dFear*2 + …`). Walking is the default and gets random jitter.
3. Feeding can start with zero neural activity: `hunger > 0.7 && foodNearby`.
4. Rest, phototaxis and explore are entered on drives/light only.

Measured consequence (see `MODEL_NOTES.md` §3): with the fork's dynamics, stimulating any sensory set never spreads
beyond the stimulated neurons, so every behaviour on screen comes from items 1–4.

## 6. Rendering and UI

Canvas 2D top-down fly (`main.js`), WebGL2 point cloud (`neuro-renderer.js`), Three.js sphere "brain" (`brain3d.js`),
DOM toolbar in English only. No i18n, no routing, no URL state, no tests of the UI.

## 7. What carries over to Fly Brain Lab

| Keep | Replace |
|------|---------|
| Worker + CSR + group-contiguous layout idea, gzip `DecompressionStream` loading | Worker dynamics/parameters (see MODEL_NOTES) |
| `connections.csv.gz` / `neurons.csv.gz` as raw inputs, `build_connectome.py` pipeline shape | Substring group classifier → FlyWire `cell_type`-based sets (`data/neuron_sets.json`) |
| WebGL point renderer idea | Sphere brain → FlyWire neuropil meshes |
| Fly sprite drawing code (as reference) | Drive/virtual-VNC behaviour layer → threshold on named readout neurons |
| — | Caretaker/LLM/server/iOS (dropped: needs API keys, not part of the lab) |
