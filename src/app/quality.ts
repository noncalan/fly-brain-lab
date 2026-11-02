// Automatic 3D quality: phones start lower, and every 3D view steps down together when the page cannot hold 30 FPS.
import { useEffect, useSyncExternalStore } from 'react';

export type Quality = 'high' | 'medium' | 'low';
const ORDER: Quality[] = ['high', 'medium', 'low'];

export interface QualitySettings {
  /** device pixel ratio range for react-three-fiber */
  dpr: [number, number];
  shadows: boolean;
  /** draw every n-th neuron point in the 3D brain */
  pointStride: number;
}

export const QUALITY: Record<Quality, QualitySettings> = {
  high: { dpr: [1, 2], shadows: true, pointStride: 1 },
  medium: { dpr: [1, 1.25], shadows: true, pointStride: 1 },
  low: { dpr: [1, 1], shadows: false, pointStride: 3 },
};

/** Phones and small touch screens start at medium; `?quality=` overrides (useful for testing). */
export function initialQuality(search: string, coarsePointer: boolean, screenMax: number): Quality {
  const forced = new URLSearchParams(search).get('quality');
  if (forced === 'high' || forced === 'medium' || forced === 'low') return forced;
  return coarsePointer && screenMax < 1024 ? 'medium' : 'high';
}

/**
 * Decides when to step down: mean FPS over `windowMs` below `minFps`, after a grace period for loading.
 * Gaps longer than `pauseMs` (background tab, debugger) restart the window instead of counting as slow frames.
 */
export class FpsGovernor {
  private windowStart = -1;
  private frames = 0;
  private last = -1;
  private readonly startedAt: number;

  constructor(now: number, private readonly minFps = 30, private readonly windowMs = 2000, private readonly graceMs = 4000, private readonly pauseMs = 250) {
    this.startedAt = now;
  }

  /** Feed one animation frame; returns true when quality should drop one level (the window restarts). */
  frame(now: number): boolean {
    if (now - this.startedAt < this.graceMs) return false;
    if (this.last >= 0 && now - this.last > this.pauseMs) this.windowStart = -1;
    this.last = now;
    if (this.windowStart < 0) {
      this.windowStart = now;
      this.frames = 0;
      return false;
    }
    this.frames++;
    const elapsed = now - this.windowStart;
    if (elapsed < this.windowMs) return false;
    const fps = (this.frames * 1000) / elapsed;
    this.windowStart = now;
    this.frames = 0;
    return fps < this.minFps;
  }
}

let current: Quality = typeof window === 'undefined'
  ? 'high'
  : initialQuality(window.location.search, window.matchMedia?.('(pointer: coarse)').matches ?? false, Math.max(window.screen?.width ?? 0, window.screen?.height ?? 0));
const listeners = new Set<() => void>();
let users = 0;
let raf = 0;

function set(q: Quality): void {
  if (q === current) return;
  current = q;
  listeners.forEach((f) => f());
}

function startMonitor(): void {
  const governor = new FpsGovernor(performance.now());
  const tick = (now: number) => {
    if (governor.frame(now)) {
      const i = ORDER.indexOf(current);
      if (i < ORDER.length - 1) set(ORDER[i + 1]);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

/** Current quality settings; the FPS monitor runs while at least one 3D view is mounted. */
export function useQuality(): QualitySettings & { level: Quality } {
  const level = useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => current,
  );
  useEffect(() => {
    if (users++ === 0) startMonitor();
    return () => {
      if (--users === 0) cancelAnimationFrame(raf);
    };
  }, []);
  return { ...QUALITY[level], level };
}
