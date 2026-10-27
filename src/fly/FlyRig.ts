// Builds the NeuroMechFly body as a three.js joint hierarchy and poses it each frame.
// Frames follow MuJoCo: x anterior, y left, z up; joints rotate yaw (x), pitch (y), roll (z) in that order.
import * as THREE from 'three';
import { neutralAngles, type FlyModelData } from './flyModel';

export interface FlyPoseInput {
  /** gait phase in radians; advances with walking distance */
  gaitPhase: number;
  /** -1 backward .. 0 still .. 1 forward */
  walkDirection: number;
  /** -1 turning left .. 1 turning right */
  turn: number;
  /** 0..1 */
  proboscis: number;
  /** 0..1 */
  groom: number;
  /** 0..1 wings spread for takeoff */
  wings: number;
  timeS: number;
}

const BODY_COLOR = new THREE.Color(0.72, 0.53, 0.28);
const DARK_COLOR = new THREE.Color(0.33, 0.24, 0.15);
const EYE_COLOR = new THREE.Color(0.67, 0.21, 0.12);
const WING_COLOR = new THREE.Color(0.85, 0.87, 0.95);
const LEGS = ['lf', 'lm', 'lh', 'rf', 'rm', 'rh'] as const;
/** tripod groups: front and hind of one side with the middle leg of the other side */
const TRIPOD_A = new Set(['lf', 'rm', 'lh']);
const COXA_SWING = 0.35;
const FEMUR_LIFT = 0.45;

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
      (groups.get(b.parent ?? '') ?? this.root).add(placement);
    }
    // MuJoCo z-up -> three.js y-up
    this.root.rotation.x = -Math.PI / 2;
  }

  private set(name: string, yaw: number, pitch: number, roll: number): void {
    const j = this.joints.get(name);
    if (!j) return;
    j.group.rotation.set(j.base[0] + yaw, j.base[1] + pitch, j.base[2] + roll, 'XYZ');
  }

  pose(p: FlyPoseInput): void {
    for (const leg of LEGS) {
      const right = leg[0] === 'r';
      const front = leg[1] === 'f';
      const phase = p.gaitPhase + (TRIPOD_A.has(leg) ? 0 : Math.PI);
      const sideGain = 1 + 0.6 * p.turn * (right ? -1 : 1);
      const amp = Math.abs(p.walkDirection) * sideGain;
      const swing = COXA_SWING * amp * Math.sin(phase) * Math.sign(p.walkDirection || 1);
      const lift = FEMUR_LIFT * amp * Math.max(0, Math.cos(phase));
      // antennal grooming: front legs reach up to the head and sweep
      const g = front ? p.groom : 0;
      const sweep = g * (0.5 + 0.5 * Math.sin(p.timeS * 9));
      this.set(`${leg}_coxa`, 0, swing - g * 1.1, 0);
      this.set(`${leg}_trochanterfemur`, 0, -lift - g * 0.6 - sweep * 0.4, 0);
      this.set(`${leg}_tibia`, 0, lift * 0.6 + g * 0.5, 0);
    }
    // proboscis extension: rostrum swings down, haustellum unfolds towards the ground and laps
    // (signs checked by computing the haustellum's world position: negative rostrum pitch lowers it)
    const lap = p.proboscis * 0.12 * Math.sin(p.timeS * 8);
    this.set('c_rostrum', 0, -p.proboscis * 0.7, 0);
    this.set('c_haustellum', 0, p.proboscis * 0.9 + lap, 0);
    // wings: spread sideways and beat during takeoff
    const beat = p.wings > 0.05 ? Math.sin(p.timeS * 60) * 0.5 * p.wings : 0;
    this.set('l_wing', beat, 0, -p.wings * 1.2);
    this.set('r_wing', -beat, 0, p.wings * 1.2);
    // antennae flick while grooming
    const flick = p.groom * 0.3 * Math.sin(p.timeS * 14);
    this.set('l_pedicel', flick, 0, 0);
    this.set('r_pedicel', -flick, 0, 0);
  }
}
