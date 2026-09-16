"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";

const TEXTS = APP_TEXTS.nav;

type NavItem = { href: string; label: string };

const ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: TEXTS.dashboard },
  { href: "/contacts", label: TEXTS.contacts },
  { href: "/pipeline", label: TEXTS.pipeline },
  { href: "/agents-ia", label: TEXTS.agents },
  { href: "/agents-ia/a-valider", label: TEXTS.agentsToValidate },
  { href: "/parametres", label: TEXTS.settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/agents-ia") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Primary navigation of the signed-in space (client-side only for the active state). */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label={TEXTS.primaryLabel}>
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
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
