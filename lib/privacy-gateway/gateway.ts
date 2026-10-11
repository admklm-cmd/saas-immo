import "server-only";

/**
 * `createPrivacyGatewayProvider`: the ONLY constructor of an `AiProvider` that
 * talks to an external vendor.
 *
 * It owns one pseudonym session per execution. Lifecycle (driven by
 * `generateValidated`, lib/agents/ai-task.ts):
 *   generate()      sanitise (or refuse) -> transport.complete(sanitised request)
 *   restoreOutput() once the output passed its zod schema: pseudonyms -> values
 *   endRun()        the correspondence table is destroyed
 *
 * A refusal returns `privacy_gateway_refused` BEFORE any network call and the
 * journal only receives counters (`lastPrivacyAudit`), never a value.
 */

import { AGENT_ERROR_MESSAGES } from "@/lib/agents/messages";
import type { AiGeneration, AiGenerationRequest, AiPrivacyAudit, AiProvider } from "@/lib/claude/provider";
import { fail, type Result } from "@/lib/utils/result";

import { createPseudonymSession, type PseudonymSession } from "./pseudonyms";
import { isSanitizedRequest, sanitizeAiRequest } from "./sanitize";
import type { ExternalAiTransport } from "./types";

export type GatewayOptions = {
  /** Test seam: deterministic tags. Defaults to a random tag per execution. */
  randomTag?: () => string;
  /** Receives the counters-only audit of every call (default: server log). */
  onAudit?: (audit: AiPrivacyAudit) => void;
};

function defaultAudit(audit: AiPrivacyAudit): void {
  // Counters and field names only: no prompt, no value, no response.
  console.info(`[privacy-gateway] ${JSON.stringify(audit)}`);
}

export function createPrivacyGatewayProvider(
  transport: ExternalAiTransport,
  options: GatewayOptions = {},
): AiProvider {
  let session: PseudonymSession | null = null;
  let last: AiPrivacyAudit | null = null;
  const audit = options.onAudit ?? defaultAudit;

  return {
    name: transport.name,
    model: transport.model,
    isSimulation: false,

    async generate(request: AiGenerationRequest): Promise<Result<AiGeneration>> {
      if (!session || session.isDestroyed()) session = createPseudonymSession(options.randomTag);

      const outcome = sanitizeAiRequest(request, session);
      last = outcome.audit;
      audit(outcome.audit);

      if (!outcome.ok) {
        console.error(`[privacy-gateway] call refused (${outcome.reason}) for task "${request.task}"`);
        return fail("privacy_gateway_refused", AGENT_ERROR_MESSAGES.privacy_gateway_refused);
      }

      // Belt and braces: the type already forbids anything else.
      if (!isSanitizedRequest(outcome.request)) {
        return fail("privacy_gateway_refused", AGENT_ERROR_MESSAGES.privacy_gateway_refused);
      }

      return transport.complete(outcome.request);
    },

    restoreOutput(validated: unknown): Result<unknown> {
      if (!session || session.isDestroyed()) {
        return fail("pseudonym_session_destroyed", "Session de pseudonymisation terminée.");
      }
      return session.restore(validated);
    },

    lastPrivacyAudit(): AiPrivacyAudit | null {
      return last;
    },

    endRun(): void {
      session?.destroy();
      session = null;
    },
  };
}
