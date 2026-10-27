// Builds the NeuroMechFly body as a three.js joint hierarchy and poses it each frame.
// Frames follow MuJoCo: x anterior, y left, z up; joints rotate yaw (x), pitch (y), roll (z) in that order.
import * as THREE from 'three';
import { neutralAngles, type FlyModelData } from './flyModel';
import { LEGS, type Leg, type LegAngles } from './gait';

export interface FlyPoseInput {
  /** absolute joint angles per leg from the recorded gait (radians) */
  legs: Record<Leg, LegAngles>;
  /** 0..1 */
  proboscis: number;
  /** 0..1 */
  groom: number;
  /** 0..1 wings spread for takeoff */
  wings: number;
  /** 0..1 legs tucked for flight */
  airborne: number;
  /** gait phase, for body bob */
  gaitPhase: number;
  /** current step amplitude, for body bob */
  stepAmplitude: number;
  timeS: number;
}

const BODY_COLOR = new THREE.Color(0.72, 0.53, 0.28);
const DARK_COLOR = new THREE.Color(0.33, 0.24, 0.15);
const EYE_COLOR = new THREE.Color(0.67, 0.21, 0.12);
const WING_COLOR = new THREE.Color(0.85, 0.87, 0.95);
/** antennal grooming: front-leg offsets that bring the tarsi to the head (checked by computing tarsus positions) */
const GROOM = { coxa_pitch: -1.1, femur_pitch: -0.6, tibia_pitch: 0.5 };
/** flight: legs hang below the body */
const TUCK = { coxa_pitch: 0.35, femur_pitch: 0.5, tibia_pitch: -0.6 };
const BOB_MM = 0.035;

function materialFor(name: string): THREE.Material {
  if (name.endsWith('_wing')) {
    return new THREE.MeshStandardMaterial({ color: WING_COLOR, transparent: true, opacity: 0.35, side: THREE.DoubleSide, roughness: 0.3, depthWrite: false });
  }
  if (name.endsWith('_eye')) return new THREE.MeshStandardMaterial({ color: EYE_COLOR, roughness: 0.45 });
  if (/(tarsus|tibia|arista|haustellum)/.test(name)) return new THREE.MeshStandardMaterial({ color: DARK_COLOR, roughness: 0.7 });
  return new THREE.MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.6 });
}

interface Joint {
  group: THREE.Group;
  base: [number, number, number];
}

export class FlyRig {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly joints = new Map<string, Joint>();

  constructor(data: FlyModelData) {
    const groups = new Map<string, THREE.Group>();
    // two groups per body: the fixed placement from the rig, and a child that carries the joint rotation
    for (const b of data.bodies) {
      const placement = new THREE.Group();
      placement.position.set(...b.pos);
      placement.quaternion.set(b.quat[1], b.quat[2], b.quat[3], b.quat[0]);
      const joint = new THREE.Group();
      joint.name = b.name;
      placement.add(joint);
      if (b.mesh) {
        const geom = (b.mirror ? data.mirroredGeometries : data.geometries).get(b.mesh);
        if (geom) {
          const mesh = new THREE.Mesh(geom, materialFor(b.mesh));
          mesh.castShadow = true;
          joint.add(mesh);
        }
      }
      groups.set(b.name, joint);
      this.joints.set(b.name, { group: joint, base: neutralAngles(data, b.name) });
      (groups.get(b.parent ?? '') ?? this.body).add(placement);
    }
    // MuJoCo z-up -> three.js y-up; the body group carries the gait bob
    this.root.add(this.body);
    this.root.rotation.x = -Math.PI / 2;
  }

  private set(name: string, yaw: number, pitch: number, roll: number): void {
    const j = this.joints.get(name);
    if (!j) return;
    j.group.rotation.set(j.base[0] + yaw, j.base[1] + pitch, j.base[2] + roll, 'XYZ');
  }

  private setAbsolute(name: string, yaw: number, pitch: number, roll: number): void {
    this.joints.get(name)?.group.rotation.set(yaw, pitch, roll, 'XYZ');
  }

  pose(p: FlyPoseInput): void {
    for (const leg of LEGS) {
      const a = p.legs[leg];
      const g = leg[1] === 'f' ? p.groom : 0;
      const sweep = g * 0.4 * (0.5 + 0.5 * Math.sin(p.timeS * 9));
      const air = p.airborne;
      const coxa = a.coxa_pitch + g * GROOM.coxa_pitch + air * TUCK.coxa_pitch;
      const femur = a.femur_pitch + g * GROOM.femur_pitch - sweep + air * TUCK.femur_pitch;
      const tibia = a.tibia_pitch + g * GROOM.tibia_pitch + air * TUCK.tibia_pitch;
      this.setAbsolute(`${leg}_coxa`, a.coxa_yaw, coxa, a.coxa_roll);
      this.setAbsolute(`${leg}_trochanterfemur`, 0, femur, a.femur_roll);
      this.setAbsolute(`${leg}_tibia`, 0, tibia, 0);
      this.setAbsolute(`${leg}_tarsus1`, 0, a.tarsus_pitch, 0);
    }
    // body rises slightly twice per step (each tripod push-off) and rolls a little side to side
    const amp = Math.min(1, Math.abs(p.stepAmplitude));
    this.body.position.z = BOB_MM * amp * Math.cos(2 * p.gaitPhase);
    this.body.rotation.x = 0.03 * amp * Math.sin(p.gaitPhase);
    // proboscis extension: rostrum swings down, haustellum unfolds towards the ground and laps
    // (signs checked by computing the haustellum's world position: negative rostrum pitch lowers it)
    const lap = p.proboscis * 0.12 * Math.sin(p.timeS * 8);
    this.set('c_rostrum', 0, -p.proboscis * 0.7, 0);
    this.set('c_haustellum', 0, p.proboscis * 0.9 + lap, 0);
    // wings: spread sideways and beat during takeoff (z spreads, x beats; checked by wing positions)
    const beat = p.wings > 0.05 ? Math.sin(p.timeS * 60) * 0.5 * p.wings : 0;
    this.set('l_wing', beat, 0, -p.wings * 1.2);
    this.set('r_wing', -beat, 0, p.wings * 1.2);
    // antennae flick while grooming
    const flick = p.groom * 0.3 * Math.sin(p.timeS * 14);
    this.set('l_pedicel', flick, 0, 0);
    this.set('r_pedicel', -flick, 0, 0);
  }
}
