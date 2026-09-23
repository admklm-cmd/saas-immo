import { formatDate } from "@/components/format";
import { APP_TEXTS, MEMBERSHIP_ROLE_LABELS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

import type { SettingsMember, SettingsSection } from "../types";
import { SectionUnavailable } from "./SectionUnavailable";

const TEXTS = APP_TEXTS.settings;

/**
 * « Équipe » — the members of the caller's agency only (the server resolves
 * the agency; the RPC re-checks it). Read-only: no invitation, no role change.
 */
export function TeamCard({ members }: { members: SettingsSection<SettingsMember[]> }) {
  return (
    <Card
      title={TEXTS.teamTitle}
      description={TEXTS.teamSubtitle}
      actions={members.status === "ok" ? <Badge tone="outline">{TEXTS.teamCount(members.value.length)}</Badge> : null}
      testId="settings-team"
      className="h-full"
    >
      {members.status !== "ok" ? (
        <SectionUnavailable />
      ) : members.value.length === 0 ? (
        <p className="text-sm text-ink-muted">{TEXTS.teamEmpty}</p>
      ) : (
        <ul className="-my-3 divide-y divide-line">
          {members.value.map((member) => (
            <li
              key={member.userId}
              data-testid="settings-member"
              data-current={member.isCurrentUser ? "true" : undefined}
              className="flex flex-col items-start gap-2 py-3 sm:flex-row sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium break-all text-ink">
                  {member.email ?? <span className="font-normal text-ink-subtle">{TEXTS.noEmail}</span>}
                  {member.isCurrentUser ? (
                    <span className="ml-1.5 font-normal text-ink-muted">{TEXTS.you}</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-ink-subtle">
                  <time dateTime={member.memberSince}>{TEXTS.memberSince(formatDate(member.memberSince))}</time>
                </p>
              </div>
              <Badge tone={member.role === "director" ? "outline" : "neutral"}>
                <span className="sr-only">{TEXTS.rolePrefix} </span>
                {MEMBERSHIP_ROLE_LABELS[member.role]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
