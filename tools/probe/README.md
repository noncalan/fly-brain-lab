# Model probe (one-off, 2026-10-27)

Answers "does stimulus set X drive readout Y?" for the fork's dynamics and for a JS port of Shiu et al.
Results are in `results/` and summarised in `docs/MODEL_NOTES.md` §3.

Inputs not committed (large / third-party), placed next to the scripts:

* `shiu783.bin`: flat dump of `Connectivity_783.parquet` from `philshiu/Drosophila_brain_model@91bdd1e7`:
  `u32 N, u32 E, u32[E] pre_index, u32[E] post_index, f32[E] 'Excitatory x Connectivity'`, rows sorted by pre.
* `shiu783_ids.json`: root IDs in `Completeness_783.csv` order (Shiu index → root_id).
* `sets_idx.json`: neuron sets as indices into `data/neurons.csv.gz` (copy in `results/`).

Run: `node --max-old-space-size=6144 probe.js fork|shiu`, `node probe2.js`, `node probe3.js 5`.
The scripts are throwaway; the real engine will live in `src/sim/`.
