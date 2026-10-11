import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import * as runner from "./runner";
import { ELIGIBILITY_BLOCKING_CODES, GUARD_BLOCKING_CODES, runStatusForRefusal } from "./run-status";

/**
 * `run-status.ts` and `outcome.ts` are imported by CLIENT components. Nothing
 * server-side (runner, Supabase clients, AI provider, `server-only`, secrets)
 * may be reachable from them, or it would end up in the browser bundle.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

function importSpecifiers(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(/^\s*(?:import|export)[^;]*?from\s+["']([^"']+)["']/gm)].map((match) => match[1]!);
}

describe("run-status — module pur, sûr pour le navigateur", () => {
  it("n'importe que ./messages (aucun runner, client Supabase, fournisseur IA ni server-only)", () => {
    expect(importSpecifiers(path.join(HERE, "run-status.ts"))).toEqual(["./messages"]);
  });

  it("messages.ts n'importe rien", () => {
    expect(importSpecifiers(path.join(HERE, "messages.ts"))).toEqual([]);
  });

  it("outcome.ts (composants client) n'importe pas le runner serveur", () => {
    const specifiers = importSpecifiers(path.join(ROOT, "features", "agents-ia", "components", "outcome.ts"));
    expect(specifiers).toEqual(["@/lib/agents/messages", "@/lib/agents/run-status"]);
    expect(specifiers.some((specifier) => /runner|supabase|claude|server-only/.test(specifier))).toBe(false);
  });

  it("le runner réexporte exactement la même classification", () => {
    expect(runner.runStatusForRefusal).toBe(runStatusForRefusal);
    expect(runner.ELIGIBILITY_BLOCKING_CODES).toBe(ELIGIBILITY_BLOCKING_CODES);
  });

  it("garde-fous partagés : « bloqué »", () => {
    for (const code of GUARD_BLOCKING_CODES) expect(runStatusForRefusal(code), code).toBe("blocked");
  });
});
