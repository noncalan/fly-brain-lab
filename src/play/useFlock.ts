// Extra flies in the lab arena. They run on the body script only (the brain model runs in the main fly), notice each
// other and the main fly, share the food and water on the floor, and can be hit like the main fly.
import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { ArenaMark, FlyDrive } from '../fly/Fly3D';
import type { FlyState } from '../fly/locomotion';
import { PERSONAL_MM, createFly, crowd, hit, isAirborne, render, scare, stepFly, type GameFly, type Item } from './gameFly';

export const MAX_EXTRA_FLIES = 5;
/** extra flies arrive flying at this height (mm), so they do not pop up on the floor */
const ARRIVAL_HEIGHT_MM = 12;

function arrive(arenaRadius: number): GameFly {
  const a = Math.random() * Math.PI * 2;
  const r = arenaRadius * (0.4 + Math.random() * 0.4);
  const f = createFly(Math.random);
  return { ...f, x: Math.cos(a) * r, z: Math.sin(a) * r, y: ARRIVAL_HEIGHT_MM, mode: 'flight', timer: 1 + Math.random() * 2, targetY: ARRIVAL_HEIGHT_MM };
}

const toItems = (marks: ArenaMark[]): Item[] =>
  marks.filter((m) => m.kind !== 'bitter').map((m) => ({ id: m.id, kind: m.kind === 'food' ? 'food' : 'water', x: m.x, z: m.z, amount: 1 }));

const idleDrive = (): FlyDrive => ({ command: { speed: 0, turnRate: 0 }, feeding: false, escape: false, grooming: false, pendingSimMs: 0, pose: null });

export function useFlock({
  count,
  marks,
  main,
  arenaRadius,
  onCrowdMain,
}: {
  count: number;
  marks: MutableRefObject<ArenaMark[]>;
  /** where the brain-driven fly is */
  main: MutableRefObject<FlyState>;
  arenaRadius: number;
  /** called with the frame time while an extra fly stands too close to the main fly */
  onCrowdMain: (dtS: number) => void;
}) {
  const flies = useRef<GameFly[]>([]);
  const drives = useRef<FlyDrive[]>([]);
  const onCrowdRef = useRef(onCrowdMain);
  onCrowdRef.current = onCrowdMain;

  // grow or shrink the flock; flies that stay keep their state
  if (flies.current.length !== count) {
    flies.current = Array.from({ length: count }, (_, i) => flies.current[i] ?? arrive(arenaRadius));
    drives.current = flies.current.map((_, i) => drives.current[i] ?? idleDrive());
  }

  useEffect(() => {
    if (count === 0) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const world = { items: toItems(marks.current), arenaRadius };
      const m = main.current;
      const stepped = flies.current.map((f) => stepFly(f, dt, world, Math.random));
      flies.current = crowd(stepped, dt, [{ x: m.x, z: m.z }]);
      if (flies.current.some((f) => !isAirborne(f) && Math.hypot(f.x - m.x, f.z - m.z) < PERSONAL_MM)) onCrowdRef.current(dt);
      flies.current.forEach((f, i) => {
        const d = drives.current[i];
        if (!d) return;
        const r = render(f);
        d.pose = r.pose;
        d.command = r.command;
        d.feeding = r.feeding;
        d.grooming = r.grooming;
        d.pendingSimMs += dt * 1000;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [count, marks, main, arenaRadius]);

  const hitFly = useCallback((i: number) => {
    flies.current = flies.current.map((x, j) => (j === i ? hit(x, 1) : x));
  }, []);

  /** something every fly notices at once, like a clap */
  const scareAll = useCallback((strength: number) => {
    flies.current = flies.current.map((x) => scare(x, strength));
  }, []);

  return { drives, hit: hitFly, scareAll };
}
