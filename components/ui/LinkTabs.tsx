import Link from "next/link";

import { cn } from "./cn";

export type LinkTab = {
  /** Stable key, also exposed as `data-tab` for tests. */
  key: string;
  href: string;
  label: string;
  current: boolean;
};

export type LinkTabsProps = {
  /** Accessible name of the navigation (« Filtrer les tâches »). */
  label: string;
  tabs: readonly LinkTab[];
  className?: string;
  testId?: string;
};

/**
 * Segmented filter made of links: each choice is a URL, so the view survives a
 * reload, a shared link and the back button, and works without JavaScript.
 *
 * Links, not an ARIA tablist: choosing one loads another list. The current one
 * carries `aria-current="page"` and is marked by an inverted pill AND a heavier
 * weight — never by colour alone.
 */
export function LinkTabs({ label, tabs, className, testId }: LinkTabsProps) {
  return (
    <nav aria-label={label} data-testid={testId} className={cn("max-w-full overflow-x-auto", className)}>
      <ul className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-muted p-1">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={tab.href}
              data-tab={tab.key}
              aria-current={tab.current ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center rounded-full px-4 text-sm whitespace-nowrap",
                "transition-[background-color,color,box-shadow] duration-150 ease-standard",
                tab.current
                  ? "bg-inverse font-semibold text-ink-inverse shadow-subtle"
                  : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
