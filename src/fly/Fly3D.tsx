import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useQuality } from '../app/quality';
import { FlyRig } from './FlyRig';
import { loadFlyModel, type FlyModelData } from './flyModel';
import { LEGS, TRIPOD_OFFSET, gaitDrive, legAnglesAt, loadGait, type GaitData, type Leg, type LegAngles } from './gait';
import { integrate, type FlyState, type LocomotionCommand } from './locomotion';

export const ARENA_RADIUS_MM = 60;
const TAKEOFF_S = 1.4;
const TAKEOFF_HEIGHT_MM = 9;
const TAKEOFF_DISTANCE_MM = 18;
/** pause between hops while the Giant Fiber stays above threshold */
const HOP_PAUSE_S = 0.6;
/** in the recorded mid-stance pose the tarsi sit ~0.12 mm above the rig origin; lower the body onto the floor */
const GROUND_OFFSET_MM = 0.12;

/** Written by the lab page on every simulation frame; read here every animation frame. */
export interface FlyDrive {
  command: LocomotionCommand;
  feeding: boolean;
  escape: boolean;
  grooming: boolean;
  /** simulated ms not yet applied to the fly's position */
  pendingSimMs: number;
  /**
   * Game mode only: the body pose is set from outside (a script, not neurons). The actor then just draws it —
   * legs step with `command`, wings beat while `y` is above the floor. The lab never sets this.
   */
  pose?: ExternalPose | null;
}

export interface ExternalPose {
  x: number;
  /** height above the floor, mm */
  y: number;
  z: number;
  heading: number;
  /** nose up, rad */
  pitch: number;
  /** right wing down, rad */
  roll: number;
}

/** Above this height (mm) an externally posed fly counts as airborne. */
export const AIRBORNE_MM = 0.3;

export interface ArenaMark {
  id: string;
  x: number;
  z: number;
  kind: 'food' | 'water' | 'bitter';
}

function token(name: string): THREE.Color {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim().split(/\s+/).map(Number);
  return new THREE.Color(v[0] / 255, v[1] / 255, v[2] / 255);
}

/** close: the camera sits near the fly and keeps it centred; wide: farther away, follows smoothly (game flights). */
export type CameraView = 'close' | 'wide';
const CAMERA_START: Record<CameraView, [number, number, number]> = { close: [5, 4.5, 6.5], wide: [12, 17, 23] };
/** fraction of the remaining offset the wide camera closes per second */
const WIDE_FOLLOW_PER_S = 2.5;

function Follow({ target, lift, view }: { target: MutableRefObject<FlyState>; lift: MutableRefObject<number>; view: CameraView }) {
  const { camera, gl } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true;
    c.enablePan = false;
    c.minDistance = 3;
    c.maxDistance = view === 'wide' ? 140 : 60;
    c.maxPolarAngle = Math.PI * 0.48;
    controls.current = c;
    return () => c.dispose();
  }, [camera, gl, view]);
  useFrame((_, dtWall) => {
    const c = controls.current;
    if (!c) return;
    const t = target.current;
    // keep the fly in view: move target and camera together so the user's orbit angle is kept
    const k = view === 'wide' ? Math.min(1, dtWall * WIDE_FOLLOW_PER_S) : 1;
    const dx = (t.x - c.target.x) * k;
    const dy = (lift.current * (view === 'wide' ? 0.6 : 0.85) - c.target.y) * k;
    const dz = (t.z - c.target.z) * k;
    c.target.x += dx;
    c.target.y += dy;
    c.target.z += dz;
    camera.position.x += dx;
    camera.position.y += dy;
    camera.position.z += dz;
    c.update();
  });
  return null;
}

function FlyActor({
  model,
  gait,
  drive,
  state,
  liftOut,
}: {
  model: FlyModelData;
  gait: GaitData;
  drive: MutableRefObject<FlyDrive>;
  state: MutableRefObject<FlyState>;
  liftOut: MutableRefObject<number>;
}) {
  const rig = useMemo(() => new FlyRig(model), [model]);
  const holder = useRef<THREE.Group>(null);
  const anim = useRef({ phase: 0, left: 0, right: 0, proboscis: 0, groom: 0, wings: 0, takeoff: -1, pause: 0, from: { x: 0, z: 0 }, to: { x: 0, z: 0 } });

  useFrame((_, dtWall) => {
    const d = drive.current;
    const a = anim.current;
    const simS = d.pendingSimMs / 1000;
    d.pendingSimMs = 0;
    const k = Math.min(1, dtWall * 6);
    const ease = (cur: number, target: number) => cur + (target - cur) * k;

    const ext = d.pose ?? null;
    // a hop starts whenever the escape behaviour (Giant Fiber above threshold) is on and the fly is on the ground
    a.pause = Math.max(0, a.pause - dtWall);
    if (!ext && d.escape && a.takeoff < 0 && a.pause === 0) {
      const s = state.current;
      a.takeoff = 0;
      a.from = { x: s.x, z: s.z };
      const r = Math.min(TAKEOFF_DISTANCE_MM, ARENA_RADIUS_MM * 0.8);
      const tx = s.x + Math.cos(s.heading) * r;
      const tz = s.z - Math.sin(s.heading) * r;
      const scale = Math.min(1, (ARENA_RADIUS_MM * 0.85) / Math.max(1e-6, Math.hypot(tx, tz)));
      a.to = { x: tx * scale, z: tz * scale };
    }

    let lift = 0;
    const flying = ext ? ext.y > AIRBORNE_MM : a.takeoff >= 0;
    const g = flying ? { frequency: 0, left: 0, right: 0 } : gaitDrive(gait, d.command.speed, d.command.turnRate);
    if (ext) {
      lift = ext.y;
      state.current = { x: ext.x, z: ext.z, heading: ext.heading };
      if (!flying) a.phase += 2 * Math.PI * g.frequency * simS;
    } else if (flying) {
      a.takeoff += dtWall / TAKEOFF_S;
      const t = Math.min(1, a.takeoff);
      lift = Math.sin(Math.PI * t) * TAKEOFF_HEIGHT_MM;
      state.current = { ...state.current, x: a.from.x + (a.to.x - a.from.x) * t, z: a.from.z + (a.to.z - a.from.z) * t };
      if (a.takeoff >= 1) {
        a.takeoff = -1;
        a.pause = HOP_PAUSE_S;
      }
    } else if (simS > 0) {
      // body and legs advance with simulated time, so slow motion slows both and feet stay planted
      state.current = integrate(state.current, d.command, simS, ARENA_RADIUS_MM);
      a.phase += 2 * Math.PI * g.frequency * simS;
    }
    a.left = ease(a.left, g.left);
    a.right = ease(a.right, g.right);

    const legs = {} as Record<Leg, LegAngles>;
    for (const leg of LEGS) legs[leg] = legAnglesAt(gait, leg, a.phase + TRIPOD_OFFSET[leg], leg[0] === 'l' ? a.left : a.right);

    a.proboscis = ease(a.proboscis, d.feeding ? 1 : 0);
    a.groom = ease(a.groom, d.grooming && !flying ? 1 : 0);
    a.wings = ease(a.wings, flying ? 1 : 0);
    rig.pose({
      legs,
      proboscis: a.proboscis,
      groom: a.groom,
      wings: a.wings,
      airborne: a.wings,
      gaitPhase: a.phase,
      stepAmplitude: (Math.abs(a.left) + Math.abs(a.right)) / 2,
      timeS: performance.now() / 1000,
    });
    const h = holder.current;
    if (h) {
      const s = state.current;
      h.position.set(s.x, lift - GROUND_OFFSET_MM, s.z);
      liftOut.current = lift;
      // forward is the rig's +x: roll turns about it, pitch about the side axis (z)
      h.rotation.set(ext ? ext.roll : 0, s.heading, ext ? ext.pitch : 0, 'YXZ');
    }
  });

  return (
    <group ref={holder}>
      <primitive object={rig.root} />
    </group>
  );
}

/** Sun that travels with the fly so its shadow stays inside the shadow camera. */
function FollowLight({ target, castShadow }: { target: MutableRefObject<FlyState>; castShadow: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const t = target.current;
    l.position.set(t.x + 10, 25, t.z + 8);
    l.target.position.set(t.x, 0, t.z);
    l.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      ref={light}
      intensity={1.6}
      castShadow={castShadow}
      shadow-mapSize={[1024, 1024]}
      shadow-camera-left={-8}
      shadow-camera-right={8}
      shadow-camera-top={8}
      shadow-camera-bottom={-8}
    />
  );
}

function Marks({ marks }: { marks: ArenaMark[] }) {
  const colors = { food: '#e8b04a', water: '#5fb4e8', bitter: '#9c6ade' } as const;
  return (
    <>
      {marks.map((m) => (
        <mesh key={m.id} position={[m.x, 0.25, m.z]} scale={[1, 0.45, 1]}>
          <sphereGeometry args={[0.9, 24, 12]} />
          <meshStandardMaterial color={colors[m.kind]} roughness={0.2} transparent opacity={0.85} />
        </mesh>
      ))}
    </>
  );
}

function Arena({ onPick }: { onPick?: (x: number, z: number) => void }) {
  const [colors, setColors] = useState(() => ({ floor: token('--surface-2'), line: token('--border') }));
  useEffect(() => {
    const obs = new MutationObserver(() => setColors({ floor: token('--surface-2'), line: token('--border') }));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onPick?.(e.point.x, e.point.z);
        }}
      >
        <circleGeometry args={[ARENA_RADIUS_MM + 2, 96]} />
        <meshStandardMaterial color={colors.floor} roughness={0.95} />
      </mesh>
      {[10, 20, 30, 40, 50, ARENA_RADIUS_MM].map((r) => (
        <mesh key={r} rotation-x={-Math.PI / 2} position-y={0.01}>
          <ringGeometry args={[r - 0.08, r + 0.08, 128]} />
          <meshBasicMaterial color={colors.line} />
        </mesh>
      ))}
    </group>
  );
}

export interface Fly3DProps {
  drive: MutableRefObject<FlyDrive>;
  state: MutableRefObject<FlyState>;
  marks: ArenaMark[];
  label: string;
  onArenaClick?: (x: number, z: number) => void;
  onFlyClick?: (part: 'head' | 'body') => void;
  onModelError?: (message: string) => void;
  view?: CameraView;
}

export default function Fly3D({ drive, state, marks, label, onArenaClick, onFlyClick, onModelError, view = 'close' }: Fly3DProps) {
  const [model, setModel] = useState<FlyModelData | null>(null);
  const [gait, setGait] = useState<GaitData | null>(null);
  const lift = useRef(0);
  const quality = useQuality();
  useEffect(() => {
    const base = `${import.meta.env.BASE_URL}data/`;
    loadFlyModel(base).then(setModel, (e: Error) => onModelError?.(e.message));
    loadGait(base).then(setGait, (e: Error) => onModelError?.(e.message));
  }, [onModelError]);
  return (
    <Canvas shadows camera={{ position: CAMERA_START[view], fov: 35, near: 0.1, far: 500 }} dpr={quality.dpr} role="img" aria-label={label} gl={{ preserveDrawingBuffer: true }} data-testid="fly-canvas">
      <ambientLight intensity={0.7} />
      <FollowLight target={state} castShadow={quality.shadows} />
      <Arena onPick={onArenaClick} />
      <Marks marks={marks} />
      {model && gait && (
        <group
          onClick={(e) => {
            e.stopPropagation();
            // the head is in front of the thorax: compare the hit point with the fly's heading
            const s = state.current;
            const along = (e.point.x - s.x) * Math.cos(s.heading) - (e.point.z - s.z) * Math.sin(s.heading);
            onFlyClick?.(along > 0.35 ? 'head' : 'body');
          }}
        >
          <FlyActor model={model} gait={gait} drive={drive} state={state} liftOut={lift} />
        </group>
      )}
      <Follow target={state} lift={lift} view={view} />
    </Canvas>
  );
}
