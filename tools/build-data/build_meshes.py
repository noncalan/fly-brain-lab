"""Download FlyWire neuropil surface meshes and pack them for the browser.

Source meshes: FlyWire public bucket gs://flywire_neuropil_meshes/neuropils/neuropil_mesh_v141_v3 (neuroglancer legacy
mesh format), the same layer FlyWire Codex shows. Segment ID -> neuropil name mapping copied from
murthylab/codex codex/data/brain_regions.py (Apache-2.0).

Output public/data/neuropils.json ({"file": <name>}) and public/data/neuropils.<hash>.bin.gz, little-endian:
  u32 json_length, utf-8 JSON {"regions":[{"name","vertexOffset","vertexCount","indexOffset","indexCount"}],
                               "scale": nm per unit, "center": [x,y,z] nm}
  padding to 4 bytes
  i16[3 * total_vertices]  positions, quantised: (nm - center) / scale, range +-32767
  u32[total_indices]       triangle indices, local to each region
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import struct
import urllib.request
from pathlib import Path

import numpy as np

BASE_URL = "https://storage.googleapis.com/flywire_neuropil_meshes/neuropils/neuropil_mesh_v141_v3/mesh"

# From murthylab/codex codex/data/brain_regions.py (Apache-2.0): neuropil -> segment ID in neuropil_mesh_v141_v3.
SEGMENT_IDS: dict[str, int] = {
    "AME_L": 56, "AME_R": 29, "LO_L": 51, "LO_R": 14, "NO": 58, "BU_L": 73, "BU_R": 11, "PB": 68, "LH_L": 20,
    "LH_R": 54, "LAL_L": 46, "LAL_R": 25, "SAD": 70, "CAN_L": 3, "CAN_R": 61, "AMMC_L": 45, "AMMC_R": 71,
    "ICL_L": 31, "ICL_R": 33, "VES_L": 44, "VES_R": 40, "IB_L": 67, "IB_R": 17, "ATL_L": 18, "ATL_R": 23,
    "CRE_L": 30, "CRE_R": 19, "MB_PED_L": 48, "MB_PED_R": 28, "MB_VL_L": 4, "MB_VL_R": 55, "MB_ML_L": 10,
    "MB_ML_R": 41, "FLA_L": 74, "FLA_R": 5, "LOP_L": 6, "LOP_R": 36, "EB": 35, "AL_L": 57, "AL_R": 27,
    "ME_L": 43, "ME_R": 2, "FB": 65, "SLP_L": 62, "SLP_R": 47, "SIP_L": 72, "SIP_R": 63, "SMP_L": 42,
    "SMP_R": 1, "AVLP_L": 69, "AVLP_R": 49, "PVLP_L": 39, "PVLP_R": 37, "WED_L": 50, "WED_R": 60,
    "PLP_L": 59, "PLP_R": 9, "AOTU_L": 22, "AOTU_R": 24, "GOR_L": 12, "GOR_R": 32, "MB_CA_L": 66,
    "MB_CA_R": 21, "SPS_L": 13, "SPS_R": 64, "IPS_L": 7, "IPS_R": 38, "SCL_L": 15, "SCL_R": 0, "EPA_L": 8,
    "EPA_R": 52, "GNG": 26, "PRW": 53, "GA_L": 34, "GA_R": 16, "LA_R": 75, "LA_L": 76, "OCG": 77,
}


def fetch_fragment(segment_id: int, cache: Path) -> tuple[np.ndarray, np.ndarray]:
    path = cache / f"{segment_id}.frag"
    if not path.exists():
        with urllib.request.urlopen(f"{BASE_URL}/{segment_id}:0:0", timeout=60) as r:
            path.write_bytes(r.read())
    raw = path.read_bytes()
    (nv,) = struct.unpack_from("<I", raw, 0)
    verts = np.frombuffer(raw, "<f4", nv * 3, 4).reshape(nv, 3)
    idx = np.frombuffer(raw, "<u4", offset=4 + 12 * nv)
    if idx.size % 3 or (idx.size and idx.max() >= nv):
        raise SystemExit(f"segment {segment_id}: malformed mesh")
    return verts, idx


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cache", type=Path, default=Path(".cache/neuropil_meshes"))
    parser.add_argument("--out-dir", type=Path, default=Path("public/data"))
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)

    meshes = {name: fetch_fragment(seg, args.cache) for name, seg in sorted(SEGMENT_IDS.items())}
    all_v = np.concatenate([v for v, _ in meshes.values()])
    lo, hi = all_v.min(0), all_v.max(0)
    center = (lo + hi) / 2
    scale = float((hi - lo).max() / 2 / 32767)

    regions, pos_parts, idx_parts = [], [], []
    v_off = i_off = 0
    for name, (v, idx) in meshes.items():
        q = np.round((v - center) / scale).astype("<i2")
        regions.append({"name": name, "vertexOffset": v_off, "vertexCount": len(v), "indexOffset": i_off, "indexCount": int(idx.size)})
        pos_parts.append(q.reshape(-1))
        idx_parts.append(idx.astype("<u4"))
        v_off += len(v)
        i_off += int(idx.size)

    header = json.dumps({"regions": regions, "scale": scale, "center": center.tolist()}, separators=(",", ":")).encode()
    header += b" " * (-(4 + len(header)) % 4)
    positions = np.concatenate(pos_parts).tobytes()
    positions += b"\0" * (-len(positions) % 4)
    blob = struct.pack("<I", len(header)) + header + positions + np.concatenate(idx_parts).tobytes()
    packed = gzip.compress(blob, compresslevel=9, mtime=0)
    digest = hashlib.sha256(packed).hexdigest()[:10]
    args.out_dir.mkdir(parents=True, exist_ok=True)
    for old in args.out_dir.glob("neuropils.*.bin.gz"):
        old.unlink()
    out = args.out_dir / f"neuropils.{digest}.bin.gz"
    out.write_bytes(packed)
    (args.out_dir / "neuropils.json").write_text(json.dumps({"file": out.name, "source": BASE_URL}), encoding="utf-8")
    print(f"{len(regions)} neuropils, {v_off} vertices, {i_off // 3} triangles, {len(packed) / 1e3:.0f} kB -> {out.name}")


if __name__ == "__main__":
    main()
