import { APP_TEXTS } from "@/components/texts";
import { Card } from "@/components/ui/Card";
import { DataList } from "@/components/ui/DataList";

import type { SettingsAgencyProfile, SettingsSection } from "../types";
import { SectionUnavailable } from "./SectionUnavailable";

const TEXTS = APP_TEXTS.settings;

/** An empty value reads « Non renseigné », in a quieter tone: never a guess. */
function valueOrMissing(value: string | null) {
  const text = value?.trim();
  return text ? text : <span className="text-ink-subtle">{TEXTS.notProvided}</span>;
}

/** « Agence » — name, city and sector, exactly as recorded. */
export function AgencyProfileCard({ agency }: { agency: SettingsSection<SettingsAgencyProfile> }) {
  return (
    <Card
      title={TEXTS.agencyTitle}
      description={TEXTS.agencySubtitle}
      testId="settings-agency"
      className="h-full"
    >
      {agency.status === "ok" ? (
        <DataList
          columns={1}
          items={[
            { label: TEXTS.agencyName, value: valueOrMissing(agency.value.name) },
            { label: TEXTS.agencyCity, value: valueOrMissing(agency.value.city) },
            { label: TEXTS.agencySector, value: valueOrMissing(agency.value.sector) },
          ]}
        />
      ) : (
        <SectionUnavailable />
      )}
    </Card>
  );
}
