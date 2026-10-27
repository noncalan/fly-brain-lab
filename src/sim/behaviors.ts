import type { ActivitySnapshot } from './types';

export interface BehaviorRule {
  id: string;
  readout: string;
  thresholdHz: number;
  windowMs: number;
}

export interface BehaviorState {
  id: string;
  rateHz: number;
  active: boolean;
}

interface Sample {
  windowMs: number;
  /** rate × duration, so samples of different length average correctly */
  rateMs: number;
}

/**
 * Turns activity snapshots into behaviour on/off states. A behaviour is on only while the readout set's mean rate
 * over the last `windowMs` of simulated time exceeds its threshold — no scripted triggers.
 */
export class BehaviorMonitor {
  private readonly rules: BehaviorRule[];
  private readonly history = new Map<string, Sample[]>();

  constructor(rules: BehaviorRule[]) {
    for (const r of rules) {
      if (!(r.thresholdHz > 0) || !(r.windowMs > 0)) throw new Error(`Invalid behaviour rule ${r.id}`);
    }
    this.rules = rules;
    for (const r of rules) this.history.set(r.id, []);
  }

  push(snapshot: ActivitySnapshot): BehaviorState[] {
    return this.rules.map((rule) => {
      const samples = this.history.get(rule.id)!;
      if (snapshot.windowMs > 0) {
        samples.push({ windowMs: snapshot.windowMs, rateMs: (snapshot.setRatesHz[rule.readout] ?? 0) * snapshot.windowMs });
      }
      let total = samples.reduce((s, x) => s + x.windowMs, 0);
      while (samples.length > 1 && total - samples[0].windowMs >= rule.windowMs) total -= samples.shift()!.windowMs;
      const rateHz = total > 0 ? samples.reduce((s, x) => s + x.rateMs, 0) / total : 0;
      // Do not decide before a full window of simulated time has passed.
      return { id: rule.id, rateHz, active: total >= rule.windowMs && rateHz > rule.thresholdHz };
    });
  }

  reset(): void {
    for (const samples of this.history.values()) samples.length = 0;
  }
}
