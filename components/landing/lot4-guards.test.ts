import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards of Lot 4 (docs/design-system.md §2.11.8.8 L4-A, L4-E):
 * - `animejs` is imported only under `components/landing/roi/**`;
 * - the app-tile tones (`--app-tile-*`) and their colours live in ONE CSS
 *   file (block A), and nowhere else in the code of the site.
 */

const ROOT = process.cwd();
const SKIP = new Set(["node_modules", ".next", ".git", "test-results", "playwright-report", "graphify-out", "docs", "supabase"]);

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(tsx?|css|mjs|js)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const SOURCES = ["app", "components", "features", "lib"].flatMap((dir) => files(join(ROOT, dir)));
const rel = (path: string) => relative(ROOT, path).split(sep).join("/");

describe("Lot 4 guards", () => {
  it("imports animejs only under components/landing/roi/", () => {
    const importers = SOURCES.filter((path) => /from\s+["']animejs|import\(["']animejs|require\(["']animejs/.test(readFileSync(path, "utf8"))).map(rel);
    expect(importers.length).toBeGreaterThan(0);
    for (const path of importers) expect(path).toMatch(/^components\/landing\/roi\//);
  });

  it("pins animejs to an exact 4.x version", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { dependencies: Record<string, string> };
    expect(pkg.dependencies.animejs).toMatch(/^4\.\d+\.\d+$/);
  });

  it("declares the app-tile tones in one CSS file only, and uses their colours nowhere else", () => {
    const declaring = SOURCES.filter((path) => /--app-tile-[a-z-]+\s*:/.test(readFileSync(path, "utf8"))).map(rel);
    expect(declaring).toEqual(["components/landing/ecosystem/app-tile.module.css"]);
    const colours = /#(e8600e|cf4f08|7a5cfa|5b3fe0|1e9e5a|127a45)\b/i;
    const using = SOURCES.filter((path) => colours.test(readFileSync(path, "utf8"))).map(rel);
    expect(using).toEqual(["components/landing/ecosystem/app-tile.module.css"]);
  });
});
