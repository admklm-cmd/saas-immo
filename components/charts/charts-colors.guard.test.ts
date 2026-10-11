import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Design guard (docs/design-system.md §3.5.1, criterion 3): no colour written
 * in the chart code. Colours come from the tokens (`var(--chart-*)`, `var(--color-*)`).
 */
const ROOT = process.cwd();
const FORBIDDEN =
  /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(|\b(?:red|orange|green|blue|purple|yellow|pink|indigo|violet|cyan|teal|lime|amber|emerald)\b|--color-danger/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Source without comments (the vendored files quote example colours in their doc comments). */
function codeOf(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(^|\s)\/\/.*$/, ""))
    .join("\n");
}

const isSource = (f: string) => /\.(tsx?|css)$/.test(f) && !f.includes(".test.");

const files = [
  ...walk(path.join(ROOT, "components", "charts")).filter(isSource),
  ...["dashboard", "pipeline"].flatMap((feature) =>
    walk(path.join(ROOT, "features", feature, "components")).filter(
      (f) => /(Activity|Funnel|activity|funnel)/.test(path.basename(f)) && isSource(f),
    ),
  ),
];

describe("analytics charts use tokens only", () => {
  it("finds the chart files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((f) => [path.relative(ROOT, f), f] as const))("%s has no colour literal", (_name, file) => {
    expect(codeOf(file).match(FORBIDDEN)).toBeNull();
  });

  it("the chart variables are defined on .chart-scope, never on :root", () => {
    const css = readFileSync(path.join(ROOT, "app", "globals.css"), "utf8");
    const root = css.match(/:root\s*\{[^}]*\}/g)?.join("\n") ?? "";
    expect(root).not.toMatch(/--chart-/);
    expect(css).toMatch(/\.chart-scope\s*\{[^}]*--chart-line-primary: var\(--color-ink\)/);
  });
});
