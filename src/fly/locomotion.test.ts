import { describe, expect, it } from 'vitest';
import { LOCOMOTION, integrate, locomotionFromRates } from './locomotion';

describe('locomotionFromRates', () => {
  it('stands still when all walking neurons are silent', () => {
    expect(locomotionFromRates({})).toEqual({ speed: 0, turnRate: 0 });
    expect(locomotionFromRates({ dnp09_l: 0.5, dnp09_r: 0.5 })).toEqual({ speed: 0, turnRate: 0 });
  });

  it('DNp09 on both sides walks forward without turning', () => {
    const c = locomotionFromRates({ dnp09_l: 50, dnp09_r: 50 });
    expect(c.speed).toBeCloseTo(50 * LOCOMOTION.forwardMmPerHz);
    expect(c.turnRate).toBe(0);
  });

  it('right DNp09 alone walks forward and turns right (ipsilateral)', () => {
    const c = locomotionFromRates({ dnp09_r: 50 });
    expect(c.speed).toBeGreaterThan(0);
    expect(c.turnRate).toBeGreaterThan(0);
  });

  it('MDN walks backward', () => {
    expect(locomotionFromRates({ mdn: 40 }).speed).toBeLessThan(0);
  });

  it('left DNa02 turns left', () => {
    expect(locomotionFromRates({ dna02_l: 60 }).turnRate).toBeLessThan(0);
  });
});

describe('integrate', () => {
  it('moves along the heading and stops at the arena wall', () => {
    let s = { x: 0, z: 0, heading: 0 };
    s = integrate(s, { speed: 10, turnRate: 0 }, 1, 100);
    expect(s.x).toBeCloseTo(10);
    s = integrate(s, { speed: 10, turnRate: 0 }, 100, 30);
    expect(Math.hypot(s.x, s.z)).toBeCloseTo(30);
  });

  it('a right turn decreases the heading angle (clockwise from above)', () => {
    expect(integrate({ x: 0, z: 0, heading: 0 }, { speed: 0, turnRate: 1 }, 1, 30).heading).toBeCloseTo(-1);
  });
});
