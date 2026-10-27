import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { NEUROPIL_NAMES, categoryOf, neuropilBase } from '../content/regions';
import { useI18n } from '../i18n';
import type { Atlas } from '../lab/atlas';
import { loadNeuropilMeshes, type NeuropilMesh } from './meshes';

/** Activity 0..1 per neuropil name, written every simulation frame without re-rendering React. */
export type LevelsRef = MutableRefObject<Map<string, number>>;
/** Spiked neuron indices per simulation frame; the brain view drains it. */
export type SpikeQueueRef = MutableRefObject<Uint32Array[]>;

const IDLE_OPACITY = 0.12;
const POINT_DECAY = 0.88; // per animation frame
const POINT_SIZE = 2.2;

const POINT_VERTEX = `
attribute float activity;
uniform float size;
varying float vActivity;
void main() {
  vActivity = activity;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (1.0 + 2.5 * activity) * (2.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const POINT_FRAGMENT = `
uniform vec3 idle;
uniform vec3 accent;
varying float vActivity;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  float a = mix(0.10, 1.0, vActivity) * (1.0 - d * 3.0);
  gl_FragColor = vec4(mix(idle, accent, vActivity), a);
}`;

/** All neurons as points at their soma (or representative) position; a spike lights the point, then it fades. */
function NeuronPoints({ atlas, spikes, idle, accent }: { atlas: Atlas; spikes: SpikeQueueRef; idle: THREE.Color; accent: THREE.Color }) {
  const { geometry, activity } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(atlas.positions, 3));
    const act = new Float32Array(atlas.positions.length / 3);
    g.setAttribute('activity', new THREE.BufferAttribute(act, 1).setUsage(THREE.DynamicDrawUsage));
    return { geometry: g, activity: act };
  }, [atlas]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: POINT_VERTEX,
        fragmentShader: POINT_FRAGMENT,
        uniforms: { size: { value: POINT_SIZE }, idle: { value: idle }, accent: { value: accent } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [idle, accent],
  );
  useFrame(() => {
    for (let i = 0; i < activity.length; i++) if (activity[i] > 0) activity[i] = activity[i] < 0.02 ? 0 : activity[i] * POINT_DECAY;
    for (const batch of spikes.current) for (const i of batch) activity[i] = 1;
    spikes.current.length = 0;
    (geometry.getAttribute('activity') as THREE.BufferAttribute).needsUpdate = true;
  });
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);
  return <points geometry={geometry} material={material} />;
}
const ACTIVE_OPACITY = 0.85;

function Controls() {
  const { camera, gl } = useThree();
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true;
    c.enablePan = false;
    c.minDistance = 1.2;
    c.maxDistance = 5;
    let raf = 0;
    const tick = () => {
      c.update();
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      c.dispose();
    };
  }, [camera, gl]);
  return null;
}

function Region({
  mesh,
  levels,
  idleColor,
  accent,
  onHover,
}: {
  mesh: NeuropilMesh;
  levels: LevelsRef;
  idleColor: THREE.Color;
  accent: THREE.Color;
  onHover: (name: string | null) => void;
}) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [mesh]);
  const material = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: idleColor.clone(),
        emissive: new THREE.Color(0, 0, 0),
        transparent: true,
        opacity: IDLE_OPACITY,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [idleColor],
  );
  const shown = useRef(0);
  useFrame(() => {
    const target = levels.current.get(mesh.name) ?? 0;
    shown.current += (target - shown.current) * 0.2;
    const v = shown.current;
    material.color.copy(idleColor).lerp(accent, Math.min(1, v * 1.5));
    material.emissive.copy(accent).multiplyScalar(v * 0.8);
    material.opacity = IDLE_OPACITY + (ACTIVE_OPACITY - IDLE_OPACITY) * v;
  });
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);
  return (
    <mesh
      geometry={geometry}
      material={material}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(mesh.name);
      }}
      onPointerOut={() => onHover(null)}
    />
  );
}

function cssColor(varName: string): THREE.Color {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim().split(/\s+/).map(Number);
  return new THREE.Color(v[0] / 255, v[1] / 255, v[2] / 255);
}

export default function BrainView({ levels, activeCount, atlas, spikes }: { levels: LevelsRef; activeCount: number; atlas: Atlas | null; spikes: SpikeQueueRef }) {
  const { t, lang } = useI18n();
  const [meshes, setMeshes] = useState<NeuropilMesh[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [palette, setPalette] = useState(() => ({ idle: cssColor('--muted'), accent: cssColor('--accent') }));

  useEffect(() => {
    loadNeuropilMeshes(`${import.meta.env.BASE_URL}data/`).then(setMeshes, (e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    // re-read tokens when the theme class changes
    const obs = new MutationObserver(() => setPalette({ idle: cssColor('--muted'), accent: cssColor('--accent') }));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const category = hovered ? categoryOf(hovered) : undefined;
  return (
    <div className="relative h-full w-full">
      {error && <p className="p-4 text-sm text-warn">{error}</p>}
      <Canvas
        camera={{ position: [0, 0.15, 2.4], fov: 40 }}
        dpr={[1, 2]}
        aria-label={t('brain.canvasLabel', { active: activeCount })}
        role="img"
        onPointerMissed={() => setHovered(null)}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[1, 2, 3]} intensity={0.8} />
        {meshes?.map((m) => (
          <Region key={m.name} mesh={m} levels={levels} idleColor={palette.idle} accent={palette.accent} onHover={setHovered} />
        ))}
        {atlas && <NeuronPoints atlas={atlas} spikes={spikes} idle={palette.idle} accent={palette.accent} />}
        <Controls />
      </Canvas>
      {hovered && (
        <div className="pointer-events-none absolute left-2 top-2 max-w-xs rounded-lg border border-line bg-surface/95 p-3 text-sm shadow-lg">
          <p className="font-mono text-xs text-accent">{hovered}</p>
          <p className="font-medium">{NEUROPIL_NAMES[neuropilBase(hovered)] ?? hovered}</p>
          {category && (
            <p className="mt-1 text-muted">
              <span className="text-ink">{category.name[lang]}.</span> {category.role[lang]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
