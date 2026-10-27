# Data and code licences

Checked 2026-10-27.

| Item | Licence | Evidence | What it means for us |
|---|---|---|---|
| FlyWire v783 connectivity (Zenodo 10.5281/zenodo.10676866) | CC BY 4.0 | Zenodo record page | Redistribution allowed with credit. |
| FlyWire reconstructions / contributions | CC BY-NC 4.0 | flywire.ai/tos, §1 item 2 | **Non-commercial only.** |
| FAFB EM images (Zheng, Lauritzen et al. 2018) | CC BY-NC 4.0 | edit.flywire.ai/credits.html | Non-commercial; we do not ship images. |
| FlyWire Codex downloads (`connections.csv`, `neurons.csv`, …) | no separate licence stated; points to flywire.ai/tos and a citation table | codex.flywire.ai/about_flywire | Treat as CC BY-NC 4.0 (strictest applicable). |
| flywire_annotations (Schlegel et al.) | repository has no licence file | GitHub API `license: null` | Use as data with citation; ask the authors before any commercial use. |
| Shiu et al. code `philshiu/Drosophila_brain_model` | MIT | `LICENSE` in repo | Equations, constants and ID lists may be reused with the copyright notice. |
| Eon `eonsystemspbc/fly-brain` | GPL-2.0 | GitHub API | **Nothing copied.** Read only for comparison. |
| FlyWire neuropil meshes `gs://flywire_neuropil_meshes/neuropils/neuropil_mesh_v141_v3` | FlyWire data terms (treated as CC BY-NC 4.0) | public bucket used by Codex | Shipped as a derived, quantised file. |
| Codex `murthylab/codex` (neuropil ID → name map, region categories) | Apache-2.0 | GitHub API | Mapping copied into `build_meshes.py` and `src/content/regions.ts` with attribution. |
| NeuroMechFly v2 body meshes and rig (`NeLy-EPFL/flygym`, NeuroMechFly v2, Nature Methods 2024, 10.1038/s41592-024-02497-y) | Apache-2.0 | GitHub API + LICENSE | Shipped as a quantised derived file (`public/data/fly.*.bin.gz`) with attribution. |
| Recorded walking step `single_steps_untethered.pkl` (flygym, NeuroMechFly) | Apache-2.0 | GitHub API + LICENSE | Converted to `public/data/gait.json` with a numpy-only unpickler. |
| gifenc 1.0.3 | MIT | package.json | GIF export. |
| Fork `snedea/flybrain` | MIT | `license.md` | Kept, our copyright added below. |

## Decision

The lab is a free, non-commercial educational site: no ads, no paid tier, no paywalled features, no selling of data.
"About" must credit FlyWire Consortium (Dorkenwald et al., Nature 2024, 10.1038/s41586-024-07558-y), Schlegel et al.
(Nature 2024, 10.1038/s41586-024-07686-5), Shiu et al. (Nature 2024, 10.1038/s41586-024-07763-9), Zheng et al. 2018,
and cite Codex (10.13140/RG.2.2.35928.67844) as Codex asks. The Codex citation table still needs to be read in full
before release.
