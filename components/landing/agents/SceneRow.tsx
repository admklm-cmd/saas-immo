import type { ReactNode } from "react";

import { cn } from "@/components/ui/cn";
import { Glyph } from "@/features/agents-ia/components/icons/Glyph";
import type { GlyphName } from "@/features/agents-ia/components/icons/glyphs";

/**
 * Tone of a row, always doubled by its words — carried by the small mark only,
 * the row itself has no border:
 *   * `done`   — done (filled black mark);
 *   * `flag`   — something is missing or held (dashed mark: not an error);
 *   * `active` — the current item of the step (cobalt ring, the only accent);
 *   * `muted`  — unavailable (sunken mark, struck-through label);
 *   * `plain`  — neutral information (pearl mark).
 */
export type SceneRowTone = "done" | "flag" | "active" | "muted" | "plain";

export type SceneRowProps = {
  glyph: GlyphName;
  label: ReactNode;
  detail?: ReactNode;
  tone?: SceneRowTone;
  testId?: string;
};

/** One line of a scene: a mark, a label, an optional detail. */
export function SceneRow({ glyph, label, detail, tone = "plain", testId }: SceneRowProps) {
  return (
    <div
      data-tone={tone}
      data-testid={testId}
      className={cn(
        "grid grid-cols-[1.75rem_1fr] items-start gap-3 rounded-lg px-2 py-2",
        tone === "active" && "bg-accent-soft",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-7 place-items-center rounded-full",
          tone === "done" && "bg-inverse text-ink-inverse",
          tone === "flag" && "border border-dashed border-ink text-ink",
          tone === "active" && "bg-surface text-accent-strong ring-[1.5px] ring-accent",
          tone === "muted" && "bg-surface-sunken text-ink-subtle",
          tone === "plain" && "bg-surface-sunken text-ink",
        )}
      >
        <Glyph name={glyph} width={14} />
      </span>
      <span className="min-w-0 pt-1">
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
