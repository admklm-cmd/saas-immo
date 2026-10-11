"use client";

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "./cn";

export type TabItem = {
  /** Stable key, also exposed as `data-tab`. */
  key: string;
  label: ReactNode;
  /** Content of the panel. Every panel stays in the HTML; inactive ones are `hidden`. */
  panel: ReactNode;
};

export type TabsProps = {
  /** Accessible name of the tab list. */
  label: string;
  tabs: readonly TabItem[];
  defaultKey?: string;
  className?: string;
  /** Classes of each panel. */
  panelClassName?: string;
  testId?: string;
};

type Box = { left: number; width: number };

/**
 * Tabs that switch a view in place (WAI-ARIA « tabs » pattern, automatic
 * activation): `role="tablist"` / `tab` / `tabpanel`, `aria-selected`,
 * `aria-controls`, one tab in the Tab order (roving `tabindex`), ← → Home End.
 *
 * Only where a view is switched without leaving the page (dossier / exécution).
 * A choice that loads another list stays a link (`LinkTabs`).
 *
 * The active capsule MOVES from the old tab to the new one (FLIP: measure, invert
 * with `transform`, play with `--duration-interactive`) — transform only, no
 * layout property animated. Reduced motion: the global rule makes it instant.
 * The selected tab is also written in semibold: never the capsule alone.
 */
export function Tabs({ label, tabs, defaultKey, className, panelClassName, testId }: TabsProps) {
  const baseId = useId();
  const [active, setActive] = useState(defaultKey ?? tabs[0]?.key ?? "");
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const capsuleRef = useRef<HTMLSpanElement>(null);
  const previous = useRef<Box | null>(null);

  useLayoutEffect(() => {
    const capsule = capsuleRef.current;
    const tab = tabRefs.current.get(active);
    if (!capsule || !tab) return;
    const next = { left: tab.offsetLeft, width: tab.offsetWidth };
    const before = previous.current;
    previous.current = next;
    if (!before || before.width === 0 || next.width === 0) return;
    if (before.left === next.left && before.width === next.width) return;

    // Invert: the capsule is drawn in the new tab, sent back where it was…
    capsule.removeAttribute("data-flip");
    capsule.style.transform = `translateX(${before.left - next.left}px) scaleX(${before.width / next.width})`;
    // …then played back to its place on the next frame.
    void capsule.offsetWidth;
    const frame = requestAnimationFrame(() => {
      capsule.setAttribute("data-flip", "play");
      capsule.style.transform = "";
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);

  const select = (key: string, focus: boolean) => {
    setActive(key);
    if (focus) tabRefs.current.get(key)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const target =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    const key = tabs[target]?.key;
    if (key) select(key, true);
  };

  return (
    <div className={className} data-testid={testId}>
      <div
        role="tablist"
        aria-label={label}
        className="relative inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-line bg-surface-muted p-1"
      >
        {tabs.map((tab, index) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.key, node);
                else tabRefs.current.delete(tab.key);
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              data-tab={tab.key}
              onClick={() => select(tab.key, false)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "ui-focus relative inline-flex h-8 items-center rounded-full px-4 text-sm whitespace-nowrap",
                "transition-colors duration-150 ease-standard",
                selected ? "font-semibold text-ink-inverse" : "text-ink-muted hover:text-ink",
              )}
            >
              {selected ? (
                <span
                  ref={capsuleRef}
                  aria-hidden="true"
                  data-testid="tab-capsule"
                  className="ui-tab-capsule absolute inset-0 rounded-full bg-inverse shadow-subtle"
                />
              ) : null}
              <span className="relative">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`${baseId}-panel-${tab.key}`}
          aria-labelledby={`${baseId}-tab-${tab.key}`}
          hidden={tab.key !== active}
          tabIndex={0}
          data-panel={tab.key}
          className={cn("ui-focus rounded-lg", panelClassName)}
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
