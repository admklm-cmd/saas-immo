import { APP_TEXTS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SimulationBadge } from "@/components/ui/SimulationBadge";

import type { SettingsIntegration, SettingsIntegrationCategory } from "../types";

const TEXTS = APP_TEXTS.settings;

/** Display order: where a lead comes from, how it is contacted, when it is met. */
const CATEGORY_ORDER: readonly SettingsIntegrationCategory[] = ["real_estate_software", "messaging", "calendar"];

function simulatesLabel(integration: SettingsIntegration): string {
  return integration.simulates ? TEXTS.integrationSimulates[integration.simulates] : TEXTS.integrationSimulates.none;
}

/**
 * « Intégrations ». Nothing is connected in the prototype: every entry carries
 * « Simulation » and « Non connectée » in words, and says what — if anything —
 * is simulated in its place. No key, no token, no setting is ever shown.
 */
export function IntegrationsCard({ integrations }: { integrations: readonly SettingsIntegration[] }) {
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: integrations.filter((integration) => integration.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <Card title={TEXTS.integrationsTitle} description={TEXTS.integrationsSubtitle} testId="settings-integrations">
      <div className="grid gap-8 lg:grid-cols-3 lg:gap-6">
        {groups.map((group) => (
          <section key={group.category} aria-labelledby={`settings-integrations-${group.category}`}>
            <h3
              id={`settings-integrations-${group.category}`}
              className="text-overline font-semibold text-ink-subtle uppercase"
            >
              {TEXTS.integrationCategories[group.category]}
            </h3>
            <ul className="mt-3 flex flex-col gap-3">
              {group.items.map((integration) => (
                <li
                  key={integration.key}
                  data-testid="settings-integration"
                  data-integration={integration.key}
                  className="rounded-lg border border-line bg-surface-muted px-4 py-3.5"
                >
                  <p className="text-sm font-medium text-ink">{integration.name}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <SimulationBadge />
                    <Badge tone="dashed">{TEXTS.notConnected}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-ink-muted">{simulatesLabel(integration)}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  );
}
