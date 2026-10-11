/**
 * Simulated AI provider — the only provider wired in the prototype.
 *
 * Deterministic, offline, free: no network call, no API key, nothing billed
 * (CLAUDE.md: "Simulateur d'abord"). Everything it produces is flagged
 * `is_simulation` down to the CRM history, so a simulated action can never be
 * mistaken for a real one.
 *
 * It answers only for the tasks it knows; an unknown task is an explicit error,
 * never a made-up answer.
 */

import { fail, ok, type Result } from "@/lib/utils/result";

import { buildPromptInput } from "./prompt";
import type { AiGeneration, AiGenerationRequest, AiProvider, AiTaskName } from "./provider";
import { simulateEmmaFollowUp } from "./simulations/emma-relation";
import { simulateHugoQualification } from "./simulations/hugo-qualification";
import { simulateLeaAcquisition } from "./simulations/lea-acquisition";
import { simulateLouisAppointment } from "./simulations/louis-rendez-vous";
import { simulateSarahFollowThrough } from "./simulations/sarah-suivi";

export const SIMULATOR_NAME = "simulator";
export const SIMULATOR_MODEL = "simulator-v1";

const GENERATORS: Record<AiTaskName, (request: AiGenerationRequest) => unknown> = {
  lea_acquisition: simulateLeaAcquisition,
  hugo_qualification: simulateHugoQualification,
  emma_follow_up: simulateEmmaFollowUp,
  louis_appointment: simulateLouisAppointment,
  sarah_follow_through: simulateSarahFollowThrough,
};

/** Rough, deterministic token estimate (~4 characters per token). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function createSimulatorProvider(): AiProvider {
  return {
    name: SIMULATOR_NAME,
    model: SIMULATOR_MODEL,
    isSimulation: true,

    async generate(request: AiGenerationRequest): Promise<Result<AiGeneration>> {
      const generator = GENERATORS[request.task];
      if (!generator) {
        return fail(
          "ai_provider_unavailable",
          "Le simulateur ne sait pas traiter cette tâche. Aucune action n'a été effectuée.",
        );
      }

      const promptInput = buildPromptInput(request);
      const raw = generator(request);

      return ok({
        raw,
        usage: {
          provider: SIMULATOR_NAME,
          model: SIMULATOR_MODEL,
          inputTokens: estimateTokens(request.systemPrompt) + estimateTokens(promptInput),
          outputTokens: estimateTokens(JSON.stringify(raw ?? null)),
        },
      });
    },
  };
}
