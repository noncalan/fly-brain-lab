// Loader for public/data/fly.<hash>.bin.gz (tools/build-data/build_fly.py): NeuroMechFly v2 body, Apache-2.0.
import * as THREE from 'three';

export interface FlyBody {
  name: string;
  parent: string | null;
  pos: [number, number, number];
  quat: [number, number, number, number]; // w, x, y, z (MuJoCo order)
  mesh: string | null;
  mirror: boolean;
}

export interface FlyModelData {
  bodies: FlyBody[];
  /** joint name (child segment) -> [yaw, pitch, roll] degrees, left side */
  neutral: Record<string, [number, number, number]>;
  geometries: Map<string, THREE.BufferGeometry>;
  mirroredGeometries: Map<string, THREE.BufferGeometry>;
}

interface Header {
  meshes: Array<{ name: string; vertexOffset: number; vertexCount: number; indexOffset: number; indexCount: number }>;
  scale: number;
  bodies: FlyBody[];
  neutral: Record<string, [number, number, number]>;
}

async function gunzipIfNeeded(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const b = new Uint8Array(buf, 0, 2);
  if (b[0] !== 0x1f || b[1] !== 0x8b) return buf;
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

function geometry(positions: Float32Array, indices: Uint16Array, mirror: boolean): THREE.BufferGeometry {
  const pos = positions.slice();
  const idx = new Uint16Array(indices);
  if (mirror) {
    // reflect across the sagittal plane and restore the winding order
    for (let i = 1; i < pos.length; i += 3) pos[i] = -pos[i];
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

export function parseFlyModel(buf: ArrayBuffer): FlyModelData {
  const view = new DataView(buf);
  const jsonLen = view.getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, jsonLen))) as Header;
  const totalVerts = header.meshes.reduce((s, m) => s + m.vertexCount, 0);
  const posStart = 4 + jsonLen;
  const q = new Int16Array(buf.slice(posStart, posStart + totalVerts * 6));
  const idxStart = posStart + Math.ceil((totalVerts * 6) / 4) * 4;
  const idx = new Uint16Array(buf.slice(idxStart));
  const geometries = new Map<string, THREE.BufferGeometry>();
  const mirroredGeometries = new Map<string, THREE.BufferGeometry>();
  for (const m of header.meshes) {
    const positions = new Float32Array(m.vertexCount * 3);
    for (let i = 0; i < positions.length; i++) positions[i] = q[m.vertexOffset * 3 + i] * header.scale;
    const indices = idx.subarray(m.indexOffset, m.indexOffset + m.indexCount);
    geometries.set(m.name, geometry(positions, indices, false));
    mirroredGeometries.set(m.name, geometry(positions, indices, true));
  }
  return { bodies: header.bodies, neutral: header.neutral, geometries, mirroredGeometries };
}

export async function loadFlyModel(baseUrl: string): Promise<FlyModelData> {
  const manifest = await fetch(`${baseUrl}fly.json`);
  if (!manifest.ok) throw new Error(`HTTP ${manifest.status} loading fly.json`);
  const { file } = (await manifest.json()) as { file: string };
  const res = await fetch(`${baseUrl}${file}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${file}`);
  return parseFlyModel(await gunzipIfNeeded(await res.arrayBuffer()));
}

/** Neutral joint angles in radians for any segment; right side mirrors the left (yaw and roll change sign). */
export function neutralAngles(data: FlyModelData, segment: string): [number, number, number] {
  const right = /^r[fmh]?_/.test(segment);
  const left = right ? `l${segment.slice(1)}` : segment;
  const a = data.neutral[left];
  if (!a) return [0, 0, 0];
  const d = Math.PI / 180;
  return right ? [-a[0] * d, a[1] * d, -a[2] * d] : [a[0] * d, a[1] * d, a[2] * d];
}
