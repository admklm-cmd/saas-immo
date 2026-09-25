import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { AgencyProfileCard } from "@/features/settings/components/AgencyProfileCard";
import { AgentsSettingsSection } from "@/features/settings/components/AgentsSettingsSection";
import { IntegrationsCard } from "@/features/settings/components/IntegrationsCard";
import { RetentionCard } from "@/features/settings/components/RetentionCard";
import { TeamCard } from "@/features/settings/components/TeamCard";
import { getAgencySettings } from "@/features/settings/queries";

const TEXTS = APP_TEXTS.settings;

export const metadata: Metadata = { title: `${TEXTS.title} — ${APP_TEXTS.brand.name}` };

/**
 * `/parametres` — read-only settings of the agency.
 *
 * Everything is read server-side by `getAgencySettings()` (session, agency and
 * role re-resolved; RLS applies). Each section is independent: a failed read
 * says « Indisponible » for that section only. The kill switch is the one
 * control that works here — the existing panel and action, same rules.
 * Only an invalid session or agency replaces the screen with an error.
 */
export default async function SettingsPage() {
  const { data: settings, error } = await getAgencySettings();

  return (
    <div className="page-frame page-frame-medium">
      <PageHeader
        title={TEXTS.title}
        description={TEXTS.subtitle}
        meta={<Badge tone="outline">{TEXTS.readOnlyBadge}</Badge>}
      />

      {error ? (
        <Alert
          tone="error"
          title={TEXTS.errorTitle}
          className="mt-8"
          testId="settings-error"
          action={
            <ButtonLink href="/parametres" variant="secondary" size="sm">
              {APP_TEXTS.states.retry}
            </ButtonLink>
          }
        >
          {error.message}
        </Alert>
      ) : (
        <>
          <Alert tone="info" title={TEXTS.readOnlyTitle} className="mt-8" testId="settings-read-only">
            {TEXTS.readOnlyBody}
          </Alert>

          <div className="mt-10 flex flex-col gap-12">
            <div className="grid gap-6 lg:grid-cols-2">
              <AgencyProfileCard agency={settings.agency} />
              <TeamCard members={settings.members} />
            </div>
            <AgentsSettingsSection agents={settings.agents} />
            <IntegrationsCard integrations={settings.integrations} />
            <RetentionCard retention={settings.retention} />
          </div>
        </>
      )}
    </div>
  );
}
