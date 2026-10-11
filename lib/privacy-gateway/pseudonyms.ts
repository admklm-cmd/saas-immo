import "server-only";

/**
 * Ephemeral pseudonyms of ONE execution.
 *
 * Rules (audit §3, rules 3 and 4):
 *  - tokens differ at every execution: each carries a random 8-hex-digit tag
 *    (`[EMAIL_1_9f3a07c2]`), so a token seen in one run is meaningless in the
 *    next and a prospect cannot forge one;
 *  - the correspondence table lives in memory only, inside this closure; it is
 *    never serialised, logged or persisted, and `destroy()` wipes it.
 */

import { randomBytes } from "node:crypto";

import { fail, ok, type Result } from "@/lib/utils/result";

import { phoneDigits } from "./detectors";
import { PSEUDONYM_TYPES, type PseudonymType, type ReplacementCounts } from "./types";

const TYPE_ALTERNATION = PSEUDONYM_TYPES.join("|");
/** Any token shaped like ours, whatever its tag: used to detect forgeries. */
const LOOSE_TOKEN = /\[(?:[A-Z]{2,10})_\d{1,4}_[0-9A-Za-z]{4,16}\]/g;
const STRICT_TOKEN = new RegExp(`^\\[(${TYPE_ALTERNATION})_(\\d{1,4})_([0-9a-f]{8})\\]$`);

export type PseudonymSession = {
  /** Random tag of this execution (also part of every token). */
  readonly tag: string;
  /** Returns the token standing for `value`, creating it on first use. */
  pseudonymize(type: PseudonymType, value: string, canonical?: string): string;
  /** Neutralises anything in `text` that looks like a token of ours. */
  neutralise(text: string): string;
  /** Replaces tokens by the real values, deeply; fails on an unknown token. */
  restore(value: unknown): Result<unknown>;
  /** Occurrences replaced so far, per type. */
  counts(): ReplacementCounts;
  isDestroyed(): boolean;
  /** Wipes the table. Further `restore` calls fail, `pseudonymize` throws. */
  destroy(): void;
};

function normaliseKey(type: PseudonymType, value: string): string {
  const trimmed = value.trim();
  if (type === "TEL") return `${type}:${phoneDigits(trimmed)}`;
  if (type === "EMAIL" || type === "URL" || type === "ID") return `${type}:${trimmed.toLowerCase()}`;
  if (type === "IBAN" || type === "SECU" || type === "CARTE") return `${type}:${trimmed.replace(/[\s.-]/g, "").toLowerCase()}`;
  return `${type}:${trimmed.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")}`;
}

export function createPseudonymSession(randomTag: () => string = defaultTag): PseudonymSession {
  const tag = randomTag();
  let valueByToken: Map<string, string> | null = new Map();
  let tokenByKey: Map<string, string> | null = new Map();
  let nextIndex: Partial<Record<PseudonymType, number>> = {};
  let counts: ReplacementCounts = {};

  const requireTable = () => {
    if (!valueByToken || !tokenByKey) throw new Error("pseudonym session destroyed");
    return { valueByToken, tokenByKey };
  };

  function restoreString(text: string, table: Map<string, string>): Result<string> {
    const found = text.match(LOOSE_TOKEN);
    if (!found) return ok(text);
    for (const token of found) {
      const strict = STRICT_TOKEN.exec(token);
      // Wrong shape, wrong tag (another execution) or unknown index: forged.
      if (!strict || strict[3] !== tag || !table.has(token)) {
        return fail("pseudonym_unknown", "Pseudonyme inconnu dans la réponse de l'IA.");
      }
    }
    return ok(text.replace(LOOSE_TOKEN, (token) => table.get(token) ?? token));
  }

  function restoreDeep(value: unknown, table: Map<string, string>, depth: number): Result<unknown> {
    if (depth > 12) return fail("pseudonym_depth", "Réponse de l'IA trop profonde.");
    if (typeof value === "string") return restoreString(value, table);
    if (Array.isArray(value)) {
      const out: unknown[] = [];
      for (const item of value) {
        const restored = restoreDeep(item, table, depth + 1);
        if (restored.error) return restored;
        out.push(restored.data);
      }
      return ok(out);
    }
    if (value !== null && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) {
        const restored = restoreDeep(item, table, depth + 1);
        if (restored.error) return restored;
        out[key] = restored.data;
      }
      return ok(out);
    }
    return ok(value);
  }

  return {
    tag,

    pseudonymize(type, value, canonical) {
      const { valueByToken: values, tokenByKey: tokens } = requireTable();
      const key = normaliseKey(type, canonical ?? value);
      let token = tokens.get(key);
      if (!token) {
        const index = (nextIndex[type] ?? 0) + 1;
        nextIndex[type] = index;
        token = `[${type}_${index}_${tag}]`;
        tokens.set(key, token);
        values.set(token, canonical ?? value);
      }
      counts[type] = (counts[type] ?? 0) + 1;
      return token;
    },

    neutralise(text) {
      return text.replace(LOOSE_TOKEN, "[…]");
    },

    restore(value) {
      if (!valueByToken) return fail("pseudonym_session_destroyed", "Session de pseudonymisation terminée.");
      return restoreDeep(value, valueByToken, 0);
    },

    counts() {
      return { ...counts };
    },

    isDestroyed() {
      return valueByToken === null;
    },

    destroy() {
      valueByToken?.clear();
      tokenByKey?.clear();
      valueByToken = null;
      tokenByKey = null;
      nextIndex = {};
      counts = {};
    },
  };
}

function defaultTag(): string {
  return randomBytes(4).toString("hex");
}
