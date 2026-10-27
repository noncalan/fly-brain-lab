"""Build data/neuron_sets.json: every stimulus/readout neuron set used by the lab, with its source.

Rule: a set exists only if its members come from FlyWire annotations, Shiu et al. code, or the fork.
Inputs (not committed, see README in this folder):
  --annotations  flyconnectome/flywire_annotations Supplemental_file1_neuron_annotations.tsv (v3.2.0)
  --neurons      data/neurons.csv.gz from this repo (defines the v783 root_id list and index order)
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
from pathlib import Path

ANNOTATIONS_REF = "flyconnectome/flywire_annotations@a83b2776 (release v3.2.0), Supplemental_file1_neuron_annotations.tsv"
SHIU_REF = "philshiu/Drosophila_brain_model@91bdd1e7 figures.ipynb (FlyWire v630 IDs; only IDs unchanged in v783 kept)"

# (set_id, kind, {column: allowed values}, note). All conditions must hold.
ANNOTATION_SETS: list[tuple[str, str, dict[str, tuple[str, ...]], str]] = [
    ("grn_sugar", "stimulus", {"cell_sub_class": ("sugar", "sugar/low_salt")}, "labellar sugar GRNs, both sides"),
    ("grn_water", "stimulus", {"cell_sub_class": ("water",)}, "labellar water GRNs, both sides"),
    ("grn_bitter", "stimulus", {"cell_sub_class": ("bitter",)}, "labellar bitter GRNs, both sides"),
    ("grn_salt", "stimulus", {"cell_sub_class": ("high_salt/heavy_metal",)}, "labellar high-salt / heavy-metal GRNs (LB3d)"),
    ("grn_glutamate", "stimulus", {"cell_sub_class": ("glutamate",)}, "labellar GRNs annotated glutamate (LB1e)"),
    ("grn_taste_peg", "stimulus", {"cell_class": ("gustatory",), "cell_sub_class": ("taste peg",)}, "taste peg GRNs"),
    ("trn_heat", "stimulus", {"cell_type": ("TRN_VP2",)}, "antennal heating-sensing thermosensory neurons"),
    ("trn_cold", "stimulus", {"cell_type": ("TRN_VP3a", "TRN_VP3b")}, "antennal cold-sensing thermosensory neurons"),
    ("hrn_dry", "stimulus", {"cell_type": ("HRN_VP4",)}, "hygrosensory neurons annotated dry"),
    ("hrn_moist", "stimulus", {"cell_type": ("HRN_VP5",)}, "hygrosensory neurons annotated moist"),
    ("jo_wind_gravity", "stimulus", {"cell_sub_class": ("wind_gravity",)}, "Johnston's organ neurons, wind/gravity"),
    ("jo_auditory", "stimulus", {"cell_class": ("mechanosensory",), "cell_sub_class": ("auditory",)}, "Johnston's organ neurons, auditory"),
    ("jo_grooming", "stimulus", {"cell_sub_class": ("grooming",)}, "Johnston's organ neurons tagged grooming"),
    ("bm_antenna", "stimulus", {"cell_type": ("BM_Ant",)}, "antennal bristle mechanosensory neurons"),
    ("vpn_looming", "stimulus", {"cell_type": ("LC4", "LPLC2")}, "visual projection neurons (no photoreceptor input modelled)"),
    ("photo_ocellar", "stimulus", {"cell_class": ("visual",), "cell_sub_class": ("ocellar",)}, "ocellar photoreceptors"),
    ("photo_dra", "stimulus", {"cell_class": ("visual",), "cell_sub_class": ("DRA",)}, "dorsal rim area photoreceptors"),
    ("orn_da1", "stimulus", {"cell_type": ("ORN_DA1",)}, "olfactory receptor neurons of glomerulus DA1"),
    ("orn_v", "stimulus", {"cell_type": ("ORN_V",)}, "olfactory receptor neurons of glomerulus V"),
    ("orn_dm1", "stimulus", {"cell_type": ("ORN_DM1",)}, "olfactory receptor neurons of glomerulus DM1"),
    ("orn_va2", "stimulus", {"cell_type": ("ORN_VA2",)}, "olfactory receptor neurons of glomerulus VA2"),
    ("orn_dl5", "stimulus", {"cell_type": ("ORN_DL5",)}, "olfactory receptor neurons of glomerulus DL5"),
    ("mn9", "readout", {"cell_type": ("CB0701",)}, "MN9 = CB0701 (Shiu MN9 v630 ID 720575940660219265 maps to CB0701 in v783)"),
    ("giant_fiber", "readout", {"cell_type": ("DNp01",)}, "DNp01, hemibrain_type 'Giant Fiber'"),
    ("adn1", "readout", {"cell_type": ("DNg62",)}, "Shiu id_DN1_1 720575940616185531 is DNg62 in v783"),
    ("abn1", "readout", {"cell_type": ("SAD093",)}, "Shiu id_aBN1 720575940630907434 is SAD093 in v783"),
    ("mdn", "readout", {"cell_type": ("MDN",)}, "MDN, backward walking (Bidaye et al. 2014)"),
    ("dnp09", "readout", {"cell_type": ("DNp09",)}, "DNp09 = P9, forward walking with ipsilateral turning (Bidaye et al. 2020)"),
    ("dna02", "readout", {"cell_type": ("DNa02",)}, "DNa02, steering (Rayshubskiy et al. 2025)"),
    ("mdn_l", "readout", {"cell_type": ("MDN",), "side": ("left",)}, "MDN, left"),
    ("mdn_r", "readout", {"cell_type": ("MDN",), "side": ("right",)}, "MDN, right"),
    ("dnp09_l", "readout", {"cell_type": ("DNp09",), "side": ("left",)}, "DNp09, left"),
    ("dnp09_r", "readout", {"cell_type": ("DNp09",), "side": ("right",)}, "DNp09, right"),
    ("dna02_l", "readout", {"cell_type": ("DNa02",), "side": ("left",)}, "DNa02, left"),
    ("dna02_r", "readout", {"cell_type": ("DNa02",), "side": ("right",)}, "DNa02, right"),
]

# Exact v630 ID lists copied from Shiu et al. figures.ipynb (MIT). Kept for "replicate Shiu" experiments.
SHIU_SETS: dict[str, tuple[str, ...]] = {
    "shiu_sugar_r": (
        "720575940624963786", "720575940630233916", "720575940637568838", "720575940638202345", "720575940617000768",
        "720575940630797113", "720575940632889389", "720575940621754367", "720575940621502051", "720575940640649691",
        "720575940639332736", "720575940616885538", "720575940639198653", "720575940620900446", "720575940617937543",
        "720575940632425919", "720575940633143833", "720575940612670570", "720575940628853239", "720575940629176663",
        "720575940611875570",
    ),
    "shiu_bitter_r": (
        "720575940621778381", "720575940602353632", "720575940617094208", "720575940619197093", "720575940626287336",
        "720575940618600651", "720575940627692048", "720575940630195909", "720575940646212996", "720575940610483162",
        "720575940645743412", "720575940627578156", "720575940622298631", "720575940621008895", "720575940629146711",
        "720575940610259370", "720575940610481370", "720575940619028208", "720575940614281266", "720575940613061118",
        "720575940604027168",
    ),
}


def load_neuron_ids(path: Path) -> list[str]:
    with gzip.open(path, "rt", encoding="utf-8") as f:
        return [row["root_id"] for row in csv.DictReader(f)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--annotations", type=Path, required=True)
    parser.add_argument("--neurons", type=Path, default=Path("data/neurons.csv.gz"))
    parser.add_argument("--out", type=Path, default=Path("data/neuron_sets.json"))
    args = parser.parse_args()

    known = set(load_neuron_ids(args.neurons))
    with open(args.annotations, encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f, delimiter="\t") if r["root_id"] in known]

    sets = {}
    for set_id, kind, filters, note in ANNOTATION_SETS:
        members = sorted(r["root_id"] for r in rows if all(r[c] in v for c, v in filters.items()))
        if not members:
            raise SystemExit(f"{set_id}: no neurons match {filters}")
        rule = " and ".join(f"{c} in {list(v)}" for c, v in filters.items())
        sets[set_id] = {"kind": kind, "source": ANNOTATIONS_REF, "rule": rule, "note": note, "root_ids": members}
    for set_id, ids in SHIU_SETS.items():
        members = sorted(i for i in ids if i in known)
        sets[set_id] = {"kind": "stimulus", "source": SHIU_REF, "rule": "explicit ID list",
                        "note": f"{len(members)}/{len(ids)} v630 IDs present in v783", "root_ids": members}

    args.out.write_text(json.dumps(sets, indent=1), encoding="utf-8")
    for set_id, s in sets.items():
        print(f"{set_id:18s} {s['kind']:8s} {len(s['root_ids']):4d}")


if __name__ == "__main__":
    main()
