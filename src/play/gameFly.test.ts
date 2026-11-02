import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../sim/rng';
import { createFly, hit, isAirborne, render, stepFly, type GameFly, type Item, type World } from './gameFly';

const DT = 1 / 60;

function run(f: GameFly, seconds: number, world: World, rng: () => number, each?: (f: GameFly) => void): GameFly {
  let x = f;
  for (let t = 0; t < seconds; t += DT) {
    x = stepFly(x, DT, world, rng);
    each?.(x);
  }
  return x;
}

describe('game fly', () => {
  const world: World = { items: [], arenaRadius: 60 };

  it('gets hungrier and thirstier over time', () => {
    const rng = mulberry32(1);
    const f = run(createFly(rng), 10, world, rng);
    expect(f.needs.hunger).toBeGreaterThan(0.3);
    expect(f.needs.thirst).toBeGreaterThan(0.2);
  });

  it('a hit raises pain and fear, and the fly takes off within a moment', () => {
    const rng = mulberry32(2);
    let f = hit(createFly(rng), 1);
    expect(f.needs.pain).toBeGreaterThan(0.4);
    expect(f.stats.hits).toBe(1);
    f = run(f, 0.5, world, rng);
    expect(isAirborne(f)).toBe(true);
    expect(f.y).toBeGreaterThan(0);
  });

  it('flies chaotically but stays inside the arena and under the ceiling, then lands', () => {
    const rng = mulberry32(3);
    let maxR = 0;
    let maxY = 0;
    const headings = new Set<number>();
    let f = hit(createFly(rng), 1);
    f = run(f, 30, world, rng, (x) => {
      maxR = Math.max(maxR, Math.hypot(x.x, x.z));
      maxY = Math.max(maxY, x.y);
      headings.add(Math.round(x.heading));
    });
    expect(maxR).toBeLessThanOrEqual(60 + 1e-9);
    expect(maxY).toBeLessThanOrEqual(30);
    expect(maxY).toBeGreaterThan(5);
    expect(headings.size).toBeGreaterThan(4); // it turned many times
    expect(f.stats.flightS).toBeGreaterThan(1);
  });

  it('a hungry fly walks to food, eats, and hunger drops', () => {
    const rng = mulberry32(4);
    const food: Item = { id: 'f', kind: 'food', x: 20, z: 0, amount: 1 };
    const w: World = { items: [food], arenaRadius: 60 };
    let f: GameFly = { ...createFly(rng), needs: { hunger: 0.9, thirst: 0, fear: 0, pain: 0, fatigue: 0, curiosity: 0 } };
    let ate = false;
    f = run(f, 20, w, rng, (x) => {
      if (x.mode === 'eat') ate = true;
    });
    expect(ate).toBe(true);
    expect(f.needs.hunger).toBeLessThan(0.5);
    expect(food.amount).toBeLessThan(1);
  });

  it('a tired fly rests until it has recovered', () => {
    const rng = mulberry32(5);
    let f: GameFly = { ...createFly(rng), needs: { hunger: 0, thirst: 0, fear: 0, pain: 0, fatigue: 0.95, curiosity: 0 } };
    f = run(f, 0.2, world, rng);
    expect(f.mode).toBe('rest');
    f = run(f, 15, world, rng);
    expect(f.needs.fatigue).toBeLessThan(0.3);
  });

  it('renders feeding, grooming and an airborne pose', () => {
    const rng = mulberry32(6);
    const f = createFly(rng);
    expect(render({ ...f, mode: 'eat' }).feeding).toBe(true);
    expect(render({ ...f, mode: 'groom' }).grooming).toBe(true);
    const air = render({ ...f, mode: 'flight', y: 12, speed: 40 });
    expect(air.pose.y).toBe(12);
    expect(air.command.speed).toBe(0);
  });
});
