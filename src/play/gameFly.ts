// Game mode: a scripted fly driven by simple "needs". This is NOT the brain model — nothing here comes from
// neurons. It exists so visitors can play with a lively fly; the Lab page stays the honest simulation.
import type { ExternalPose } from '../fly/Fly3D';

export const NEEDS = ['hunger', 'thirst', 'fear', 'pain', 'fatigue', 'curiosity'] as const;
export type Need = (typeof NEEDS)[number];
export type Needs = Record<Need, number>;

export type Mode = 'wander' | 'pause' | 'groom' | 'explore' | 'flight' | 'flee' | 'landing' | 'rest' | 'seekFood' | 'eat' | 'seekWater' | 'drink';

export interface Item {
  id: string;
  kind: 'food' | 'water';
  x: number;
  z: number;
  /** 1 = full drop, consumed while eating/drinking */
  amount: number;
}

export interface GameFly {
  needs: Needs;
  mode: Mode;
  /** seconds left in the current mode (for timed modes) */
  timer: number;
  x: number;
  z: number;
  y: number;
  heading: number;
  /** heading the fly is turning toward */
  targetHeading: number;
  /** altitude the fly is climbing or sinking toward while airborne */
  targetY: number;
  speed: number;
  /** seconds until the next sudden turn in flight, or the next random turn on foot */
  nextTurn: number;
  pitch: number;
  roll: number;
  /** seconds at the food without the brain feeding */
  unfed: number;
  /** seconds during which food is ignored (after giving up) */
  foodCooldown: number;
  stats: { hits: number; eaten: number; drunk: number; flightS: number };
}

export interface World {
  items: Item[];
  arenaRadius: number;
  /**
   * In the lab the brain model decides whether the fly actually feeds (MN9 above threshold). When set, eating
   * lowers hunger only while this is true, and a fly whose brain does not feed gives up after a while.
   * Undefined = the script alone decides.
   */
  feeding?: boolean;
}

/** Tunables (per second of wall time). Chosen for a lively, readable game — not measured fly physiology. */
export const GAME = {
  walkSpeed: 8,
  searchSpeed: 13,
  flightSpeed: 42,
  fleeSpeed: 70,
  turnRateGround: 4,
  turnRateAir: 14,
  ceiling: 30,
  reach: 3,
  hungerPerS: 0.012,
  thirstPerS: 0.015,
  fatigueWalkPerS: 0.004,
  fatigueFlyPerS: 0.025,
  restRecoverPerS: 0.07,
  fearDecayPerS: 0.12,
  painDecayPerS: 0.05,
  curiosityPerS: 0.02,
  curiosityDropPerS: 0.06,
  eatPerS: 0.25,
  dropUsePerS: 0.05,
  /** a fly at food whose brain does not feed walks off after this long… */
  giveUpS: 4,
  /** …and ignores food for this long */
  foodCooldownS: 15,
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const AIRBORNE = new Set<Mode>(['flight', 'flee', 'landing']);
const FEEDING = new Set<Mode>(['seekFood', 'eat', 'seekWater', 'drink']);

export function createFly(rng: () => number): GameFly {
  return {
    needs: { hunger: 0.3, thirst: 0.2, fear: 0, pain: 0, fatigue: 0.1, curiosity: 0.4 },
    mode: 'wander',
    timer: 3,
    x: 0,
    z: 0,
    y: 0,
    heading: rng() * Math.PI * 2,
    targetHeading: 0,
    targetY: 0,
    speed: 0,
    nextTurn: 1,
    pitch: 0,
    roll: 0,
    unfed: 0,
    foodCooldown: 0,
    stats: { hits: 0, eaten: 0, drunk: 0, flightS: 0 },
  };
}

export const isAirborne = (f: GameFly) => AIRBORNE.has(f.mode);

function nearest(f: GameFly, items: Item[], kind: Item['kind']): Item | null {
  let best: Item | null = null;
  let bd = Infinity;
  for (const it of items) {
    if (it.kind !== kind || it.amount <= 0) continue;
    const d = Math.hypot(it.x - f.x, it.z - f.z);
    if (d < bd) {
      bd = d;
      best = it;
    }
  }
  return best;
}

const headingTo = (f: GameFly, x: number, z: number) => Math.atan2(-(z - f.z), x - f.x);

function takeOff(f: GameFly, mode: 'flight' | 'flee', rng: () => number): GameFly {
  return {
    ...f,
    mode,
    timer: mode === 'flee' ? 2 + rng() * 2 : 3 + rng() * 5,
    targetY: 8 + rng() * (GAME.ceiling - 8),
    nextTurn: 0,
    targetHeading: f.heading + (rng() - 0.5) * Math.PI,
  };
}

/** Pick what to do next on the ground: danger first, then needs, then curiosity, then idle behaviour. */
function decideOnGround(f: GameFly, world: World, rng: () => number): GameFly {
  const n = f.needs;
  if (n.fear > 0.45 || n.pain > 0.55) return takeOff(f, 'flee', rng);
  if (f.mode === 'rest' && n.fatigue > 0.25) return f;
  if (n.fatigue > 0.85) return { ...f, mode: 'rest', timer: 0 };
  if (n.thirst > 0.55 && nearest(f, world.items, 'water')) return { ...f, mode: f.mode === 'drink' ? 'drink' : 'seekWater' };
  if (n.hunger > 0.5 && f.foodCooldown <= 0 && nearest(f, world.items, 'food')) return { ...f, mode: f.mode === 'eat' ? 'eat' : 'seekFood' };
  if (FEEDING.has(f.mode) && f.timer > 0) return f;
  if (n.curiosity > 0.75 && n.fatigue < 0.6) return rng() < 0.6 ? takeOff(f, 'flight', rng) : { ...f, mode: 'explore', timer: 4 + rng() * 4 };
  if (f.timer > 0) return f;
  // idle: walking bouts, pauses and grooming bouts, as flies alternate them
  const r = rng();
  if (n.pain > 0.1 || r < 0.2) return { ...f, mode: 'groom', timer: 2 + rng() * 3 };
  if (r < 0.45) return { ...f, mode: 'pause', timer: 1 + rng() * 3 };
  return { ...f, mode: 'wander', timer: 2 + rng() * 5 };
}

function updateNeeds(f: GameFly, dt: number, world: World): Needs {
  const n = f.needs;
  const eating = f.mode === 'eat' && world.feeding !== false;
  const air = isAirborne(f);
  const resting = f.mode === 'rest' || f.mode === 'pause';
  const exploring = air || f.mode === 'explore';
  const fatigueRate = air ? GAME.fatigueFlyPerS : resting ? -GAME.restRecoverPerS : f.speed > 0 ? GAME.fatigueWalkPerS : 0;
  return {
    hunger: clamp01(n.hunger + GAME.hungerPerS * dt - (eating ? GAME.eatPerS * dt : 0)),
    thirst: clamp01(n.thirst + GAME.thirstPerS * dt - (f.mode === 'drink' ? GAME.eatPerS * dt : 0)),
    fear: clamp01(n.fear - GAME.fearDecayPerS * dt),
    pain: clamp01(n.pain - GAME.painDecayPerS * dt),
    fatigue: clamp01(n.fatigue + fatigueRate * dt),
    curiosity: clamp01(n.curiosity + (exploring ? -GAME.curiosityDropPerS : GAME.curiosityPerS) * dt),
  };
}

/** Turn toward `target` at a limited rate; returns the new heading and the signed turn rate used. */
function steer(heading: number, target: number, maxRate: number, dt: number): [number, number] {
  const diff = wrap(target - heading);
  const step = Math.max(-maxRate * dt, Math.min(maxRate * dt, diff));
  return [heading + step, dt > 0 ? step / dt : 0];
}

function clampToArena(x: number, z: number, radius: number): [number, number] {
  const r = Math.hypot(x, z);
  return r > radius ? [(x * radius) / r, (z * radius) / r] : [x, z];
}

function fly(f: GameFly, dt: number, world: World, rng: () => number): GameFly {
  const R = world.arenaRadius;
  let { targetHeading, targetY, nextTurn, mode } = f;
  const timer = f.timer - dt;
  nextTurn -= dt;
  if (Math.hypot(f.x, f.z) > R * 0.8) {
    targetHeading = headingTo(f, 0, 0) + (rng() - 0.5) * 1.2; // turn back before the wall
    nextTurn = 0.3;
  } else if (nextTurn <= 0) {
    // flies fly in straight stretches broken by sudden turns ("saccades")
    targetHeading = f.heading + (rng() < 0.5 ? -1 : 1) * (0.6 + rng() * 1.6);
    targetY = mode === 'landing' ? 0 : 6 + rng() * (GAME.ceiling - 6);
    nextTurn = (mode === 'flee' ? 0.2 : 0.4) + rng() * 0.8;
  }
  if (mode !== 'landing' && timer <= 0 && f.needs.fear < 0.2) {
    mode = 'landing';
    targetY = 0;
  }
  const [heading, turn] = steer(f.heading, targetHeading, GAME.turnRateAir, dt);
  const speed = mode === 'flee' ? GAME.fleeSpeed : mode === 'landing' ? GAME.flightSpeed * 0.6 : GAME.flightSpeed;
  const climb = Math.max(-25, Math.min(25, (targetY - f.y) * 3));
  const y = Math.max(0, Math.min(GAME.ceiling, f.y + climb * dt));
  const [x, z] = clampToArena(f.x + Math.cos(heading) * speed * dt, f.z - Math.sin(heading) * speed * dt, R);
  const stats = { ...f.stats, flightS: f.stats.flightS + dt };
  if (mode === 'landing' && y <= 0.05) {
    return { ...f, mode: 'pause', timer: 1 + rng() * 2, heading, targetHeading: heading, x, z, y: 0, speed: 0, pitch: 0, roll: 0, nextTurn: 1, targetY: 0, stats };
  }
  return {
    ...f,
    mode,
    timer,
    nextTurn,
    targetHeading,
    targetY,
    heading,
    speed,
    x,
    y,
    z,
    pitch: Math.max(-0.5, Math.min(0.5, climb / 50)) - 0.15, // flies fly slightly nose-down
    roll: Math.max(-0.7, Math.min(0.7, -turn * 0.05)),
    stats,
  };
}

function walk(f: GameFly, dt: number, world: World, rng: () => number): GameFly {
  let { targetHeading, nextTurn, mode, stats } = f;
  let speed = 0;
  let timer = f.timer - dt;
  if (mode === 'seekFood' || mode === 'seekWater') {
    const it = nearest(f, world.items, mode === 'seekFood' ? 'food' : 'water');
    if (!it) {
      mode = 'wander';
    } else {
      targetHeading = headingTo(f, it.x, it.z);
      speed = GAME.searchSpeed;
      if (Math.hypot(it.x - f.x, it.z - f.z) < GAME.reach) {
        mode = mode === 'seekFood' ? 'eat' : 'drink';
        speed = 0;
        timer = 1;
      }
    }
  } else if (mode === 'eat' && world.feeding === false && f.unfed + dt > GAME.giveUpS) {
    // the brain does not feed (e.g. the GNG is silenced): walk away and leave the food alone for a while
    return walk({ ...f, mode: 'explore', timer: 3 + rng() * 3, unfed: 0, foodCooldown: GAME.foodCooldownS }, dt, world, rng);
  } else if (mode === 'eat' || mode === 'drink') {
    const it = nearest(f, world.items, mode === 'eat' ? 'food' : 'water');
    const need = mode === 'eat' ? f.needs.hunger : f.needs.thirst;
    if (!it || Math.hypot(it.x - f.x, it.z - f.z) > GAME.reach * 1.5 || need < 0.03) {
      if (it && need < 0.03) stats = mode === 'eat' ? { ...stats, eaten: stats.eaten + 1 } : { ...stats, drunk: stats.drunk + 1 };
      mode = 'pause';
      timer = 1 + rng() * 2;
    } else {
      it.amount = Math.max(0, it.amount - GAME.dropUsePerS * dt); // the drop shrinks while the fly feeds
      timer = 1;
    }
  } else if (mode === 'wander' || mode === 'explore') {
    nextTurn -= dt;
    if (nextTurn <= 0) {
      targetHeading = f.heading + (rng() - 0.5) * (mode === 'explore' ? 2.5 : 1.6);
      nextTurn = 0.5 + rng() * 1.5;
    }
    if (Math.hypot(f.x, f.z) > world.arenaRadius * 0.85) targetHeading = headingTo(f, 0, 0);
    speed = mode === 'explore' ? GAME.searchSpeed : GAME.walkSpeed;
  }
  const [heading] = steer(f.heading, targetHeading, GAME.turnRateGround, dt);
  const [x, z] = clampToArena(f.x + Math.cos(heading) * speed * dt, f.z - Math.sin(heading) * speed * dt, world.arenaRadius);
  return { ...f, mode, timer, targetHeading, nextTurn, heading, speed, x, z, y: 0, pitch: 0, roll: 0, stats };
}

/** Advance the game fly by `dt` seconds of wall time. Food and water drops shrink in place while used. */
export function stepFly(f: GameFly, dt: number, world: World, rng: () => number): GameFly {
  const step = Math.min(dt, 0.1); // after a stall (background tab), do not jump
  const unfed = f.mode === 'eat' && world.feeding === false ? f.unfed + step : 0;
  const withNeeds = { ...f, needs: updateNeeds(f, step, world), unfed, foodCooldown: Math.max(0, f.foodCooldown - step) };
  if (isAirborne(withNeeds)) return fly(withNeeds, step, world, rng);
  const decided = decideOnGround(withNeeds, world, rng);
  if (isAirborne(decided)) return fly(decided, step, world, rng);
  return walk(decided, step, world, rng);
}

/** A hit or poke on the fly: pain and fear jump, and the fly bolts. */
export function hit(f: GameFly, strength: number): GameFly {
  const s = clamp01(strength);
  return {
    ...f,
    needs: { ...f.needs, pain: clamp01(f.needs.pain + 0.45 * s), fear: clamp01(f.needs.fear + 0.7 * s) },
    stats: { ...f.stats, hits: f.stats.hits + 1 },
  };
}

/** Something frightening nearby (a clap, a shadow): fear only. */
export function scare(f: GameFly, strength: number): GameFly {
  return { ...f, needs: { ...f.needs, fear: clamp01(f.needs.fear + clamp01(strength)) } };
}

/** What the 3D fly should draw this frame. */
export function render(f: GameFly): { pose: ExternalPose; command: { speed: number; turnRate: number }; feeding: boolean; grooming: boolean } {
  const ground = !isAirborne(f);
  return {
    pose: { x: f.x, y: f.y, z: f.z, heading: f.heading, pitch: f.pitch, roll: f.roll },
    command: { speed: ground ? f.speed : 0, turnRate: 0 },
    feeding: f.mode === 'eat' || f.mode === 'drink',
    grooming: f.mode === 'groom',
  };
}
