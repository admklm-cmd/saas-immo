import { CrossCircledIcon, LockClosedIcon } from "@radix-ui/react-icons";

import { RUN_OUTCOME_LABELS } from "@/components/texts";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { AgentRunStatus } from "@/lib/agents/messages";

/**
 * Outcome of one AI run, named without ambiguity.
 *
 * `failed` (a real technical error) keeps the strongest emphasis: inverted
 * chip. `blocked` (a guard rail doing its job) is outlined, with a padlock and
 * the words « Bloquée par un garde-fou » — it must never look like an error.
 * The label always carries the meaning; tone and glyph only reinforce it.
 */
const TONES: Record<AgentRunStatus, BadgeTone> = {
  failed: "solid",
  blocked: "outline",
  running: "dashed",
  succeeded: "neutral",
};

export function RunStatusBadge({ status }: { status: AgentRunStatus }) {
  const icon =
    status === "blocked" ? (
      <LockClosedIcon className="size-3" />
    ) : status === "failed" ? (
      <CrossCircledIcon className="size-3" />
    ) : undefined;

  return (
    <Badge tone={TONES[status]} icon={icon}>
      <span data-testid="run-status" data-status={status}>
        {RUN_OUTCOME_LABELS[status]}
      </span>
    </Badge>
  );
}
