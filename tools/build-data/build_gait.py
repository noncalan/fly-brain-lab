"""Recorded single-step leg kinematics for the 3D fly (public/data/gait.json).

Source: NeLy-EPFL/flygym (Apache-2.0), src/flygym_demo/complex_terrain/assets/single_steps_untethered.pkl — one step
cycle per leg from 3D pose estimation of a walking fly (NeuroMechFly preprogrammed steps). The pickle is read with an
unpickler that only allows numpy array reconstruction, so it cannot run code.

Angles are radians in the NeuroMechFly legacy convention, which matches this project's rig (left side + mirrored
right side) without sign flips; checked by computing foot positions (feet mirror across the midline, stance on y≈0).
"""
from __future__ import annotations

import argparse
import json
import pickle
from pathlib import Path

import numpy as np

LEGS = ("lf", "lm", "lh", "rf", "rm", "rh")
DOFS = {"coxa_pitch": "Coxa", "coxa_roll": "Coxa_roll", "coxa_yaw": "Coxa_yaw", "femur_pitch": "Femur",
        "femur_roll": "Femur_roll", "tibia_pitch": "Tibia", "tarsus_pitch": "Tarsus1"}
ALLOWED = {("numpy.core.multiarray", "_reconstruct"), ("numpy._core.multiarray", "_reconstruct"), ("numpy", "ndarray"),
           ("numpy", "dtype"), ("numpy.core.multiarray", "scalar"), ("numpy._core.multiarray", "scalar")}


class ArrayOnlyUnpickler(pickle.Unpickler):
    def find_class(self, module: str, name: str):
        if (module, name) in ALLOWED:
            return super().find_class(module, name)
        raise pickle.UnpicklingError(f"refusing to load {module}.{name}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--steps", type=Path, required=True, help="single_steps_untethered.pkl")
    parser.add_argument("--out", type=Path, default=Path("public/data/gait.json"))
    args = parser.parse_args()

    with open(args.steps, "rb") as f:
        data = ArrayOnlyUnpickler(f).load()
    timestep = float(data["meta"]["timestep"])
    samples = len(data["joint_LFCoxa"])
    duration = samples * timestep
    legs = {}
    for leg in LEGS:
        key = leg.upper()
        legs[leg] = {dof: [round(float(v), 5) for v in np.asarray(data[f"joint_{key}{src}"])] for dof, src in DOFS.items()}
        # phase 0 is the start of swing; the stored stance time is where swing ends (flygym preprogrammed.py)
        legs[leg]["swing_end_phase"] = round(float(data["swing_stance_time"]["stance"][key]) / duration * 2 * np.pi, 4)
    out = {"source": "NeLy-EPFL/flygym single_steps_untethered.pkl (Apache-2.0)", "timestep_s": timestep,
           "samples": samples, "step_frequency_hz": round(1 / duration, 3), "legs": legs}
    args.out.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"{samples} samples, {1 / duration:.2f} Hz step frequency -> {args.out} ({args.out.stat().st_size / 1e3:.0f} kB)")


if __name__ == "__main__":
    main()
