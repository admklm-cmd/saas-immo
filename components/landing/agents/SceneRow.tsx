import type { ComponentType, ReactNode } from "react";

import { cn } from "@/components/ui/cn";

type IconComponent = ComponentType<{ className?: string; width?: number | string; height?: number | string }>;

/**
 * Tone of a row, always doubled by its words:
 *   * `done`   — done (black tile);
 *   * `flag`   — something is missing or held (dashed grey/black: not an error);
 *   * `active` — the current item of the step (cobalt contour, the only accent);
 *   * `muted`  — unavailable (struck through, subdued);
 *   * `plain`  — neutral information.
 */
export type SceneRowTone = "done" | "flag" | "active" | "muted" | "plain";

export type SceneRowProps = {
  icon: IconComponent;
  label: ReactNode;
  detail?: ReactNode;
  tone?: SceneRowTone;
  testId?: string;
};

/** One line of a scene: a symbol, a label, an optional detail. */
export function SceneRow({ icon: Icon, label, detail, tone = "plain", testId }: SceneRowProps) {
  return (
    <div
      data-tone={tone}
      data-testid={testId}
      className={cn(
        "grid grid-cols-[1.75rem_1fr] items-start gap-3 rounded-md border px-3 py-2.5",
        tone === "flag" && "border-dashed border-ink-subtle bg-surface",
        tone === "active" && "border-accent bg-surface",
        tone === "muted" && "border-line bg-surface-sunken",
        (tone === "done" || tone === "plain") && "border-line bg-surface",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-7 place-items-center rounded-full",
          tone === "done" && "bg-inverse text-ink-inverse",
          tone === "flag" && "border border-dashed border-ink text-ink",
          tone === "active" && "border-[1.5px] border-accent text-accent-strong",
          tone === "muted" && "border border-line-strong text-ink-subtle",
          tone === "plain" && "border border-line-strong text-ink",
        )}
      >
        <Icon width={14} height={14} />
      </span>
      <span className="min-w-0 pt-0.5">
        <span
          className={cn(
            "block text-sm font-semibold",
            tone === "muted" ? "text-ink-muted line-through decoration-ink-subtle" : "text-ink",
          )}
        >
          {label}
        </span>
        {detail ? <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{detail}</span> : null}
      </span>
    </div>
  );
}
