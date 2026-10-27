import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FlyRig } from './FlyRig';
import { loadFlyModel, type FlyModelData } from './flyModel';
import { integrate, type FlyState, type LocomotionCommand } from './locomotion';

export const ARENA_RADIUS_MM = 60;
const TAKEOFF_S = 1.4;
const TAKEOFF_HEIGHT_MM = 9;
const TAKEOFF_DISTANCE_MM = 18;
/** a full gait cycle covers about this much ground */
const STRIDE_MM = 1.6;
/** pause between hops while the Giant Fiber stays above threshold */
const HOP_PAUSE_S = 0.6;

/** Written by the lab page on every simulation frame; read here every animation frame. */
export interface FlyDrive {
  command: LocomotionCommand;
  feeding: boolean;
  escape: boolean;
  grooming: boolean;
  /** simulated ms not yet applied to the fly's position */
  pendingSimMs: number;
}

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

function Follow({ target, lift }: { target: MutableRefObject<FlyState>; lift: MutableRefObject<number> }) {
  const { camera, gl } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true;
    c.enablePan = false;
    c.minDistance = 3;
    c.maxDistance = 60;
    c.maxPolarAngle = Math.PI * 0.48;
    controls.current = c;
    return () => c.dispose();
  }, [camera, gl]);
  useFrame(() => {
    const c = controls.current;
    if (!c) return;
    const t = target.current;
    // keep the fly centred: move target and camera together so the user's orbit angle is kept
    const dx = t.x - c.target.x;
    const dy = lift.current * 0.85 - c.target.y;
    const dz = t.z - c.target.z;
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

function FlyActor({ model, drive, state, liftOut }: { model: FlyModelData; drive: MutableRefObject<FlyDrive>; state: MutableRefObject<FlyState>; liftOut: MutableRefObject<number> }) {
  const rig = useMemo(() => new FlyRig(model), [model]);
  const holder = useRef<THREE.Group>(null);
  const anim = useRef({ phase: 0, proboscis: 0, groom: 0, wings: 0, takeoff: -1, pause: 0, from: { x: 0, z: 0 }, to: { x: 0, z: 0 } });

  useFrame((_, dtWall) => {
    const d = drive.current;
    const a = anim.current;
    const simS = d.pendingSimMs / 1000;
    d.pendingSimMs = 0;
    const ease = (cur: number, target: number) => cur + (target - cur) * Math.min(1, dtWall * 6);

    // a hop starts whenever the escape behaviour (Giant Fiber above threshold) is on and the fly is on the ground
    a.pause = Math.max(0, a.pause - dtWall);
    if (d.escape && a.takeoff < 0 && a.pause === 0) {
      const s = state.current;
      a.takeoff = 0;
      a.from = { x: s.x, z: s.z };
      const r = Math.min(TAKEOFF_DISTANCE_MM, ARENA_RADIUS_MM * 0.8);
      const tx = s.x + Math.cos(s.heading) * r;
      const tz = s.z - Math.sin(s.heading) * r;
      const k = Math.min(1, (ARENA_RADIUS_MM * 0.85) / Math.max(1e-6, Math.hypot(tx, tz)));
      a.to = { x: tx * k, z: tz * k };
    }

    let lift = 0;
    if (a.takeoff >= 0) {
      a.takeoff += dtWall / TAKEOFF_S;
      const t = Math.min(1, a.takeoff);
      lift = Math.sin(Math.PI * t) * TAKEOFF_HEIGHT_MM;
      state.current = { ...state.current, x: a.from.x + (a.to.x - a.from.x) * t, z: a.from.z + (a.to.z - a.from.z) * t };
      if (a.takeoff >= 1) {
        a.takeoff = -1;
        a.pause = HOP_PAUSE_S;
      }
    } else if (simS > 0) {
      state.current = integrate(state.current, d.command, simS, ARENA_RADIUS_MM);
      a.phase += ((2 * Math.PI * Math.abs(d.command.speed)) / STRIDE_MM) * simS + Math.abs(d.command.turnRate) * simS * 2;
    }

    a.proboscis = ease(a.proboscis, d.feeding ? 1 : 0);
    a.groom = ease(a.groom, d.grooming ? 1 : 0);
    a.wings = ease(a.wings, a.takeoff >= 0 ? 1 : 0);
    const moving = Math.abs(d.command.speed) > 0.05 || Math.abs(d.command.turnRate) > 0.05;
    rig.pose({
      gaitPhase: a.phase,
      walkDirection: a.takeoff >= 0 || !moving ? 0 : d.command.speed !== 0 ? Math.sign(d.command.speed) : 0.6,
      turn: Math.max(-1, Math.min(1, d.command.turnRate)),
      proboscis: a.proboscis,
      groom: a.groom,
      wings: a.wings,
      timeS: performance.now() / 1000,
    });
    const h = holder.current;
    if (h) {
      const s = state.current;
      h.position.set(s.x, lift, s.z);
      liftOut.current = lift;
      h.rotation.y = s.heading;
    }
  });

  return (
    <group ref={holder}>
      <primitive object={rig.root} />
    </group>
  );
}

/** Sun that travels with the fly so its shadow stays inside the shadow camera. */
function FollowLight({ target }: { target: MutableRefObject<FlyState> }) {
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
      castShadow
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
}

export default function Fly3D({ drive, state, marks, label, onArenaClick, onFlyClick, onModelError }: Fly3DProps) {
  const [model, setModel] = useState<FlyModelData | null>(null);
  const lift = useRef(0);
  useEffect(() => {
    loadFlyModel(`${import.meta.env.BASE_URL}data/`).then(setModel, (e: Error) => onModelError?.(e.message));
  }, [onModelError]);
  return (
    <Canvas shadows camera={{ position: [5, 4.5, 6.5], fov: 35, near: 0.1, far: 500 }} dpr={[1, 2]} role="img" aria-label={label}>
      <ambientLight intensity={0.7} />
      <FollowLight target={state} />
      <Arena onPick={onArenaClick} />
      <Marks marks={marks} />
      {model && (
        <group
          onClick={(e) => {
            e.stopPropagation();
            // the head is in front of the thorax: compare the hit point with the fly's heading
            const s = state.current;
            const along = (e.point.x - s.x) * Math.cos(s.heading) - (e.point.z - s.z) * Math.sin(s.heading);
            onFlyClick?.(along > 0.35 ? 'head' : 'body');
          }}
        >
          <FlyActor model={model} drive={drive} state={state} liftOut={lift} />
        </group>
      )}
      <Follow target={state} lift={lift} />
    </Canvas>
  );
}
