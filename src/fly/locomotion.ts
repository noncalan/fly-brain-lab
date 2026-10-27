// Walking is driven only by descending neurons with published roles:
//   DNp09 (= P9): forward walking with ipsilateral turning (Bidaye et al. 2020, Neuron, 10.1016/j.neuron.2020.07.032)
//   MDN: backward walking (Bidaye et al. 2014, Science, 10.1126/science.1249964)
//   DNa02: steering, turning ~ right-left difference (Rayshubskiy et al. 2025, eLife, 10.7554/eLife.102230)
// The gains below are display scales (how fast the drawn fly moves per Hz), not fitted parameters.

export interface LocomotionCommand {
  /** mm/s, negative = backward */
  speed: number;
  /** rad/s, positive = turning to the fly's right */
  turnRate: number;
}

export const LOCOMOTION = {
  /** below this rate a descending neuron is treated as silent */
  minHz: 1,
  forwardMmPerHz: 0.1,
  backwardMmPerHz: 0.05,
  turnRadPerHz: 0.025,
  /** matches the fastest gait the 3D legs can draw without sliding (src/fly/gait.ts MAX_RUN_MM_S) */
  maxSpeed: 21,
  maxTurn: 3,
};

const active = (hz: number) => (hz >= LOCOMOTION.minHz ? hz : 0);
const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

export function locomotionFromRates(r: Record<string, number>): LocomotionCommand {
  const p9l = active(r.dnp09_l ?? 0);
  const p9r = active(r.dnp09_r ?? 0);
  const mdn = active(r.mdn ?? 0);
  const a2l = active(r.dna02_l ?? 0);
  const a2r = active(r.dna02_r ?? 0);
  const forward = ((p9l + p9r) / 2) * LOCOMOTION.forwardMmPerHz;
  const backward = mdn * LOCOMOTION.backwardMmPerHz;
  const turn = (p9r - p9l + (a2r - a2l)) * LOCOMOTION.turnRadPerHz;
  return { speed: clamp(forward - backward, LOCOMOTION.maxSpeed), turnRate: clamp(turn, LOCOMOTION.maxTurn) };
}

export interface FlyState {
  x: number;
  z: number;
  /** heading in radians, 0 = +x */
  heading: number;
}

/** Advance position by simulated time. The arena wall stops the fly; nothing steers it but its neurons. */
export function integrate(s: FlyState, cmd: LocomotionCommand, dtS: number, arenaRadius: number): FlyState {
  const heading = s.heading - cmd.turnRate * dtS; // right turn = clockwise seen from above
  let x = s.x + Math.cos(heading) * cmd.speed * dtS;
  let z = s.z - Math.sin(heading) * cmd.speed * dtS;
  const r = Math.hypot(x, z);
  if (r > arenaRadius) {
    x *= arenaRadius / r;
    z *= arenaRadius / r;
  }
  return { x, z, heading };
}
