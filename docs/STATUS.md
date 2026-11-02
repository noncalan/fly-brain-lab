# Status

Last update: 2026-11-02. v1 and v2 deployed at https://fly.noncalan.xyz. Next: STOP for Nurik's review of v2, then the
final check (step 6). Full handoff for a fresh session: `docs/HANDOFF_PROMPT.md` (its §9 v2 list is now done).

## v2 (2026-11-02) — see CHANGELOG for details
- `/compress` "Compress the brain": pruning, weight bits, merging neurons by cell type + side; honest model size
  (bit-packed CSR); readout rates; kept/partly/lost verdict. Probe: `tools/calibrate/results/compression.json`,
  notes in `docs/MODEL_NOTES.md` §7 (merge + 4 bits = 1.82 MB vs 10.85 MB keeps feeding, escape, grooming).
- Spike sonification under the 3D brain (clicks per spike of a chosen region).
- `/scale`: neuron counts and EM dataset sizes, every number with DOI and location in the paper.
- `/lessons`: 6 lessons with demos, quizzes and a full-screen teacher mode.
- Mobile: shared FPS governor lowers pixel ratio / shadows / neuron points below 30 FPS; phones start at medium;
  one-row time bar (~5 % of the screen); nav scrolls on phones.
- Tests: Vitest unit tests (+2 probes skipped by default) and the e2e suite in `e2e/` (smoke, stimuli, perf, v1, v2);
  counts of the last run are in the CHANGELOG.
- Screenshots: `node tools/og/screens.mjs` → `docs/screenshots/` (lab, compress, scale, lessons; desktop and phone).

## Known issues / not done
- Final check (step 6) not started: Lighthouse ≥ 90, every stimulus/experiment e2e, three languages, phone review, final report.
- Kazakh text (v1 and v2) needs a native speaker.
- Suspected attractor artefact (heat, cold, humidity, odours → ~8.5k-neuron state, left turn): not checked against Brian2.
- The merged model changes rates (MN9 higher, aDN1 much higher): it is a coarser model, not a lossless one.
- Connectome download is still 9.5 MB (delta+varint idea not measured). `legacy/` still present (deletion needs Nurik).
- On the Lessons page, the nav link "Lessons" does nothing while a lesson is open (use "All lessons").
