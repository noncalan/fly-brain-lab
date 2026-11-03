"""Reference run of the Shiu et al. 2024 LIF model in Brian2, to check the browser engine (src/sim/engine.ts).

Written from the published equations and parameters (src/sim/params.ts lists their sources); Shiu's code is not run.
Only Shiu's data files are read: Completeness_783.csv (row order = neuron index) and Connectivity_783.parquet
(philshiu/Drosophila_brain_model@91bdd1e7). Connections with fewer than --min-synapses synapses are dropped, so the
graph matches the one the site loads (>= 5).

usage:
  uv run --no-project --with brian2==2.8.0 --with pyarrow==18.1.0 --with numpy==2.1.3 python -I \
      tools/brian2/brian2_reference.py --data <dir with Shiu's files> --sets data/neuron_sets.json \
      --out tools/brian2/results/reference.json
"""
import argparse
import json
import time

import numpy as np
import pyarrow.csv as pacsv
import pyarrow.parquet as pq
from brian2 import (
    Network, NeuronGroup, PoissonGroup, SpikeMonitor, Synapses, defaultclock, prefs, seed as brian_seed,
    Hz, ms, mV, second,
)

# Shiu et al. 2024 parameters (same values and sources as src/sim/params.ts)
V_REST = -52 * mV
V_RESET = -52 * mV
V_TH = -45 * mV
T_MBR = 20 * ms
TAU = 5 * ms
T_RFC = 2.2 * ms
T_DLY = 1.8 * ms
W_SYN = 0.275 * mV
F_POI = 250

STIMULI = ['shiu_sugar_r', 'trn_heat', 'vpn_looming', 'jo_wind_gravity', 'orn_dm1']
READOUTS = ['mn9', 'giant_fiber', 'adn1', 'abn1', 'dnp09', 'mdn', 'dna02_l', 'dna02_r']


def load_graph(data_dir, min_synapses):
    ids = pacsv.read_csv(f'{data_dir}/Completeness_783.csv').column(0).to_numpy()
    t = pq.read_table(f'{data_dir}/Connectivity_783.parquet', columns=['Presynaptic_Index', 'Postsynaptic_Index', 'Excitatory x Connectivity'])
    pre = t.column(0).to_numpy()
    post = t.column(1).to_numpy()
    w = t.column(2).to_numpy()
    keep = np.abs(w) >= min_synapses
    return ids, pre[keep], post[keep], w[keep]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--sets', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--min-synapses', type=int, default=5)
    ap.add_argument('--rate', type=float, default=150.0)
    ap.add_argument('--duration', type=float, default=1.0)
    ap.add_argument('--seeds', default='1,2')
    args = ap.parse_args()

    prefs.codegen.target = 'numpy'  # no C++ compiler needed
    defaultclock.dt = 0.1 * ms
    ids, pre, post, w = load_graph(args.data, args.min_synapses)
    n = len(ids)
    index_of = {int(r): i for i, r in enumerate(ids)}
    sets = json.load(open(args.sets, encoding='utf-8'))
    members = {k: [index_of[int(r)] for r in v['root_ids'] if int(r) in index_of] for k, v in sets.items()}
    stimulated = sorted({i for s in STIMULI for i in members[s]})

    eqs = '''
    dv/dt = (V_REST - v + g) / T_MBR : volt (unless refractory)
    dg/dt = -g / TAU : volt (unless refractory)
    rfc : second
    '''
    ns = dict(V_REST=V_REST, V_RESET=V_RESET, V_TH=V_TH, T_MBR=T_MBR, TAU=TAU)
    neu = NeuronGroup(n, eqs, threshold='v > V_TH', reset='v = V_RESET; g = 0*mV', refractory='rfc', method='linear', namespace=ns)
    syn = Synapses(neu, neu, 'w : volt', on_pre='g += w', delay=T_DLY)
    syn.connect(i=pre, j=post)
    syn.w = w * W_SYN
    # one Poisson source per neuron that any stimulus uses; rates are set per run
    poi = PoissonGroup(len(stimulated), rates=0 * Hz)
    kick = Synapses(poi, neu, on_pre='v += F_POI * W_SYN', namespace=dict(F_POI=F_POI, W_SYN=W_SYN))
    kick.connect(i=np.arange(len(stimulated)), j=np.array(stimulated))
    mon = SpikeMonitor(neu)
    net = Network(neu, syn, poi, kick, mon)
    neu.v = V_REST
    neu.g = 0 * mV
    neu.rfc = T_RFC
    net.store('rest')

    runs = []
    for stim in ['none'] + STIMULI:
        for s in [int(x) for x in args.seeds.split(',')]:
            net.restore('rest')
            brian_seed(s)
            on = set(members.get(stim, []))
            poi.rates = [args.rate * Hz if i in on else 0 * Hz for i in stimulated]
            rfc = np.full(n, float(T_RFC / second))
            rfc[list(on)] = 0.0  # stimulated neurons have no refractory period (Shiu et al.)
            neu.rfc = rfc * second
            t0 = time.time()
            net.run(args.duration * second)
            counts = np.bincount(np.asarray(mon.i), minlength=n)
            rates = {r: float(counts[members[r]].mean() / args.duration) for r in READOUTS}
            runs.append({'stimulus': stim, 'seed': s, 'ratesHz': rates, 'activeNeurons': int((counts > 0).sum()), 'totalSpikes': int(counts.sum()), 'wallS': time.time() - t0})
            print(stim, s, {k: round(v, 1) for k, v in rates.items()}, 'active', runs[-1]['activeNeurons'], f"{runs[-1]['wallS']:.0f}s", flush=True)

    json.dump(
        {'generatedBy': 'tools/brian2/brian2_reference.py', 'brian2Target': 'numpy', 'neurons': n, 'edges': int(len(pre)), 'minSynapses': args.min_synapses,
         'rateHz': args.rate, 'durationS': args.duration, 'data': 'philshiu/Drosophila_brain_model@91bdd1e7 Completeness_783.csv, Connectivity_783.parquet', 'runs': runs},
        open(args.out, 'w', encoding='utf-8'), indent=1)


if __name__ == '__main__':
    main()
