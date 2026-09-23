"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";

const TEXTS = APP_TEXTS.nav;

type NavItem = { href: string; label: string };

const ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: TEXTS.dashboard },
  { href: "/contacts", label: TEXTS.contacts },
  { href: "/pipeline", label: TEXTS.pipeline },
  // Daily work of a human member, next to the pipeline it feeds.
  { href: "/taches", label: TEXTS.tasks },
  { href: "/rendez-vous", label: TEXTS.appointments },
  { href: "/agents-ia", label: TEXTS.agents },
  // Order of the real work: a lead arrives, a record is created, then a first
  // message goes to a human for validation.
  { href: "/agents-ia/leads-entrants", label: TEXTS.agentsLeads },
  { href: "/agents-ia/relances", label: TEXTS.agentsFollowUps },
  { href: "/agents-ia/a-valider", label: TEXTS.agentsToValidate },
  { href: "/agents-ia/suivi-rendez-vous", label: TEXTS.agentsFollowThrough },
  { href: "/parametres", label: TEXTS.settings },
];

function isActive(pathname: string, href: string): boolean {
  // "Agents IA" owns the replay of one execution, but none of its sub-screens
  // that have a menu entry of their own (inbound leads, validation queue):
  // without this, two entries would carry aria-current at the same time.
  if (href === "/agents-ia") {
    return pathname === href || pathname.startsWith("/agents-ia/executions");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Primary navigation of the signed-in space (client-side only for the active state). */
export function AppNav() {
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);

  // Below 1024 px the menu is a horizontal strip: bring the current entry into
  // view, otherwise « Tâches » or « Paramètres » would be active off-screen.
  // Only the strip scrolls (never the page), and nothing moves on desktop.
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>("[aria-current=\"page\"]");
    if (!list || !active || list.scrollWidth <= list.clientWidth) return;
    list.scrollLeft = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
  }, [pathname]);

  return (
    <nav aria-label={TEXTS.primaryLabel}>
      <ul ref={listRef} className="relative flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="shrink-0 lg:shrink">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm whitespace-nowrap",
                  "transition-[background-color,color] duration-150 ease-standard",
                  active
                    ? "bg-inverse font-medium text-ink-inverse"
                    : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
