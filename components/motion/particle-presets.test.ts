import { describe, expect, it } from "vitest";
import { createParticles, PARTICLE_PRESETS, particlePosition, presetForPath } from "./particle-presets";

describe("particle geometry", () => {
  it("is reproducible without using ambient randomness", () => {
    expect(createParticles(10)).toEqual(createParticles(10));
  });
  it("keeps every shape finite inside its allocated margins across complete cycles", () => {
    const point = { x: 0, y: 0, z: 0, alpha: 0 };
    for (const preset of PARTICLE_PRESETS) for (let t = 0; t <= 36; t += .25) {
      for (const particle of createParticles(80)) {
        particlePosition(particle, preset, t, point);
        expect(Number.isFinite(point.x + point.y + point.alpha)).toBe(true);
        expect(Math.abs(point.x)).toBeLessThan(1.15);
        expect(Math.abs(point.y)).toBeLessThan(.9);
        expect(point.alpha).toBeGreaterThanOrEqual(0);
        expect(point.alpha).toBeLessThanOrEqual(.65);
      }
    }
  });
  it("rejoins continuously across both morphing cycle boundaries", () => {
    const before = { x: 0, y: 0, z: 0, alpha: 0 }, after = { ...before };
    for (const [preset, period] of [["agents", 14], ["terrain", 18]] as const) {
      for (const particle of createParticles(100)) {
        particlePosition(particle, preset, period - .0001, before);
        particlePosition(particle, preset, period + .0001, after);
        expect(Math.hypot(before.x - after.x, before.y - after.y)).toBeLessThan(.001);
      }
    }
  });
  it("resolves validation before the generic agents prefix", () => {
    expect(presetForPath("/agents-ia/a-valider")).toBe("terrain");
    expect(presetForPath("/agents-ia/relances")).toBe("agents");
    expect(presetForPath("/contacts/123")).toBe("sphere");
  });
});
