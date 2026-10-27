// Downloads: PNG of the fly and brain views, a 5 s GIF of the fly, and the activity history as CSV.
import { GIFEncoder, applyPalette, quantize } from 'gifenc';

const GIF_FPS = 10;
const GIF_SECONDS = 5;
const GIF_WIDTH = 480;

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

/** Fly and brain canvases side by side on the page background. */
export function exportPng(canvases: HTMLCanvasElement[], background: string): void {
  const h = Math.max(...canvases.map((c) => c.height));
  const out = document.createElement('canvas');
  out.width = canvases.reduce((s, c) => s + c.width, 0);
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, out.width, out.height);
  let x = 0;
  for (const c of canvases) {
    ctx.drawImage(c, x, (h - c.height) / 2);
    x += c.width;
  }
  out.toBlob((b) => b && download(b, `fly-brain-lab-${stamp()}.png`), 'image/png');
}

/** Record the canvas for GIF_SECONDS at GIF_FPS (the 3D canvas keeps its drawing buffer for this). */
export async function exportGif(canvas: HTMLCanvasElement, onProgress?: (fraction: number) => void): Promise<void> {
  const scale = GIF_WIDTH / canvas.width;
  const w = GIF_WIDTH;
  const h = Math.round(canvas.height * scale);
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const ctx = tmp.getContext('2d', { willReadFrequently: true })!;
  const gif = GIFEncoder();
  const frames = GIF_FPS * GIF_SECONDS;
  for (let i = 0; i < frames; i++) {
    ctx.drawImage(canvas, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), w, h, { palette, delay: 1000 / GIF_FPS });
    onProgress?.((i + 1) / frames);
    await new Promise((r) => setTimeout(r, 1000 / GIF_FPS));
  }
  gif.finish();
  download(new Blob([gif.bytes()], { type: 'image/gif' }), `fly-brain-lab-${stamp()}.gif`);
}

export function exportCsv(csv: string): void {
  download(new Blob([csv], { type: 'text/csv' }), `fly-brain-lab-activity-${stamp()}.csv`);
}
