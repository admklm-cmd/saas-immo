import { ChevronRightIcon } from "@radix-ui/react-icons";
import type { ReactNode } from "react";

import { cn } from "./cn";

export type DisclosureProps = {
  /** Visible label of the toggle (the `<summary>`): says what is folded. */
  summary: ReactNode;
  /** Short line under the label, still inside the toggle (optional). */
  hint?: ReactNode;
  /** Right side of the toggle row: a count, a badge… (optional). */
  aside?: ReactNode;
  children: ReactNode;
  /** Closed by default. Open only when the user asked for it (e.g. filters in the URL). */
  defaultOpen?: boolean;
  /** `card`: bordered white surface; `inline`: a quiet line inside a card or a row. */
  variant?: "card" | "inline";
  /** Text size of an `inline` toggle: `sm` (default) or `xs`, for a hint line under figures. */
  size?: "sm" | "xs";
  className?: string;
  /** Classes of the folded content. */
  contentClassName?: string;
  /** Wraps the label in a heading, so a folded section still appears in the page outline. */
  headingLevel?: 2 | 3;
  id?: string;
  testId?: string;
};

/**
 * Native `<details>` / `<summary>` disclosure.
 *
 * Chosen over a scripted toggle on purpose: it works without JavaScript (Server
 * Component), the browser exposes it as an expandable control to assistive
 * technology, it is reachable with Tab and toggled with Enter or Space, and
 * Chrome opens it by itself when a fragment or a find-in-page targets its
 * content. The global `:focus-visible` ring applies to the summary.
 *
 * Closed by default: technical detail, history and long explanations are one
 * click away, never in the way.
 */
export function Disclosure({
  summary,
  hint,
  aside,
  children,
  defaultOpen = false,
  variant = "inline",
  size = "sm",
  className,
  contentClassName,
  headingLevel,
  id,
  testId,
}: DisclosureProps) {
  const card = variant === "card";
  const Label = headingLevel === 2 ? "h2" : headingLevel === 3 ? "h3" : "span";
  return (
    <details
      id={id}
      open={defaultOpen || undefined}
      data-testid={testId}
      className={cn(
        "disclosure group/disclosure",
        card && "rounded-xl border border-line bg-surface shadow-subtle",
        className,
      )}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden",
          !card && size === "xs" ? "gap-2" : "gap-3",
          card ? "rounded-xl px-6 py-5 hover:bg-surface-muted" : cn("w-fit rounded-xs text-ink-muted hover:text-ink", size === "xs" ? "text-xs" : "text-sm"),
          "transition-colors duration-150 ease-standard",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "grid shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-ink",
            "transition-[rotate] duration-(--duration-press) ease-standard group-open/disclosure:rotate-90",
            card ? "size-7" : size === "xs" ? "size-4" : "size-5",
          )}
        >
          <ChevronRightIcon width={card ? 16 : size === "xs" ? 10 : 12} height={card ? 16 : size === "xs" ? 10 : 12} />
        </span>
        <span className="min-w-0 flex-1">
          <Label className={cn("block", card ? "text-section font-bold text-ink" : size === "xs" ? "font-normal" : "font-medium")}>
            {summary}
          </Label>
          {hint ? <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span> : null}
        </span>
        {aside ? <span className="shrink-0">{aside}</span> : null}
      </summary>
      <div className={cn(card ? "border-t border-line px-6 py-5" : "pt-3", contentClassName)}>{children}</div>
    </details>
  );
}
