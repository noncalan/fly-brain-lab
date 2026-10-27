"""Build the browser connectome for Fly Brain Lab (format FBL1).

Inputs (FlyWire Codex v783, already in data/):
  data/neurons.csv.gz      root_id order defines neuron index
  data/connections.csv.gz  pre_root_id, post_root_id, neuropil, syn_count, nt_type (pairs with >=5 synapses)
  data/neuron_sets.json    stimulus/readout sets by root_id (tools/neuron-sets/build_sets.py)
  data/shiu_signs_783.csv.gz  outgoing sign per neuron from Shiu et al. Connectivity_783 (MIT)

Outputs (public/data/):
  connectome.fbl1.bin.gz   gzip of the binary below
  meta.json                neuron count, edge count, neuropil names, sets as indices, provenance

Binary, little-endian:
  char[4]  magic "FBL1"
  u32      neuron_count N
  u32      edge_count E
  u32      neuropil_count P
  u32[N+1] row_ptr                  CSR over presynaptic neurons
  u32[E]   col                      postsynaptic index, ascending within each row
  i16[E]   weight                   signed synapse count (Shiu et al.: GABA and Glu inhibitory)
  u8[N]    primary_neuropil         neuropil with most synapses (in + out), 255 = none

Signs are taken per presynaptic neuron from Shiu et al. (GABA and glutamate inhibitory), so the graph equals
Shiu's Connectivity_783 restricted to pairs with >=5 synapses. Codex nt_type is only a fallback for neurons missing
from Shiu's file: its neuron-level nt_type is empty for ~9.7k neurons and its per-row nt_type can differ between
neuropils of the same pair.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import struct
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

MAGIC = b"FBL1"
NO_NEUROPIL = 255
INHIBITORY_NT = {"GABA", "GLUT"}
MIN_SYNAPSES = 5  # Codex connections.csv is already thresholded at 5; enforced again for safety


def load_neurons(path: Path, shiu_signs_path: Path) -> tuple[list[str], dict[str, int], list[int]]:
    """Neuron order, root_id -> index, and the outgoing sign of each neuron."""
    with gzip.open(shiu_signs_path, "rt", encoding="utf-8") as f:
        shiu = {row["root_id"]: int(row["sign"]) for row in csv.DictReader(line for line in f if not line.startswith("#"))}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    ids = [row["root_id"] for row in rows]
    signs = [shiu.get(row["root_id"], -1 if row["nt_type"].strip().upper() in INHIBITORY_NT else 1) for row in rows]
    return ids, {rid: i for i, rid in enumerate(ids)}, signs


def read_connections(path: Path, index: dict[str, int]):
    pair_syn: dict[tuple[int, int], int] = defaultdict(int)
    neuropil_syn: dict[tuple[int, str], int] = defaultdict(int)
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            pre = index.get(row["pre_root_id"])
            post = index.get(row["post_root_id"])
            if pre is None or post is None:
                continue
            syn = int(row["syn_count"])
            pair_syn[(pre, post)] += syn
            neuropil_syn[(pre, row["neuropil"])] += syn
            neuropil_syn[(post, row["neuropil"])] += syn
    return pair_syn, neuropil_syn


def primary_neuropils(n: int, neuropil_syn: dict[tuple[int, str], int]) -> tuple[list[str], np.ndarray]:
    names = sorted({np_name for _, np_name in neuropil_syn})
    if len(names) >= NO_NEUROPIL:
        raise SystemExit("too many neuropils for u8")
    name_idx = {name: i for i, name in enumerate(names)}
    best = np.full(n, NO_NEUROPIL, dtype=np.uint8)
    best_syn = np.zeros(n, dtype=np.int64)
    for (neuron, np_name), syn in neuropil_syn.items():
        if syn > best_syn[neuron]:
            best_syn[neuron] = syn
            best[neuron] = name_idx[np_name]
    return names, best


def build_csr(n: int, pair_syn, signs: list[int]) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    items = sorted((pre, post, syn * signs[pre]) for (pre, post), syn in pair_syn.items() if syn >= MIN_SYNAPSES)
    pre = np.fromiter((p for p, _, _ in items), dtype=np.uint32, count=len(items))
    col = np.fromiter((q for _, q, _ in items), dtype=np.uint32, count=len(items))
    w = np.fromiter((s for _, _, s in items), dtype=np.int32, count=len(items))
    if np.abs(w).max() > np.iinfo(np.int16).max:
        raise SystemExit("weight overflows i16")
    row_ptr = np.zeros(n + 1, dtype=np.uint32)
    np.add.at(row_ptr, pre.astype(np.int64) + 1, 1)
    row_ptr = np.cumsum(row_ptr, dtype=np.uint64).astype(np.uint32)
    return row_ptr, col, w.astype(np.int16)


def sets_as_indices(path: Path, index: dict[str, int]) -> dict:
    raw = json.loads(path.read_text(encoding="utf-8"))
    out = {}
    for set_id, s in raw.items():
        out[set_id] = {k: v for k, v in s.items() if k != "root_ids"}
        out[set_id]["indices"] = sorted(index[r] for r in s["root_ids"] if r in index)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    parser.add_argument("--out-dir", type=Path, default=Path("public/data"))
    args = parser.parse_args()

    ids, index, signs = load_neurons(args.data_dir / "neurons.csv.gz", args.data_dir / "shiu_signs_783.csv.gz")
    n = len(ids)
    pair_syn, neuropil_syn = read_connections(args.data_dir / "connections.csv.gz", index)
    names, primary = primary_neuropils(n, neuropil_syn)
    row_ptr, col, w = build_csr(n, pair_syn, signs)
    e = len(col)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    blob = b"".join([
        MAGIC, struct.pack("<III", n, e, len(names)),
        row_ptr.astype("<u4").tobytes(), col.astype("<u4").tobytes(), w.astype("<i2").tobytes(),
        primary.tobytes(),
    ])
    out_bin = args.out_dir / "connectome.fbl1.bin.gz"
    out_bin.write_bytes(gzip.compress(blob, compresslevel=9, mtime=0))

    meta = {
        "format": "FBL1",
        "neuron_count": n,
        "edge_count": e,
        "synapse_count": int(np.abs(w.astype(np.int64)).sum()),
        "inhibitory_edge_fraction": round(float((w < 0).mean()), 4),
        "min_synapses": MIN_SYNAPSES,
        "neuropils": names,
        "sets": sets_as_indices(args.data_dir / "neuron_sets.json", index),
        "source": "FlyWire Codex v783 connections.csv (pairs >=5 synapses); signs from Shiu et al. Connectivity_783 (MIT)",
    }
    (args.out_dir / "meta.json").write_text(json.dumps(meta, separators=(",", ":")), encoding="utf-8")
    print(f"N={n} E={e} neuropils={len(names)} raw={len(blob)/1e6:.1f} MB gz={out_bin.stat().st_size/1e6:.1f} MB",
          file=sys.stderr)


if __name__ == "__main__":
    main()
