import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FIXTURE_PHONE_PREFIXES } from "./fixture-ids";

/**
 * Static guard: every French phone number written in a test that touches the
 * local database (Vitest integration tests, Playwright journeys) must belong to
 * one of the Arcep fiction blocks used by the fixtures (see fixture-ids.ts).
 *
 * Why a static check: `fixtures.integration.test.ts` only inspects the two
 * fixture agencies, because other integration tests create throw-away agencies
 * IN PARALLEL on the same local base — a whole-base check was racy (it failed
 * whenever it ran while such a test had a contact on screen). The invariant
 * "no test ever stores a number that could belong to a real person" is now
 * proved here, deterministically, on the source that writes the rows.
 */

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SKIPPED_DIRECTORIES = new Set(["node_modules", ".next", ".git", "playwright-report", "test-results"]);

/** "+33 6 39 98 10 03", "+33600000000", "06 39 98 10 03", "0639981003", "06.39.98.10.03"… */
const FRENCH_PHONE = /(?:\+33[\s.-]?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/g;

const ALLOWED_PREFIXES = Object.values(FIXTURE_PHONE_PREFIXES).map((prefix) => prefix.replace(/\D/g, ""));

/** National form, digits only: "+33 6 39 98 10 03" -> "0639981003". */
function toNationalDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("33") && raw.trim().startsWith("+") ? `0${digits.slice(2)}` : digits;
}

function isFictionPhoneNumber(raw: string): boolean {
  const national = toNationalDigits(raw);
  return national.length === 10 && ALLOWED_PREFIXES.some((prefix) => national.startsWith(prefix));
}

function listFiles(directory: string, accept: (path: string) => boolean, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) listFiles(join(directory, entry.name), accept, found);
    } else if (accept(join(directory, entry.name))) {
      found.push(join(directory, entry.name));
    }
  }
  return found;
}

function databaseWritingTestFiles(): string[] {
  return listFiles(ROOT, (path) => {
    const rel = relative(ROOT, path).split(sep).join("/");
    return rel.endsWith(".integration.test.ts") || (rel.startsWith("e2e/") && rel.endsWith(".ts"));
  });
}

describe("numéros de téléphone des tests : tranches de fiction Arcep uniquement", () => {
  it("reconnaît les formats usuels et refuse un numéro réel", () => {
    expect(isFictionPhoneNumber("06 39 98 10 03")).toBe(true);
    expect(isFictionPhoneNumber("+33 6 39 98 10 03")).toBe(true);
    expect(isFictionPhoneNumber("0465711234")).toBe(true);
    expect(isFictionPhoneNumber("+33600000000")).toBe(false);
    expect(isFictionPhoneNumber("06 12 34 56 78")).toBe(false);
    expect("id 20260923120000 a0612345678".match(FRENCH_PHONE)).toBeNull();
  });

  it("aucun test d'intégration ni parcours E2E n'écrit un numéro hors fiction", () => {
    const files = databaseWritingTestFiles();
    // Sanity: the scan really sees the files it is meant to guard.
    expect(files.some((file) => file.endsWith("louis.integration.test.ts"))).toBe(true);

    const offenders: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        for (const match of line.matchAll(FRENCH_PHONE)) {
          if (!isFictionPhoneNumber(match[0])) {
            offenders.push(`${relative(ROOT, file)}:${index + 1} « ${match[0]} »`);
          }
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
