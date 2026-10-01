import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guard of the network background sources (docs/design-system.md §2.11.4,
 * §2.11.7 n° 9): seeded randomness only, and no glow other than the halo of
 * the reference (no shadow blur, no drop shadow, no filter).
 */
const DIRECTORY = join(process.cwd(), "components", "landing", "living");
const SOURCES = readdirSync(DIRECTORY).filter(
  (name) => /\.(ts|tsx|css)$/.test(name) && !name.endsWith(".test.ts"),
);

describe("network background sources", () => {
  it("lists the expected files", () => {
    expect(SOURCES).toEqual(
      expect.arrayContaining(["random.ts", "network.ts", "camera.ts", "signals.ts", "quiet.ts", "renderer.ts", "LivingEngine.ts", "LivingBackground.tsx"]),
    );
  });

  for (const name of SOURCES) {
    it(`${name}: no Math.random, shadowBlur, drop-shadow nor filter`, () => {
      const source = readFileSync(join(DIRECTORY, name), "utf8");
      expect(source).not.toMatch(/Math\.random\s*\(/);
      expect(source).not.toMatch(/shadowBlur/);
      expect(source).not.toMatch(/drop-shadow/);
      expect(source).not.toMatch(/\.filter\s*=[^=]/);
      expect(source).not.toMatch(/(^|[\s;{])filter\s*:/m);
      expect(source).not.toMatch(/backdrop-filter/);
    });
  }
});
