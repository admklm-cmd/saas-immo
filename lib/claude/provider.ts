/**
 * Common interface of the AI provider used by the product agents.
 *
 * Folder name imposed by CLAUDE.md (`lib/claude/`), but nothing here depends on
 * a concrete vendor: the provider is interchangeable. Today the only wired
 * implementation is the deterministic simulator (`simulator.ts`), because no
 * budget is defined for a paid AI API (see CLAUDE.md, "IA du produit vs IA de
 * développement").
 *
 * Two non-negotiable rules are baked into this contract:
 *  1. A provider returns RAW, UNVALIDATED output (`AiGeneration.raw`). It is the
 *     caller's job to validate it with a zod schema before any use
 *     (`lib/agents/ai-task.ts`).
 *  2. Prospect-provided content is passed in `untrusted`, never merged into the
 *     system prompt: it is DATA, never an instruction (`prompt.ts`).
 */

import type { Result } from "@/lib/utils/result";

/** Tasks a provider can be asked to perform. One entry per product agent. */
export const AI_TASKS = [
  "lea_acquisition",
  "hugo_qualification",
  "emma_follow_up",
  "louis_appointment",
  "sarah_follow_through",
] as const;
export type AiTaskName = (typeof AI_TASKS)[number];

/**
 * Simulator-only scenarios, used by the tests to prove that the guard rails
 * work. Real providers ignore this field.
 *  - `auto`: normal deterministic answer built from the inputs;
 *  - `invalid_output`: structurally invalid answer (must be rejected by zod);
 *  - `partial_output`: schema-valid answer with every business field missing
 *    (must lead to "no action + task for a human", nothing invented);
 *  - `out_of_scope_choice`: answer that picks an option OUTSIDE the closed list
 *    computed by the code (must be rejected, no action at all).
 */
export const AI_SCENARIOS = ["auto", "invalid_output", "partial_output", "out_of_scope_choice"] as const;
export type AiScenario = (typeof AI_SCENARIOS)[number];

/** Trusted, structured facts coming from the CRM. Never free prospect text. */
export type AiFactValue = string | number | boolean | null;
export type AiFacts = Readonly<Record<string, AiFactValue>>;

/** A piece of content written by a prospect: untrusted data. */
export type AiUntrustedField = {
  /** Where the content comes from, e.g. "contact_notes". */
  label: string;
  content: string;
};

/**
 * A closed list of options computed BY THE CODE, from which the model must pick
 * exactly one, by identifier. This is how a decision that has legal or business
 * consequences (which time slot, which template) stays in the code's hands: the
 * model only chooses inside a set that is already known to be valid, and the
 * caller's zod schema rejects any identifier outside the list.
 */
export type AiChoice = {
  /** Stable identifier the model must echo back, e.g. "creneau-1". */
  id: string;
  /** Human-readable description shown in the prompt, e.g. a formatted slot. */
  label: string;
};

/**
 * What the Privacy Gateway needs to know about the dossier to recognise it in
 * free text (names, the agency, the contact's own email and phone). It is read
 * by the gateway ONLY: it is never part of a prompt, and the simulator ignores
 * it. Every field is optional, but the `privacy` object itself is mandatory for
 * every task that goes through the gateway (fail closed, see
 * lib/privacy-gateway/policies.ts).
 */
export type AiPrivacyContext = {
  persons?: readonly { firstName?: string | null; lastName?: string | null }[];
  agencyName?: string | null;
  emails?: readonly (string | null | undefined)[];
  phones?: readonly (string | null | undefined)[];
};

export type AiGenerationRequest = {
  task: AiTaskName;
  /** Versioned system prompt of the agent (see features/agents-ia/<agent>/prompt.ts). */
  systemPrompt: string;
  /** Stable version identifier of that prompt, journaled with the run. */
  promptVersion: string;
  facts: AiFacts;
  /** Closed set of options the model may choose from (trusted, code-computed). */
  choices?: readonly AiChoice[];
  untrusted?: readonly AiUntrustedField[];
  /** Dossier knowledge for the Privacy Gateway; never sent to any provider. */
  privacy?: AiPrivacyContext;
  /** Simulator-only; ignored by real providers. */
  scenario?: AiScenario;
  /** 1-based attempt number when the previous output failed validation. */
  attempt?: number;
};

/** Token accounting, journaled per agency to follow the cost of the agents. */
export type AiUsage = {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type AiGeneration = {
  /** RAW output: never use it before validating it with a zod schema. */
  raw: unknown;
  usage: AiUsage;
};

/**
 * Technical audit of one external call: counters and field NAMES only, never a
 * value (Privacy Gateway rule 8). Safe to journal and to display.
 */
export type AiPrivacyAudit = {
  task: AiTaskName;
  outcome: "sent" | "refused";
  /** Stable refusal reason when `outcome` is "refused". */
  reason: string | null;
  /** Number of identifiers replaced by a pseudonym, per type (EMAIL, TEL…). */
  replaced: Readonly<Record<string, number>>;
  facts_sent: readonly string[];
  untrusted_fields_sent: readonly string[];
  untrusted_chars: number;
};

export interface AiProvider {
  /** Stable provider identifier, stored in `ai_agent_runs.provider`. */
  readonly name: string;
  /** Model identifier, stored in `ai_agent_runs.model`. */
  readonly model: string;
  /** True when nothing real is called and nothing is billed. */
  readonly isSimulation: boolean;
  generate(request: AiGenerationRequest): Promise<Result<AiGeneration>>;
  /**
   * Optional hook, called by `generateValidated` ONCE the output passed its zod
   * schema: gives back the real values behind the pseudonyms (local
   * re-identification). An error means the output cannot be used (e.g. an
   * unknown or forged pseudonym); the caller then treats it as invalid.
   */
  restoreOutput?(validated: unknown): Result<unknown>;
  /** Optional hook: audit of the last call (counters only). */
  lastPrivacyAudit?(): AiPrivacyAudit | null;
  /** Optional hook: releases per-execution resources (pseudonym table). */
  endRun?(): void;
}

export function emptyUsage(provider: AiProvider): AiUsage {
  return { provider: provider.name, model: provider.model, inputTokens: 0, outputTokens: 0 };
}

export function addUsage(total: AiUsage, next: AiUsage): AiUsage {
  return {
    provider: next.provider,
    model: next.model,
    inputTokens: total.inputTokens + next.inputTokens,
    outputTokens: total.outputTokens + next.outputTokens,
  };
}
