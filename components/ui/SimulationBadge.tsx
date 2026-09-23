import { APP_TEXTS } from "@/components/texts";

import { Badge } from "./Badge";
import { cn } from "./cn";

/**
 * Marks an action that was simulated (prototype): nothing left the system.
 *
 * Product guard rail (CLAUDE.md): a simulated action must never be mistaken for
 * a real send, so the badge is always visible and carries its own text — it is
 * never reduced to a colour or an icon alone.
 *
 * Motion (spec §2 A): a 3 px vertical drift over 3 s and a white dot pulsing
 * over 2 s. It stays a badge — not focusable, not clickable — and does not
 * grow. Still with `prefers-reduced-motion`.
 */
export function SimulationBadge({ className }: { className?: string }) {
  return (
    <Badge
      tone="solid"
      className={cn("simulation-badge", className)}
      title={APP_TEXTS.states.simulationHint}
      icon={<span className="simulation-dot" data-testid="simulation-dot" />}
    >
      {APP_TEXTS.states.simulation}
    </Badge>
  );
}
