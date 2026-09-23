import { APP_TEXTS } from "@/components/texts";

import { Badge } from "./Badge";
import { cn } from "./cn";

/**
 * Marks an action that was simulated (prototype): nothing left the system.
 *
 * Product guard rail (CLAUDE.md): a simulated action must never be mistaken for
 * a real send, so the badge is always visible and carries its own text — it is
 * never reduced to a colour or an icon alone.
 */
export function SimulationBadge({ className }: { className?: string }) {
  return (
    <Badge
      tone="solid"
      className={cn("simulation-float", className)}
      title={APP_TEXTS.states.simulationHint}
      icon={
        <span className="simulation-dot" />
      }
    >
      {APP_TEXTS.states.simulation}
    </Badge>
  );
}
