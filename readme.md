# Fly Brain Lab

Interactive teaching lab: give a simulated fruit fly a stimulus, see which neurons and brain regions respond and
whether the model produces a behaviour. The model is a simplified leaky integrate-and-fire network on the real wiring
diagram (FlyWire v783), not a living fly; it has no consciousness or pain.

* 139,255 neurons, 2,700,513 connections (pairs with ≥5 synapses), signs and LIF parameters from Shiu et al. 2024.
* The simulation runs in a Web Worker (`src/sim/`); behaviours switch on only when named readout neurons
  (MN9, Giant Fiber, aDN1) exceed thresholds in `config/behaviors.json`.
* Every neuron set has a source: `data/NEURON_SETS.md`. Model details and limits: `docs/MODEL_NOTES.md`.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: engine, real-connectome golden tests, behaviour config
npm run build
```

Rebuild data (needs `uv`): `npm run data:build` → `public/data/connectome.fbl1.bin.gz` + `meta.json`.

## Credits

FlyWire Consortium (Dorkenwald et al., Nature 2024; Schlegel et al., Nature 2024); Shiu et al., Nature 2024
(model and code, MIT); flybrain by snedea and worm-sim by Seth Miller (MIT), from which this project is forked.
Data licences: `docs/DATA_LICENSES.md` (non-commercial). Code: MIT, see `license.md`.
