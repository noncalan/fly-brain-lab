// Probe: does each stimulus set drive each readout set, in (a) the flybrain fork LIF
// and (b) a JS port of the Shiu et al. LIF (parameters from philshiu/Drosophila_brain_model, MIT).
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const here = __dirname;
const FORK = 'C:/Users/53/Desktop/fly-brain-lab';
const sets = JSON.parse(fs.readFileSync(path.join(here, 'sets_idx.json'))); // indices in fork (neurons.csv) order

// ---------- fork model ----------
function loadFork() {
  const buf = zlib.gunzipSync(fs.readFileSync(FORK + '/data/connectome.bin.gz'));
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const N = v.getUint32(0, true), E = v.getUint32(4, true);
  const rowPtr = new Uint32Array(N + 1), col = new Uint32Array(E), w = new Float32Array(E);
  let maxW = 0;
  for (let e = 0; e < E; e++) rowPtr[v.getUint32(8 + e * 12, true) + 1]++;
  for (let i = 1; i <= N; i++) rowPtr[i] += rowPtr[i - 1];
  for (let e = 0; e < E; e++) {
    col[e] = v.getUint32(8 + e * 12 + 4, true);
    w[e] = v.getFloat32(8 + e * 12 + 8, true);
    maxW = Math.max(maxW, Math.abs(w[e]));
  }
  for (let e = 0; e < E; e++) w[e] = (w[e] / maxW) * 0.15;
  return { N, rowPtr, col, w };
}

function runFork(m, stimIdx, ticks) {
  const { N, rowPtr, col, w } = m;
  const V = new Float32Array(N), fired = new Uint8Array(N), refr = new Uint8Array(N);
  const count = new Uint32Array(N);
  for (let t = 0; t < ticks; t++) {
    for (let i = 0; i < N; i++) { if (refr[i] > 0) { refr[i]--; V[i] = 0; } else V[i] *= 0.95; }
    for (const i of stimIdx) if (refr[i] === 0) V[i] += 0.15;
    for (let i = 0; i < N; i++) if (fired[i]) for (let j = rowPtr[i]; j < rowPtr[i + 1]; j++) V[col[j]] += w[j];
    for (let i = 0; i < N; i++) {
      fired[i] = 0;
      if (refr[i] === 0 && V[i] >= 1.0) { fired[i] = 1; V[i] = 0; refr[i] = 3; count[i]++; }
    }
  }
  return count;
}

// ---------- Shiu model ----------
function loadShiu() {
  const buf = fs.readFileSync(path.join(here, 'shiu783.bin'));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const h = new Uint32Array(ab, 0, 2);
  const N = h[0], E = h[1];
  const pre = new Uint32Array(ab, 8, E);
  const post = new Uint32Array(ab, 8 + 4 * E, E);
  const w = new Float32Array(ab, 8 + 8 * E, E);
  const rowPtr = new Uint32Array(N + 1);
  for (let e = 0; e < E; e++) rowPtr[pre[e] + 1]++;
  for (let i = 1; i <= N; i++) rowPtr[i] += rowPtr[i - 1];
  const ids = JSON.parse(fs.readFileSync(path.join(here, 'shiu783_ids.json')));
  return { N, rowPtr, col: post, w, ids };
}

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function runShiu(m, stimIdx, rateHz, tMs, seed) {
  const dt = 0.1, tMbr = 20, tau = 5, v0 = -52, vth = -45, wSyn = 0.275, fPoi = 250;
  const delaySteps = 18, refrSteps = 22, steps = Math.round(tMs / dt);
  const { N, rowPtr, col, w } = m;
  const v = new Float32Array(N).fill(v0), g = new Float32Array(N), refr = new Uint16Array(N);
  const count = new Uint32Array(N);
  const ring = Array.from({ length: delaySteps + 1 }, () => []);
  const isStim = new Uint8Array(N); for (const i of stimIdx) isStim[i] = 1;
  const rnd = mulberry32(seed), pSpike = rateHz * dt / 1000;
  const decM = dt / tMbr, decG = Math.exp(-dt / tau);
  for (let s = 0; s < steps; s++) {
    const slot = ring[s % ring.length];
    for (const i of slot) for (let j = rowPtr[i]; j < rowPtr[i + 1]; j++) if (refr[col[j]] === 0) g[col[j]] += w[j] * wSyn;
    slot.length = 0;
    for (const i of stimIdx) if (rnd() < pSpike) v[i] += wSyn * fPoi;
    const out = ring[(s + delaySteps) % ring.length];
    for (let i = 0; i < N; i++) {
      if (refr[i] > 0) { refr[i]--; continue; }
      v[i] += (v0 - v[i] + g[i]) * decM;
      g[i] *= decG;
      if (v[i] > vth) { v[i] = v0; g[i] = 0; refr[i] = isStim[i] ? 0 : refrSteps; count[i]++; out.push(i); }
    }
  }
  return count;
}

// ---------- run ----------
const forkOrder = zlib.gunzipSync(fs.readFileSync(FORK + '/data/neurons.csv.gz')).toString().split('\n').slice(1).map(l => l.split(',')[0]).filter(Boolean);
const mode = process.argv[2] || 'both';
const results = {};
if (mode !== 'shiu') {
  const fm = loadFork();
  results.fork = {};
  for (const [s, idx] of Object.entries(sets.stim)) {
    const c = runFork(fm, idx, 100); // 100 ticks = 10 s wall-clock at the fork's 10 Hz tick rate
    results.fork[s] = Object.fromEntries(Object.entries(sets.read).map(([r, ri]) => [r, ri.reduce((a, i) => a + c[i], 0) / ri.length / 10]));
    results.fork[s]._activeNeurons = c.reduce((a, x) => a + (x > 0), 0);
  }
}
if (mode !== 'fork') {
  const sm = loadShiu();
  const map = new Map(sm.ids.map((id, i) => [id, i]));
  const toShiu = idx => idx.map(i => map.get(forkOrder[i])).filter(i => i !== undefined);
  results.shiu = {};
  for (const [s, idx] of Object.entries(sets.stim)) {
    const si = toShiu(idx), trials = 3, tMs = 1000;
    const acc = {};
    let active = 0;
    for (let t = 0; t < trials; t++) {
      const c = runShiu(sm, si, 150, tMs, 1 + t);
      for (const [r, ri] of Object.entries(sets.read)) {
        const rs = toShiu(ri);
        acc[r] = (acc[r] || 0) + rs.reduce((a, i) => a + c[i], 0) / rs.length / trials / (tMs / 1000);
      }
      active += c.reduce((a, x) => a + (x > 0), 0) / trials;
    }
    acc._activeNeurons = Math.round(active);
    results.shiu[s] = acc;
    console.error('shiu done', s);
  }
}
fs.writeFileSync(path.join(here, `probe_${mode}.json`), JSON.stringify(results, null, 1));
for (const [model, res] of Object.entries(results)) {
  console.log('\n=== ' + model + ' (mean Hz per readout neuron)');
  const reads = Object.keys(sets.read);
  console.log('stim'.padEnd(10) + reads.map(r => r.padStart(7)).join('') + '  active');
  for (const [s, row] of Object.entries(res)) console.log(s.padEnd(10) + reads.map(r => row[r].toFixed(1).padStart(7)).join('') + '  ' + row._activeNeurons);
}
