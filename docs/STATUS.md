# Status

Last update: 2026-10-27. Current step: **3 — MVP** (not started). Step 2 done.

Decisions taken by Nurik at STOP 1: Shiu parameters; graph ≥5 synapses; unconfirmed stimuli/reactions removed;
walking DNs (MDN, DNp09, DNa02) — pending his decision, not wired.

Step 2 result: see `CHANGELOG.md`. `npm test` → 32 passed, 1 skipped (calibration, run with `CALIBRATE=1`).

Next (step 3, MVP): design system (dark/light, Inter + mono, one accent), RU/KK/EN i18n with browser default,
3D brain with FlyWire neuropil meshes (source and licence to check), region tooltips, signal-path animation,
drag-to-fly stimuli, time controls polish, Vercel project `fly-brain-lab` + domain `fly.noncalan.xyz` (DNS check → STOP 2).
Known perf gap: looming/heat run below real time (×0.15–0.3); options: dt 0.2 ms validated against golden tests,
WASM, or SharedArrayBuffer multi-worker.

Not deleted (hook blocked deletion; moved to `legacy/` instead): old app, caretaker server, iOS wrapper,
`data/connectome.bin.gz`, `data/neuron_meta.json`. Delete when Nurik confirms.

Large local inputs not in git: `shiu783.bin`, `shiu783_ids.json`, FlyWire annotations TSV (see `tools/*/README.md`).
