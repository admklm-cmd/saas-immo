"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";
import { Glyph } from "@/features/agents-ia/components/icons/Glyph";

import { isNavItemActive, NAV_GROUPS } from "./nav-items";

export type AppNavProps = {
  /**
   * `sidebar`: the fixed column of the desktop (≥ 1024 px).
   * `sheet`: the full-height panel of the compact navigation, larger touch targets.
   */
  variant?: "sidebar" | "sheet";
};

/**
 * Primary navigation of the signed-in space, in three groups
 * (docs/design-system.md §2.10). Client-side only for the current entry.
 *
 * Current entry: a white raised row, the label in medium weight, the glyph in
 * ink, and a thin cobalt mark on its left edge — cobalt says « you are here ».
 * Never the colour alone: `aria-current="page"` and the weight say it too.
 */
export function AppNav({ variant = "sidebar" }: AppNavProps) {
  const pathname = usePathname();
  const sheet = variant === "sheet";

  return (
    <nav aria-label={APP_TEXTS.nav.primaryLabel} data-variant={variant}>
      <div className={cn("flex flex-col", sheet ? "gap-7" : "gap-6")}>
        {NAV_GROUPS.map((group) => {
          const headingId = `nav-group-${variant}-${group.id}`;
          return (
            <div key={group.id} className={cn(!group.showLabel && "border-t border-line pt-4")}>
              <p
                id={headingId}
                className={cn(
                  "mb-1.5 px-3 text-overline font-semibold text-ink-subtle uppercase",
                  !group.showLabel && "sr-only",
                )}
              >
                {group.label}
              </p>
              <ul aria-labelledby={headingId} className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isNavItemActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        data-active={active ? "" : undefined}
                        className={cn(
                          "group/nav relative flex items-center gap-3 rounded-md px-3 whitespace-nowrap",
                          sheet ? "min-h-12 text-base" : "min-h-9 text-sm",
                          "transition-[background-color,color,box-shadow] duration-150 ease-standard",
                          active
                            ? "bg-surface font-medium text-ink shadow-subtle ring-1 ring-line"
                            : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                        )}
                      >
                        {/* The « you are here » mark: thin, cobalt, on the left edge. */}
                        <span
                          aria-hidden="true"
                          className={cn(
                            "absolute top-1/2 left-1 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent",
                            "transition-[opacity,scale] duration-200 ease-standard",
                            active ? "scale-y-100 opacity-100" : "scale-y-50 opacity-0",
                          )}
                        />
                        <Glyph
                          name={item.glyph}
                          width={sheet ? 20 : 18}
                          className={cn(
                            "shrink-0 transition-colors duration-150 ease-standard",
                            active ? "text-ink" : "text-ink-subtle group-hover/nav:text-ink",
                          )}
                        />
                        <span className="min-w-0 truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
