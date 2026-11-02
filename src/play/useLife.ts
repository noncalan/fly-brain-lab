// "Alive" fly in the lab: a script moves the body (wandering, flying, needs), and the brain model takes over the
// moment its neurons drive a behaviour. What drives the fly right now is always reported (`control`).
import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { ArenaMark, FlyDrive } from '../fly/Fly3D';
import type { FlyState, LocomotionCommand } from '../fly/locomotion';
import { createFly, hit, isAirborne, render, scare, stepFly, type GameFly, type Item } from './gameFly';

/** What the brain model currently asks the body to do (written by the lab on every simulation frame). */
export interface NeuralDrive {
  command: LocomotionCommand;
  feeding: boolean;
  escape: boolean;
  grooming: boolean;
  /** simulated ms not yet handed to the 3D fly */
  pendingSimMs: number;
}

export type Control = 'neurons' | 'script';

export interface LifeView {
  fly: GameFly;
  control: Control;
}

const VIEW_EVERY_MS = 100;
const WALK_MIN = 0.3;
const TURN_MIN = 0.15;

/** The brain is "doing something" the body must show: neurons then have priority over the script. */
export function neuronsBusy(n: NeuralDrive): boolean {
  return n.feeding || n.escape || n.grooming || Math.abs(n.command.speed) > WALK_MIN || Math.abs(n.command.turnRate) > TURN_MIN;
}

function itemsFrom(marks: ArenaMark[]): Item[] {
  return marks.filter((m) => m.kind !== 'bitter').map((m) => ({ id: m.id, kind: m.kind === 'food' ? 'food' : 'water', x: m.x, z: m.z, amount: 1 }));
}

export function useLife({
  enabled,
  drive,
  neural,
  flyState,
  marks,
  arenaRadius,
  onView,
}: {
  enabled: boolean;
  drive: MutableRefObject<FlyDrive>;
  neural: MutableRefObject<NeuralDrive>;
  flyState: MutableRefObject<FlyState>;
  marks: MutableRefObject<ArenaMark[]>;
  arenaRadius: number;
  onView: (v: LifeView) => void;
}) {
  const fly = useRef<GameFly>({ ...createFly(Math.random), ...flyState.current });
  const onViewRef = useRef(onView);
  onViewRef.current = onView;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastView = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const nr = neural.current;
      const d = drive.current;
      let control: Control = 'neurons';
      if (enabled) {
        const busy = neuronsBusy(nr);
        let f = fly.current;
        if (busy && isAirborne(f) && f.mode !== 'landing') f = { ...f, mode: 'landing', targetY: 0 }; // land, then hand over
        f = stepFly(f, dt, { items: itemsFrom(marks.current), arenaRadius, feeding: nr.feeding }, Math.random);
        if (busy && !isAirborne(f)) {
          // the brain moves the body (Fly3D integrates it); the script only keeps track of where it is
          const s = flyState.current;
          f = { ...f, x: s.x, z: s.z, heading: s.heading, targetHeading: s.heading, y: 0, speed: 0 };
        } else {
          control = 'script';
        }
        fly.current = f;
        if (control === 'script') {
          const r = render(f);
          d.pose = r.pose;
          d.command = r.command;
          d.escape = false;
          d.feeding = nr.feeding; // the proboscis only ever follows MN9
          d.grooming = r.grooming || nr.grooming;
          d.pendingSimMs += dt * 1000; // the script runs in wall time
          nr.pendingSimMs = 0;
        }
      }
      if (control === 'neurons') {
        d.pose = null;
        d.command = nr.command;
        d.feeding = nr.feeding;
        d.escape = nr.escape;
        d.grooming = nr.grooming;
        d.pendingSimMs += nr.pendingSimMs;
        nr.pendingSimMs = 0;
      }
      if (now - lastView > VIEW_EVERY_MS) {
        lastView = now;
        onViewRef.current({ fly: fly.current, control });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, drive, neural, flyState, marks, arenaRadius]);

  return {
    hit: useCallback((strength: number) => (fly.current = hit(fly.current, strength)), []),
    scare: useCallback((strength: number) => (fly.current = scare(fly.current, strength)), []),
    reset: useCallback(() => (fly.current = { ...createFly(Math.random), ...flyState.current }), [flyState]),
  };
}
