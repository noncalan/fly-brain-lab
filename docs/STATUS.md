# Status

Last update: 2026-10-27. Current step: **STOP 1** (waiting for Nurik).

Done: step 1 of the plan (fork, audit, model comparison, licence check, neuron sets). See `CHANGELOG.md`.

Open decisions for Nurik (from the STOP 1 report):
1. Replace the fork's dead LIF update rule with Shiu's equations/parameters (MIT) inside the existing worker design.
2. Edge set: ≥5-synapse graph (2.7 M edges) as the default model.
3. Stimuli that cannot be backed by data (nociception as such, body touch) and reactions (withdrawal, freezing,
   walking) — drop, relabel, or allow extra literature sources for DN roles (MDN, DNp09, DNa02).

Next step after approval: step 2 — Vite + React + TS + Tailwind, `src/sim/` with typed API, Vitest golden tests
on fixed seeds. Note: "same result as the original code" is not useful for the dynamics (the fork's core never
propagates); golden tests will pin the new Shiu-parameter core instead, plus parity tests for the parts kept from the fork
(binary parsing, CSR build, group layout).

Large local inputs not in git: `shiu783.bin`, `shiu783_ids.json`, FlyWire annotations TSV (see `tools/*/README.md`).
