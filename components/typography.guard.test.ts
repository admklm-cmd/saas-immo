import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { APP_TEXTS } from "./texts";
import { countAccent } from "./ui/editorial-title";

/**
 * Guard of the expressive typography (docs/design-system.md §2.2, §2.2.10).
 * Inter left the product on 01/10/2026: it must never come back, and the
 * removed display size must not be used again.
 */

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SCANNED_DIRS = ["app", "components"];
const SELF = "typography.guard.test.ts";

function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listSources(full));
    else if (/\.(tsx?|css)$/.test(entry) && entry !== SELF) out.push(full);
  }
  return out;
}

const SOURCES = SCANNED_DIRS.flatMap((dir) => listSources(join(ROOT, dir)));

describe("typography guard", () => {
  it("finds no trace of Inter in app/ and components/", () => {
    // Built from parts so this file never matches itself.
    const forbidden = ["--font-" + "inter", "Inter" + "("];
    const offenders = SOURCES.filter((file) => {
      const source = readFileSync(file, "utf8");
      return forbidden.some((needle) => source.includes(needle));
    }).map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it("no longer uses the removed text-display size", () => {
    const needle = "text-" + "display";
    const offenders = SOURCES.filter((file) => readFileSync(file, "utf8").includes(needle)).map((file) =>
      relative(ROOT, file),
    );
    expect(offenders).toEqual([]);
  });

  it("declares the four families once, in the root layout, with distinct variable names", () => {
    const layout = readFileSync(join(ROOT, "app/layout.tsx"), "utf8");
    expect(layout).toMatch(/Bricolage_Grotesque\(\{[^}]*axes: \["opsz", "wdth"\][^}]*variable: "--font-bricolage"/);
    expect(layout).toMatch(/Instrument_Serif\(\{[^}]*weight: "400"[^}]*style: "italic"[^}]*variable: "--font-instrument-serif"/);
    expect(layout).toMatch(/Geist\(\{[^}]*variable: "--font-geist"/);
    expect(layout).toMatch(/Geist_Mono\(\{[^}]*variable: "--font-geist-mono"/);
    const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
    expect(css).toMatch(/--font-display: var\(--font-bricolage\)/);
    expect(css).toMatch(/--font-accent: var\(--font-instrument-serif\)/);
    expect(css).toMatch(/--font-sans:\s*var\(--font-geist\)/);
    // The accented word is inline (never inline-block) and does not grow the line.
    const accent = css.slice(css.indexOf(".title-accent {"), css.indexOf("}", css.indexOf(".title-accent {")));
    expect(accent).toMatch(/display: inline;/);
    expect(accent).toMatch(/line-height: 0;/);
  });
});

describe("estimation title", () => {
  const TEXTS = APP_TEXTS.estimation;

  it("is a sentence of two author lines with one accented word", () => {
    expect(TEXTS.title).toBe(TEXTS.titleLines.join(" "));
    expect(TEXTS.titleLines).toEqual(["Parlez-nous de votre bien.", "Un conseiller vous répond."]);
    expect(countAccent(TEXTS.titleLines, TEXTS.titleAccent)).toBe(1);
    expect(TEXTS.title).not.toMatch(/\d|€|%/);
  });

  it("keeps the legal subtitle word for word", () => {
    expect(TEXTS.subtitle).toBe(
      "Quelques informations suffisent pour démarrer. Un conseiller de l'agence étudie votre demande et vous recontacte — aucune estimation chiffrée n'est communiquée par ce formulaire.",
    );
  });
});

describe("empty states with an accented word", () => {
  it.each([
    ["validationQueue", APP_TEXTS.validationQueue.emptyTitle, APP_TEXTS.validationQueue.emptyTitleAccent, "attente"],
    ["leadsInbox", APP_TEXTS.leadsInbox.emptyTitle, APP_TEXTS.leadsInbox.emptyTitleAccent, "entrant"],
    ["emmaFollowUps", APP_TEXTS.emmaFollowUps.emptyTitle, APP_TEXTS.emmaFollowUps.emptyTitleAccent, "relancer"],
    ["followThrough", APP_TEXTS.followThrough.emptyTitle, APP_TEXTS.followThrough.emptyTitleAccent, "suivre"],
    ["contacts", APP_TEXTS.contacts.emptyTitle, APP_TEXTS.contacts.emptyTitleAccent, "contact"],
    ["tasks", APP_TEXTS.tasks.emptyTitles.all, APP_TEXTS.tasks.emptyTitleAccent.all, "ouverte"],
    ["appointments", APP_TEXTS.appointments.emptyTitles.upcoming, APP_TEXTS.appointments.emptyTitleAccent.upcoming, "venir"],
    ["dossierJourney", APP_TEXTS.dossierJourney.emptyTitle, APP_TEXTS.dossierJourney.emptyTitleAccent, "traité"],
  ])("%s: the word appears exactly once, as a whole word", (_key, title, accent, expected) => {
    expect(accent).toBe(expected);
    expect(countAccent([title], accent)).toBe(1);
  });
});
