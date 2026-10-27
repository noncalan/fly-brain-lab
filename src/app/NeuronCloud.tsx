import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface NeuronCloudHandle {
  addSpikes(indices: Uint32Array): void;
}

const DECAY = 0.86; // per animation frame
const ACCENT = [56, 220, 180];
const BASE = 26;

/**
 * Every neuron is one pixel, laid out in columns grouped by primary neuropil (port of the fork's WebGL point panel).
 * Brightness jumps on a spike and decays per frame.
 */
export const NeuronCloud = forwardRef<NeuronCloudHandle, { primaryNeuropil: Uint8Array; label: string }>(
  function NeuronCloud({ primaryNeuropil, label }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const brightness = useRef(new Float32Array(primaryNeuropil.length));
    const pixelOf = useRef(new Uint32Array(primaryNeuropil.length));
    const size = useRef({ w: 0, h: 0 });

    useImperativeHandle(ref, () => ({
      addSpikes(indices) {
        const b = brightness.current;
        for (const i of indices) b[i] = 1;
      },
    }));

    useEffect(() => {
      // order neurons by neuropil, fill a near-square image column by column
      const n = primaryNeuropil.length;
      const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => primaryNeuropil[a] - primaryNeuropil[b] || a - b);
      const h = Math.ceil(Math.sqrt(n / 2));
      const w = Math.ceil(n / h);
      size.current = { w, h };
      order.forEach((neuron, k) => {
        pixelOf.current[neuron] = (k % h) * w + Math.floor(k / h);
      });
      const canvas = canvasRef.current!;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      const img = ctx.createImageData(w, h);
      let raf = 0;
      const draw = () => {
        const b = brightness.current;
        const px = pixelOf.current;
        const data = img.data;
        for (let i = 0; i < n; i++) {
          const v = b[i];
          const o = px[i] * 4;
          data[o] = BASE + (ACCENT[0] - BASE) * v;
          data[o + 1] = BASE + (ACCENT[1] - BASE) * v;
          data[o + 2] = BASE + (ACCENT[2] - BASE) * v;
          data[o + 3] = 255;
          if (v > 0) b[i] = v < 0.02 ? 0 : v * DECAY;
        }
        ctx.putImageData(img, 0, 0);
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(raf);
    }, [primaryNeuropil]);

    return (
      <canvas
        ref={canvasRef}
        className="h-full w-full rounded bg-neutral-900"
        style={{ imageRendering: 'pixelated' }}
        role="img"
        aria-label={label}
      />
    );
  },
);
