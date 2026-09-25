import { cn } from "@/components/ui/cn";

export type StopMarkProps = {
  /** `md` (16 px) on a rail or a gate track, `sm` (12 px) inline in a line of text. */
  size?: "sm" | "md";
  /** `ink`: the flow really stops here. `muted`: a closed gate the flow never reached. */
  tone?: "ink" | "muted";
  className?: string;
};

/**
 * The stop mark — the one sign, shared by the landing, the rail of
 * /agents-ia and the work screens, that says « the flow stops here »: a short
 * vertical bar across the line (docs/design-system.md §3.1.3).
 *
 * Decorative (`aria-hidden`): the reason is always written next to it, or
 * announced by a text read with the line it belongs to. Never red, never an
 * icon of danger: a guard rail doing its job is not an error.
 */
export function StopMark({ size = "md", tone = "ink", className }: StopMarkProps) {
  return (
    <span
      aria-hidden="true"
      data-stop-mark=""
      data-tone={tone}
      className={cn(
        "inline-block w-0.5 shrink-0 rounded-full",
        size === "md" ? "h-4" : "h-3",
        tone === "ink" ? "bg-ink" : "bg-line-strong",
        className,
      )}
    />
  );
}
