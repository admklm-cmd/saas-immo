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
 *
 * `surface="dark"` (near-black panel of the landing, docs/design-system.md
 * §2.11.8.5): the same badge inverted, light chip and ink text. The default
 * (`light`) is unchanged; the CRM never passes it.
 */
export function SimulationBadge({ className, surface = "light" }: { className?: string; surface?: "light" | "dark" }) {
  return (
    <Badge
      tone={surface === "dark" ? "solid-light" : "solid"}
      className={cn("simulation-badge", className)}
      title={APP_TEXTS.states.simulationHint}
      icon={<span className="simulation-dot" data-testid="simulation-dot" />}
    >
      {APP_TEXTS.states.simulation}
    </Badge>
  );
}
