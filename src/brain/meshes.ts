// Loader for public/data/neuropils.<hash>.bin.gz (tools/build-data/build_meshes.py).

export interface NeuropilMesh {
  name: string;
  /** Unit-cube positions, already oriented for a front view: fly's right on the viewer's left, dorsal up. */
  positions: Float32Array;
  indices: Uint32Array;
}

interface Header {
  regions: Array<{ name: string; vertexOffset: number; vertexCount: number; indexOffset: number; indexCount: number }>;
}

async function gunzipIfNeeded(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const b = new Uint8Array(buf, 0, 2);
  if (b[0] !== 0x1f || b[1] !== 0x8b) return buf;
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

export function parseNeuropilMeshes(buf: ArrayBuffer): NeuropilMesh[] {
  const view = new DataView(buf);
  const jsonLen = view.getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, jsonLen))) as Header;
  const totalVerts = header.regions.reduce((s, r) => s + r.vertexCount, 0);
  const posStart = 4 + jsonLen;
  const q = new Int16Array(buf.slice(posStart, posStart + totalVerts * 6));
  const idxStart = posStart + Math.ceil((totalVerts * 6) / 4) * 4;
  const idx = new Uint32Array(buf.slice(idxStart));
  return header.regions.map((r) => {
    const positions = new Float32Array(r.vertexCount * 3);
    for (let i = 0; i < r.vertexCount * 3; i++) {
      // FAFB: +x = fly's right, +y = ventral, +z = posterior. Inverting all three gives a front view with the
      // fly's right on the viewer's left. The inversion flips winding, so materials render both sides.
      positions[i] = -q[r.vertexOffset * 3 + i] / 32767;
    }
    return { name: r.name, positions, indices: idx.slice(r.indexOffset, r.indexOffset + r.indexCount) };
  });
}

export async function loadNeuropilMeshes(baseUrl: string): Promise<NeuropilMesh[]> {
  const manifest = await fetch(`${baseUrl}neuropils.json`);
  if (!manifest.ok) throw new Error(`HTTP ${manifest.status} loading neuropils.json`);
  const { file } = (await manifest.json()) as { file: string };
  const res = await fetch(`${baseUrl}${file}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${file}`);
  return parseNeuropilMeshes(await gunzipIfNeeded(await res.arrayBuffer()));
}
