import { APP_TEXTS } from "@/components/texts";
import { Card } from "@/components/ui/Card";

import type { SettingsRetention } from "../types";

const TEXTS = APP_TEXTS.settings;

/**
 * « Conservation des données ». No period has been decided yet: the screen
 * says so, word for word, and never shows a duration.
 */
export function RetentionCard({ retention }: { retention: SettingsRetention }) {
  return (
    <Card title={TEXTS.retentionTitle} description={TEXTS.retentionSubtitle} testId="settings-retention">
      <p className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.retentionLabel}</p>
      {retention.status === "undefined" ? (
        <p
          data-testid="settings-retention-value"
          className="mt-2 inline-block rounded-md border border-dashed border-line-strong bg-surface-muted px-3 py-2 text-sm font-medium text-ink"
        >
          {TEXTS.retentionUndefined}
        </p>
      ) : null}
    </Card>
  );
}
