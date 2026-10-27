# Status

Last update: 2026-10-27. Current step: **STOP 2** (waiting for Nurik's review of the MVP). Steps 1–3 done.

Live: https://fly.noncalan.xyz (Vercel project `fly-brain-lab`, auto-deploy from `main`).
Screenshots: `docs/screenshots/` (regenerate with `node tools/og/screens.mjs`).

Tests: `npm test` (32 Vitest), `npx playwright test` (13 e2e; `E2E_BASE_URL=https://fly.noncalan.xyz` for production).

Known issues / next:
- Load: connectome is 9.5 MB gzip; ~2 s here on a warm CDN, ~8 s expected at 10 Mbit/s. Option: delta + varint
  encoding of CSR columns (estimate: roughly half the size, not measured yet).
- Phone: sticky time bar takes ~15 % of the screen; fly panel is below the stimuli. Make the bar one compact row.
- Heavy stimuli (looming, heat) run below real time (×0.15–0.3 measured in step 2); the UI shows the measured factor.
- Software-rendered WebGL (no GPU) gives ~15 FPS; mobile auto-quality is planned for v2.
- Kazakh strings need a native-speaker review.
- Walking DNs (MDN, DNp09, DNa02) — waiting for Nurik's decision on extra literature sources.
- Not deleted (hook blocked deletion): `legacy/`, old `data/connectome.bin.gz`, `data/neuron_meta.json`.
