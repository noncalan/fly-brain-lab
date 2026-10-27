import { useEffect, useRef } from 'react';

export interface FlyPose {
  feeding: boolean;
  escape: boolean;
  antennalGrooming: boolean;
}

const BODY = '#c8a46a';
const DARK = '#3b2f22';
const EYE = '#b3261e';
const WING = 'rgba(210, 225, 240, 0.55)';

interface Anim {
  proboscis: number;
  wings: number;
  lift: number;
  groom: number;
}

/** Top-down fly. Every moving part is driven only by behaviour states computed from simulated neurons. */
export function FlyCanvas({ pose, label }: { pose: FlyPose; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef(pose);
  poseRef.current = pose;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let raf = 0;
    const anim: Anim = { proboscis: 0, wings: 0, lift: 0, groom: 0 };
    const draw = (t: number) => {
      const p = poseRef.current;
      const ease = (cur: number, target: number) => cur + (target - cur) * 0.15;
      anim.proboscis = ease(anim.proboscis, p.feeding ? 1 : 0);
      anim.wings = ease(anim.wings, p.escape ? 1 : 0);
      anim.lift = ease(anim.lift, p.escape ? 1 : 0);
      anim.groom = ease(anim.groom, p.antennalGrooming ? 1 : 0);

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const s = (Math.min(w, h) / 220) * (1 + anim.lift * 0.12);
      ctx.translate(w / 2, h / 2 - anim.lift * 20);
      ctx.scale(s, s);
      drawFly(ctx, anim, t);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full" role="img" aria-label={label} />;
}

function drawLegs(ctx: CanvasRenderingContext2D, groom: number, t: number) {
  // 3 pairs; the front pair sweeps up over the head while grooming the antennae
  ctx.strokeStyle = DARK;
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const y0 = -12 + k * 14;
      const sweep = k === 0 ? groom * (0.6 + 0.4 * Math.sin(t / 90)) : 0;
      ctx.beginPath();
      ctx.moveTo(side * 8, y0);
      ctx.lineTo(side * (26 + k * 4), y0 + (k - 1) * 10 - sweep * 30);
      ctx.lineTo(side * (38 + k * 6) - side * sweep * 26, y0 + (k - 1) * 28 - sweep * 46);
      ctx.stroke();
    }
  }
}

function drawWings(ctx: CanvasRenderingContext2D, wings: number, t: number) {
  // folded over the abdomen at rest, spread and buzzing for takeoff
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 4, 0);
    ctx.rotate(side * (0.15 + wings * 1.1 + wings * 0.08 * Math.sin(t / 15)));
    ctx.fillStyle = WING;
    ctx.beginPath();
    ctx.ellipse(side * 6, 34, 11, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBody(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BODY;
  ctx.beginPath();
  ctx.ellipse(0, 36, 15, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = DARK;
  for (let k = 0; k < 4; k++) ctx.fillRect(-13 + k * 0.5, 26 + k * 10, 26 - k, 3);
  ctx.fillStyle = BODY;
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 18, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHead(ctx: CanvasRenderingContext2D, a: Anim, t: number) {
  if (a.proboscis > 0.02) {
    // proboscis extends forward from under the head when MN9 drives feeding
    ctx.strokeStyle = DARK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(0, -30 - a.proboscis * 22);
    ctx.stroke();
    ctx.fillStyle = DARK;
    ctx.beginPath();
    ctx.ellipse(0, -32 - a.proboscis * 22, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = BODY;
  ctx.beginPath();
  ctx.ellipse(0, -24, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = EYE;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 11, -25, 6, 8, side * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = DARK;
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    const flick = a.groom * 0.25 * Math.sin(t / 70 + side);
    ctx.beginPath();
    ctx.moveTo(side * 3, -32);
    ctx.lineTo(side * (6 + flick * 10), -40 - flick * 4);
    ctx.stroke();
  }
}

function drawFly(ctx: CanvasRenderingContext2D, a: Anim, t: number) {
  ctx.lineCap = 'round';
  drawLegs(ctx, a.groom, t);
  drawWings(ctx, a.wings, t);
  drawBody(ctx);
  drawHead(ctx, a, t);
}
