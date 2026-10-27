"""Pack the NeuroMechFly v2 body model for the browser (format FBF1).

Source: NeLy-EPFL/flygym (Apache-2.0), src/flygym/assets/model/neuromechfly/
  meshes/simplified_max2000faces/*.stl   binary STL in metres, one per body segment (left side + centre)
  rigging.yaml                           body tree: position (mm) and orientation (w,x,y,z) relative to the parent
  pose/neutral/yaw_pitch_roll.yaml       neutral joint angles (degrees) for the left legs

Right-side segments reuse the left meshes mirrored across the sagittal plane (y -> -y), as NeuroMechFly does.

Output public/data/fly.<hash>.bin.gz (+ fly.json manifest), little-endian:
  u32 json_length, JSON {"meshes":[{"name","vertexOffset","vertexCount","indexOffset","indexCount"}],
                         "scale": mm per unit, "bodies":[{"name","parent","pos":[mm],"quat":[w,x,y,z],"mesh"}],
                         "neutral": {"joint name": [yaw, pitch, roll] degrees}}
  padding to 4 bytes
  i16[3V] positions (mm / scale), u16[I] indices (local per mesh)
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import struct
from pathlib import Path

import numpy as np

LEGS = ("lf", "lm", "lh", "rf", "rm", "rh")
LEG_CHAIN = ("coxa", "trochanterfemur", "tibia", "tarsus1", "tarsus2", "tarsus3", "tarsus4", "tarsus5")


def parent_of(name: str) -> str | None:
    """Body tree implied by NeuroMechFly segment names."""
    if name == "c_thorax":
        return None
    if name in ("c_head", "c_abdomen12") or re.fullmatch(r"[lr]_(wing|haltere)", name) or name.endswith("_coxa"):
        return "c_thorax"
    if name == "c_rostrum" or re.fullmatch(r"[lr]_(eye|pedicel)", name):
        return "c_head"
    chain = {"c_haustellum": "c_rostrum", "c_abdomen3": "c_abdomen12", "c_abdomen4": "c_abdomen3",
             "c_abdomen5": "c_abdomen4", "c_abdomen6": "c_abdomen5"}
    if name in chain:
        return chain[name]
    m = re.fullmatch(r"([lr])_(funiculus|arista)", name)
    if m:
        return f"{m[1]}_pedicel" if m[2] == "funiculus" else f"{m[1]}_funiculus"
    leg, _, seg = name.partition("_")
    if leg in LEGS and seg in LEG_CHAIN:
        return f"{leg}_{LEG_CHAIN[LEG_CHAIN.index(seg) - 1]}"
    raise SystemExit(f"unknown body {name}")


def read_rigging(path: Path) -> dict[str, dict]:
    """Minimal reader for rigging.yaml (name: {pos: [..], quat: [..], mass: x})."""
    bodies, cur = {}, None
    for line in path.read_text(encoding="utf-8").splitlines():
        if re.match(r"^\w", line):
            cur = line.rstrip(":").strip()
            bodies[cur] = {}
        elif cur and ":" in line:
            k, v = line.strip().split(":", 1)
            v = v.strip()
            bodies[cur][k] = json.loads(v) if v.startswith("[") else float(v)
    return bodies


def read_neutral(path: Path) -> dict[str, list[float]]:
    """'c_thorax-lf_coxa-pitch: 19' -> {'lf_coxa': [yaw, pitch, roll]} for the child segment."""
    out: dict[str, list[float]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s+[\w]+-([\w]+)-(yaw|pitch|roll):\s*(-?[\d.]+)", line)
        if m:
            out.setdefault(m[1], [0.0, 0.0, 0.0])["yaw pitch roll".split().index(m[2])] = float(m[3])
    return out


def read_stl(path: Path) -> tuple[np.ndarray, np.ndarray]:
    raw = path.read_bytes()
    (n,) = struct.unpack_from("<I", raw, 80)
    tri = np.frombuffer(raw, dtype=np.dtype([("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")]), count=n, offset=84)
    v = tri["v"].reshape(-1, 3).astype(np.float64) * 1000.0  # m -> mm
    uniq, inv = np.unique(np.round(v, 5), axis=0, return_inverse=True)
    return uniq, inv.reshape(-1).astype(np.uint32)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model-dir", type=Path, required=True, help="local copy of flygym .../assets/model/neuromechfly")
    parser.add_argument("--out-dir", type=Path, default=Path("public/data"))
    args = parser.parse_args()

    rig = read_rigging(args.model_dir / "rigging.yaml")
    neutral = read_neutral(args.model_dir / "pose/neutral/yaw_pitch_roll.yaml")
    mesh_dir = args.model_dir / "meshes/simplified_max2000faces"
    meshes = {p.stem: read_stl(p) for p in sorted(mesh_dir.glob("*.stl"))}

    all_v = np.concatenate([v for v, _ in meshes.values()])
    scale = float(np.abs(all_v).max() / 32767)
    mesh_meta, pos_parts, idx_parts = [], [], []
    v_off = i_off = 0
    for name, (v, idx) in meshes.items():
        if len(v) > 65535:
            raise SystemExit(f"{name}: too many vertices for u16 indices")
        mesh_meta.append({"name": name, "vertexOffset": v_off, "vertexCount": len(v), "indexOffset": i_off, "indexCount": len(idx)})
        pos_parts.append(np.round(v / scale).astype("<i2").reshape(-1))
        idx_parts.append(idx.astype("<u2"))
        v_off += len(v)
        i_off += len(idx)

    bodies = []
    for name, b in rig.items():
        mirrored = name.startswith(("r_", "rf_", "rm_", "rh_"))
        mesh = ("l" + name[1:]) if mirrored else name
        bodies.append({"name": name, "parent": parent_of(name), "pos": b["pos"], "quat": b["quat"],
                       "mesh": mesh if mesh in meshes else None, "mirror": mirrored})

    header = json.dumps({"meshes": mesh_meta, "scale": scale, "bodies": bodies, "neutral": neutral}, separators=(",", ":")).encode()
    header += b" " * (-(4 + len(header)) % 4)
    positions = np.concatenate(pos_parts).tobytes()
    positions += b"\0" * (-len(positions) % 4)
    blob = struct.pack("<I", len(header)) + header + positions + np.concatenate(idx_parts).tobytes()
    packed = gzip.compress(blob, compresslevel=9, mtime=0)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    for old in args.out_dir.glob("fly.*.bin.gz"):
        old.unlink()
    out = args.out_dir / f"fly.{hashlib.sha256(packed).hexdigest()[:10]}.bin.gz"
    out.write_bytes(packed)
    (args.out_dir / "fly.json").write_text(json.dumps({"file": out.name, "source": "NeLy-EPFL/flygym NeuroMechFly v2 (Apache-2.0)"}), encoding="utf-8")
    print(f"{len(meshes)} meshes, {len(bodies)} bodies, {v_off} vertices, {i_off // 3} triangles, {len(packed) / 1e3:.0f} kB -> {out.name}")


if __name__ == "__main__":
    main()
