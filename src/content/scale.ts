// Numbers on the Scale page. Every value was read in the cited source (DOI opened, sentence or table checked);
// the model sizes come from tools/calibrate/results/compression.json.

export interface Source {
  cite: string;
  doi: string;
  /** where in the source the number is */
  where: string;
}

export interface BrainCount {
  id: 'fly' | 'mouse' | 'human';
  neurons: number;
  /** ± as reported (SD), or null */
  spread: number | null;
  source: Source;
}

export const BRAINS: BrainCount[] = [
  {
    id: 'fly',
    neurons: 139_255,
    spread: null,
    source: { cite: 'Dorkenwald et al., Nature 2024', doi: '10.1038/s41586-024-07558-y', where: 'abstract' },
  },
  {
    id: 'mouse',
    neurons: 70.89e6,
    spread: 10.41e6,
    source: { cite: 'Herculano-Houzel, Mota & Lent, PNAS 2006', doi: '10.1073/pnas.0604911103', where: 'Table 1, mean ± SD' },
  },
  {
    id: 'human',
    neurons: 86.1e9,
    spread: 8.1e9,
    source: { cite: 'Azevedo et al., J. Comp. Neurol. 2009', doi: '10.1002/cne.21974', where: 'abstract, adult male brain' },
  },
];

export interface Dataset {
  id: 'fafb' | 'flywire' | 'microns' | 'h01' | 'model' | 'modelMerged';
  /** bytes, when the source gives a size */
  bytes: number | null;
  cells: number | null;
  synapses: number | null;
  /** how the source states each number: about (≈) or more than (>); missing = as stated */
  qualifier: Partial<Record<'bytes' | 'cells' | 'synapses', '≈' | '>'>>;
  source: Source;
}

export const DATASETS: Dataset[] = [
  {
    id: 'fafb',
    bytes: 106e12,
    cells: null,
    synapses: null,
    qualifier: { bytes: '≈' },
    source: { cite: 'Zheng et al., Cell 2018', doi: '10.1016/j.cell.2018.06.019', where: 'Results: "∼106 TB dataset comprising ∼21 million camera images"' },
  },
  {
    id: 'flywire',
    bytes: null,
    cells: 139_255,
    synapses: 5e7,
    qualifier: { synapses: '≈' },
    source: { cite: 'Dorkenwald et al., Nature 2024', doi: '10.1038/s41586-024-07558-y', where: 'abstract' },
  },
  {
    id: 'microns',
    bytes: null,
    cells: 200_000,
    synapses: 0.5e9,
    qualifier: { cells: '>' },
    source: { cite: 'MICrONS Consortium, Nature 2025', doi: '10.1038/s41586-025-08790-w', where: 'abstract: "more than 200,000 cells and 0.5 billion synapses"' },
  },
  {
    id: 'h01',
    bytes: 1.4e15,
    cells: 57_000,
    synapses: 150e6,
    qualifier: { cells: '≈', synapses: '≈' },
    source: { cite: 'Shapson-Coe et al., Science 2024', doi: '10.1126/science.adk4858', where: 'abstract' },
  },
  {
    id: 'model',
    bytes: 10_847_442,
    cells: 139_255,
    synapses: null,
    qualifier: {},
    source: { cite: '', doi: '', where: 'tools/calibrate/results/compression.json (≥5 synapses, exact weights)' },
  },
  {
    id: 'modelMerged',
    bytes: 1_821_454,
    cells: 19_065,
    synapses: null,
    qualifier: {},
    source: { cite: '', doi: '', where: 'tools/calibrate/results/compression.json (merged types, 4 bits)' },
  },
];
