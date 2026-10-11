import { formatDate } from "@/components/format";
import { APP_TEXTS, CONSENT_STATUS_LABELS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  CONSENT_CHANNEL_LABELS,
  CONTACT_SOURCE_LABELS,
  type ConsentChannel,
  type ContactConsent,
} from "@/features/contacts/types";

const TEXTS = APP_TEXTS.contact;

/** Every channel is listed, including the ones without any consent row. */
const CHANNELS: readonly ConsentChannel[] = ["email", "sms", "whatsapp", "phone"];

/**
 * `consents.source` is free text. When it matches a known contact source, the
 * French label is shown instead of the raw value.
 */
function sourceLabel(source: string): string {
  return source in CONTACT_SOURCE_LABELS
    ? CONTACT_SOURCE_LABELS[source as keyof typeof CONTACT_SOURCE_LABELS]
    : source;
}

export function ContactConsentsCard({ consents }: { consents: readonly ContactConsent[] }) {
  const byChannel = new Map(consents.map((consent) => [consent.channel, consent]));

  return (
    <Card title={TEXTS.consentsTitle} description={TEXTS.consentsSubtitle}>
      <ul data-testid="contact-consents" className="flex flex-col divide-y divide-line">
        {CHANNELS.map((channel) => {
          const consent = byChannel.get(channel);
          return (
            <li
              key={channel}
              data-channel={channel}
              data-status={consent?.status ?? "none"}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{CONSENT_CHANNEL_LABELS[channel]}</p>
                {consent ? (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {TEXTS.consentRecordedAt} {formatDate(consent.recordedAt)} · {TEXTS.consentSource}{" "}
                    {sourceLabel(consent.source)}
                    {consent.textVersion ? ` · ${TEXTS.consentVersion} ${consent.textVersion}` : ""}
                  </p>
                ) : null}
              </div>
              {consent ? (
                <Badge tone={consent.status === "granted" ? "solid" : "dashed"}>
                  {CONSENT_STATUS_LABELS[consent.status]}
                </Badge>
              ) : (
                <Badge tone="dashed">{APP_TEXTS.contact.unknown}</Badge>
              )}
            </li>
          );
        })}
      </ul>

      {consents.length === 0 ? (
        <p className="mt-4 text-sm text-ink-subtle">{TEXTS.consentsEmpty}</p>
      ) : null}
    </Card>
  );
}
