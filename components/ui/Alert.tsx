import type { ReactNode } from "react";

import { cn } from "./cn";

export type AlertTone = "error" | "success" | "info";

const TONES: Record<AlertTone, string> = {
  // Highest salience available without colour: inverted surface.
  error: "border-inverse bg-inverse text-ink-inverse",
  success: "border-line-strong bg-surface-muted text-ink",
  info: "border-line bg-surface-muted text-ink",
};

const GLYPHS: Record<AlertTone, string> = {
  error: "!",
  success: "✓",
  info: "i",
};

export type AlertProps = {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  /** Optional action (retry, go back…). */
  action?: ReactNode;
  className?: string;
  /** Hook for E2E tests (`data-testid`). */
  testId?: string;
};

export function Alert({ tone = "info", title, children, action, className, testId }: AlertProps) {
  return (
    <div
      data-testid={testId}
      // Errors interrupt; confirmations are announced politely.
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex animate-fade items-start gap-3 rounded-lg border px-4 py-3.5 text-sm",
        TONES[tone],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          tone === "error" ? "bg-white/15 text-ink-inverse" : "bg-inverse text-ink-inverse",
        )}
      >
        {GLYPHS[tone]}
      </span>
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? (
          <div className={cn(title ? "mt-1" : "", tone === "error" ? "text-ink-inverse-muted" : "text-ink-muted")}>
            {children}
          </div>
        ) : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
