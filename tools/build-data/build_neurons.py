"""Per-neuron identity and position for the browser (format FBN1).

Inputs:
  --annotations  flywire_annotations v3.2.0 Supplemental_file1_neuron_annotations.tsv
  data/neurons.csv.gz           neuron order (index = row)
  public/data/neuropils.json    -> mesh file header gives the centre/scale so positions share the mesh space

Output public/data/neurons.<hash>.bin.gz (+ neurons.json manifest {"file": ...}), little-endian:
  u32 json_length, JSON {"types": [...], "classes": [...], "nts": [...], "rootIdsFile": name}
  padding to 4 bytes
  u16[N] cell type index        (0 = no type)
  u8[N]  super_class index
  u8[N]  side (0 unknown, 1 left, 2 right, 3 center)
  u8[N]  predicted neurotransmitter index into "nts" (Codex neurons.csv nt_type)
  pad to 2 bytes
  i16[3N] position, quantised like the neuropil meshes: (nm - center) / scale

Also writes root_ids.<hash>.bin.gz: u64[N] FlyWire root IDs (loaded only by the neuron inspector).

Position: soma if annotated, else the annotation's representative point; annotation coordinates are FAFB voxels
(4 x 4 x 40 nm).
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import struct
from pathlib import Path

import numpy as np

VOXEL_NM = np.array([4.0, 4.0, 40.0])


def mesh_frame(out_dir: Path) -> tuple[np.ndarray, float]:
    manifest = json.loads((out_dir / "neuropils.json").read_text(encoding="utf-8"))
    raw = gzip.decompress((out_dir / manifest["file"]).read_bytes())
    (n,) = struct.unpack_from("<I", raw, 0)
    header = json.loads(raw[4 : 4 + n])
    return np.array(header["center"]), float(header["scale"])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--annotations", type=Path, required=True)
    parser.add_argument("--neurons", type=Path, default=Path("data/neurons.csv.gz"))
    parser.add_argument("--out-dir", type=Path, default=Path("public/data"))
    args = parser.parse_args()

    with gzip.open(args.neurons, "rt", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    ids = [row["root_id"] for row in rows]
    nts = [""] + sorted({row["nt_type"] for row in rows if row["nt_type"]})
    nt = np.array([nts.index(row["nt_type"]) for row in rows], dtype="u1")
    with open(args.annotations, encoding="utf-8") as f:
        ann = {r["root_id"]: r for r in csv.DictReader(f, delimiter="\t")}

    center, scale = mesh_frame(args.out_dir)
    types, classes = [""], [""]
    type_idx, class_idx = {"": 0}, {"": 0}
    t = np.zeros(len(ids), dtype="<u2")
    c = np.zeros(len(ids), dtype="u1")
    side = np.zeros(len(ids), dtype="u1")
    side_code = {"left": 1, "right": 2, "center": 3}
    pos = np.zeros((len(ids), 3), dtype="<i2")
    missing = 0
    for i, rid in enumerate(ids):
        a = ann.get(rid)
        if a is None:
            missing += 1
            continue
        for value, table, index, arr in ((a["cell_type"], types, type_idx, t), (a["super_class"], classes, class_idx, c)):
            if value not in index:
                index[value] = len(table)
                table.append(value)
            arr[i] = index[value]
        side[i] = side_code.get(a["side"], 0)
        xyz = [a["soma_x"], a["soma_y"], a["soma_z"]] if a["soma_x"] else [a["pos_x"], a["pos_y"], a["pos_z"]]
        nm = np.array([float(v) for v in xyz]) * VOXEL_NM
        pos[i] = np.clip(np.round((nm - center) / scale), -32767, 32767)
    if len(types) > 65535 or len(classes) > 255:
        raise SystemExit("too many types/classes for the index width")

    root_blob = gzip.compress(np.array([int(r) for r in ids], dtype="<u8").tobytes(), compresslevel=9, mtime=0)
    for old in args.out_dir.glob("root_ids.*.bin.gz"):
        old.unlink()
    root_file = f"root_ids.{hashlib.sha256(root_blob).hexdigest()[:10]}.bin.gz"
    (args.out_dir / root_file).write_bytes(root_blob)
    header = json.dumps({"types": types, "classes": classes, "nts": nts, "rootIdsFile": root_file}, separators=(",", ":")).encode()
    header += b" " * (-(4 + len(header)) % 4)
    body = t.tobytes() + c.tobytes() + side.tobytes() + nt.tobytes()
    body += b"\0" * (-len(body) % 2)
    blob = struct.pack("<I", len(header)) + header + body + pos.tobytes()
    packed = gzip.compress(blob, compresslevel=9, mtime=0)
    for old in args.out_dir.glob("neurons.*.bin.gz"):
        old.unlink()
    out = args.out_dir / f"neurons.{hashlib.sha256(packed).hexdigest()[:10]}.bin.gz"
    out.write_bytes(packed)
    (args.out_dir / "neurons.json").write_text(json.dumps({"file": out.name}), encoding="utf-8")
    print(f"{len(ids)} neurons ({missing} without annotation), {len(types) - 1} types, {len(packed) / 1e3:.0f} kB -> {out.name}")


if __name__ == "__main__":
    main()
