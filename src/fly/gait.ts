// Leg kinematics from a recorded fly step (public/data/gait.json, NeuroMechFly preprogrammed steps, Apache-2.0),
// played back as a tripod gait in the spirit of NeuroMechFly's CPG controller: each leg follows the recorded joint
// trajectory at its own phase; speed changes step frequency and amplitude, turning makes the two sides unequal.

export const LEGS = ['lf', 'lm', 'lh', 'rf', 'rm', 'rh'] as const;
export type Leg = (typeof LEGS)[number];
export const DOFS = ['coxa_pitch', 'coxa_roll', 'coxa_yaw', 'femur_pitch', 'femur_roll', 'tibia_pitch', 'tarsus_pitch'] as const;
export type LegAngles = Record<(typeof DOFS)[number], number>;

export interface GaitData {
  step_frequency_hz: number;
  legs: Record<Leg, Record<(typeof DOFS)[number], number[]> & { swing_end_phase: number }>;
}

/** Tripod: front and hind legs of one side move with the middle leg of the other side (NeuroMechFly CPG biases). */
export const TRIPOD_OFFSET: Record<Leg, number> = { lf: 0, lm: Math.PI, lh: 0, rf: Math.PI, rm: 0, rh: Math.PI };
/** Ground covered per step at full amplitude, measured from the recorded stance on this rig (feet x-range ≈ 1 mm). */
export const STRIDE_MM = 1.0;
/** Fastest stepping we draw; real flies step up to roughly this rate when running. */
export const MAX_STEP_HZ = 16;
/** Longer strides allowed when running. */
export const MAX_AMPLITUDE = 1.35;
/** Top running speed the legs can carry without sliding. */
export const MAX_RUN_MM_S = STRIDE_MM * MAX_AMPLITUDE * MAX_STEP_HZ;
const TURN_ASYMMETRY = 0.55;
/** Turning in place: step rate per rad/s of turning. */
const TURN_STEP_HZ = 4;

const TWO_PI = Math.PI * 2;

/** Periodic Catmull-Rom interpolation of a closed sample loop at phase in [0, 2π). */
export function samplePeriodic(values: number[], phase: number): number {
  const n = values.length;
  const x = ((((phase % TWO_PI) + TWO_PI) % TWO_PI) / TWO_PI) * n;
  const i = Math.floor(x);
  const t = x - i;
  const p0 = values[(i - 1 + n) % n];
  const p1 = values[i % n];
  const p2 = values[(i + 1) % n];
  const p3 = values[(i + 2) % n];
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export function legAnglesAt(gait: GaitData, leg: Leg, phase: number, magnitude: number): LegAngles {
  const out = {} as LegAngles;
  for (const dof of DOFS) {
    const series = gait.legs[leg][dof];
    const neutral = samplePeriodic(series, Math.PI);
    out[dof] = neutral + magnitude * (samplePeriodic(series, phase) - neutral);
  }
  return out;
}

/** True while the leg is in swing (off the ground). */
export function inSwing(gait: GaitData, leg: Leg, phase: number): boolean {
  const p = (((phase + TRIPOD_OFFSET[leg]) % TWO_PI) + TWO_PI) % TWO_PI;
  return p < gait.legs[leg].swing_end_phase;
}

export interface GaitDrive {
  /** step frequency in Hz (0 = standing) */
  frequency: number;
  /** signed amplitude per side; negative = legs push the other way (backward walking, turning in place) */
  left: number;
  right: number;
}

/**
 * Choose step frequency and per-side amplitude so the feet cover the ground the body travels (no foot sliding):
 * speed = STRIDE_MM × amplitude × frequency. Slow walking shortens the stride, running raises frequency and stride.
 */
export function gaitDrive(gait: GaitData, speedMmS: number, turnRadS: number): GaitDrive {
  const f0 = gait.step_frequency_hz;
  const v = Math.abs(speedMmS);
  const dir = Math.sign(speedMmS);
  if (v < 0.05) {
    if (Math.abs(turnRadS) < 0.05) return { frequency: 0, left: 0, right: 0 };
    const a = Math.min(0.6, Math.abs(turnRadS) * 0.3) * Math.sign(turnRadS);
    return { frequency: Math.min(f0, Math.abs(turnRadS) * TURN_STEP_HZ), left: a, right: -a };
  }
  const v0 = STRIDE_MM * f0;
  let amplitude: number;
  let frequency: number;
  if (v <= v0) {
    amplitude = Math.max(0.35, Math.sqrt(v / v0));
    frequency = v / (STRIDE_MM * amplitude);
  } else {
    frequency = Math.min(MAX_STEP_HZ, f0 * Math.sqrt(v / v0));
    amplitude = Math.min(MAX_AMPLITUDE, v / (STRIDE_MM * frequency));
    frequency = Math.min(MAX_STEP_HZ, v / (STRIDE_MM * amplitude));
  }
  const turn = Math.max(-1, Math.min(1, turnRadS)) * TURN_ASYMMETRY;
  return { frequency, left: dir * amplitude * (1 + turn), right: dir * amplitude * (1 - turn) };
}

export async function loadGait(baseUrl: string): Promise<GaitData> {
  const res = await fetch(`${baseUrl}gait.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status} loading gait.json`);
  return (await res.json()) as GaitData;
}
