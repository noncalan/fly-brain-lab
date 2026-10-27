# Status

Last update: 2026-10-27. Steps 1–3 done, step 4 (v1 core) deployed: https://fly.noncalan.xyz

Step 4 adds: 3D NeuroMechFly body in an arena, walking from DNp09/MDN/DNa02, neuron points in the 3D brain,
21 stimuli, optogenetics of 8,846 cell types, lesions, URL state + share link, Experiments page (15 cards), intro dialog.
Tests: 57 Vitest, 30 Playwright (all pass against production). Screenshots: `docs/screenshots/`.

Known issues / next:
- Many unrelated stimuli (heat, cold, humidity, odours) fall into one ~8.5k-neuron state with left DNa02 ~60 Hz, so the
  fly turns left; flagged as a suspected model artefact (MODEL_NOTES §6). Needs a Brian2 reference run.
- No sensory stimulus drives DNp09 or MDN; walking appears only via optogenetics.
- Gait and grooming poses are procedural approximations on the NeuroMechFly rig (not NeuroMechFly kinematics data).
- Load ~2 s warm CDN; first load after a deploy can be much slower (cold CDN). Connectome still 9.5 MB.
- Phone: time bar takes ~15 % of the screen.
- Kazakh strings need native review.
- Remaining v1: neuron inspector (click a point), spike raster/heatmap, two flies side by side, exports (PNG/GIF/CSV).
- v2 not started. `legacy/` still not deleted (hook blocks deletion).

## In progress (step 5, 2026-10-27) — not yet committed when this note was written
- DONE locally: realistic gait from recorded NeuroMechFly steps (`public/data/gait.json`, `tools/build-data/build_gait.py`,
  `src/fly/gait.ts` + tests; FlyRig uses absolute recorded joint angles; running = higher step rate + longer stride,
  no foot sliding; command low-pass 150 ms; "Бег" label + speed mm/s).
- DONE locally: neuron data now has NT + root IDs file (`build_neurons.py`, `atlas.ts loadRootIds`); engine/worker/client
  `connections(neuron)`; `src/lab/NeuronInspector.tsx`; i18n keys for inspector/history/export/compare in `extra.ts`.
- TODO: wire inspector (BrainView point picking via `onPickNeuron`, LabPage state, lastSpike array), raster+heatmap
  component, exports (PNG via preserveDrawingBuffer, GIF via gifenc, CSV from history), Compare page (two
  useSimulation instances, B gets lesion/opto/pruning), e2e for new features, commit, deploy, docs.
