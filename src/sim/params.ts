import type { ModelParams, PruningParams } from './types';

/**
 * Leaky integrate-and-fire parameters from Shiu et al. 2024 (philshiu/Drosophila_brain_model, model.py,
 * MIT License, Copyright (c) 2023 Philip Shiu and Nico Spiller). Comments give their original sources.
 */
export const SHIU_PARAMS: Readonly<ModelParams> = Object.freeze({
  dtMs: 0.1, // Brian2 default clock
  vRestMv: -52, // Kakaria & de Bivort 2017
  vThresholdMv: -45, // Kakaria & de Bivort 2017
  tauMembraneMs: 20, // Kakaria & de Bivort 2017
  tauSynapseMs: 5, // Jürgensen et al. 2021
  refractoryMs: 2.2, // Lazar et al. 2021
  delayMs: 1.8, // Paul et al. 2015
  weightPerSynapseMv: 0.275, // free parameter fitted by Shiu et al.
  poissonWeightFactor: 250, // "sufficient to cause spiking"
});

export const DEFAULT_PRUNING: Readonly<PruningParams> = Object.freeze({ minSynapses: 5, weightBits: null });
