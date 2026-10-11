import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";

const TEXTS = APP_TEXTS.guardRail;

export type GuardRailNoticeProps = {
  /** French reason returned by the server, displayed as-is (plain text). */
  reason: string;
  className?: string;
  testId?: string;
};

/**
 * An action refused by a guard rail. Informative on purpose (`Alert info`,
 * `role="status"`, never `role="alert"`): nothing broke, a rule of the agency
 * applied — the reason is shown exactly as the server wrote it.
 */
export function GuardRailNotice({ reason, className, testId }: GuardRailNoticeProps) {
  return (
    <Alert tone="info" title={TEXTS.title} className={className} testId={testId}>
      <p>
        <span className="font-medium text-ink">{TEXTS.reason} : </span>
        {reason}
      </p>
      <p className="mt-1 text-xs">{TEXTS.notAnError}</p>
    </Alert>
  );
}
