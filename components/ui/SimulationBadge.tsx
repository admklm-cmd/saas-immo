import { APP_TEXTS } from "@/components/texts";

import { Badge } from "./Badge";

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
      className={className}
      title={APP_TEXTS.states.simulationHint}
      icon={
        <svg viewBox="0 0 12 12" className="size-2.5 fill-current">
          <circle cx="6" cy="6" r="5" fillOpacity="0.35" />
          <circle cx="6" cy="6" r="2" />
        </svg>
      }
    >
      {APP_TEXTS.states.simulation}
    </Badge>
  );
}
