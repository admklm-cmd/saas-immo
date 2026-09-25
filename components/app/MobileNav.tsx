"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Glyph } from "@/features/agents-ia/components/icons/Glyph";

import { AppNav } from "./AppNav";
import { SignOutButton } from "./SignOutButton";

const TEXTS = APP_TEXTS.nav;

/** Id of the page content (`app/(app)/layout.tsx`), made inert while the sheet covers it. */
const CONTENT_ID = "content";

const FOCUSABLE = "summary, a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * Compact navigation (< 1024 px): a « Menu » button in the top bar opens a
 * full-height sheet with the same three groups, larger touch targets and the
 * account at the bottom — not a shrunk copy of the desktop column.
 *
 * Built on a native `<details>`: it opens and closes without JavaScript and
 * the summary is announced as a button with its expanded state. JavaScript
 * adds the behaviour of a modal sheet: while open, the focus stays between the
 * « Fermer » button and the sheet, the page behind is inert and does not
 * scroll; Escape closes and gives the focus back; the sheet closes once a link
 * is followed or the page changes.
 */
export function MobileNav({ email }: { email: string | undefined }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (detailsRef.current) detailsRef.current.open = false;
  }, [pathname]);

  // From 1024 px the top bar is hidden: close the sheet so the page is never
  // left inert. And never leave it locked if the component goes away while open.
  useEffect(() => {
    const desktop = typeof window.matchMedia === "function" ? window.matchMedia("(width >= 64rem)") : null;
    const close = () => {
      if (desktop?.matches && detailsRef.current) detailsRef.current.open = false;
    };
    desktop?.addEventListener("change", close);
    return () => {
      desktop?.removeEventListener("change", close);
      setBackgroundLocked(false);
    };
  }, []);

  function handleToggle() {
    setBackgroundLocked(detailsRef.current?.open ?? false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDetailsElement>) {
    const details = detailsRef.current;
    if (!details?.open) return;

    if (event.key === "Escape") {
      details.open = false;
      details.querySelector("summary")?.focus();
      return;
    }

    if (event.key !== "Tab") return;
    // Only reached while open: every focusable element of the sheet is shown.
    const focusable = Array.from(details.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleClick(event: MouseEvent<HTMLDetailsElement>) {
    // Following a link closes the sheet, even when it leads to the current page.
    if ((event.target as HTMLElement).closest("a") && detailsRef.current) detailsRef.current.open = false;
  }

  return (
    <details
      ref={detailsRef}
      className="group/menu"
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      onToggle={handleToggle}
    >
      <summary
        className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink shadow-subtle transition-colors duration-150 ease-standard select-none hover:bg-surface-sunken [&::-webkit-details-marker]:hidden"
        data-testid="mobile-nav-toggle"
      >
        <Glyph name="menu" width={18} className="group-open/menu:hidden" />
        <Glyph name="close" width={18} className="hidden group-open/menu:block" />
        <span className="group-open/menu:hidden">{TEXTS.menuOpen}</span>
        <span className="hidden group-open/menu:inline">{TEXTS.menuClose}</span>
      </summary>

      <div
        data-testid="mobile-nav-sheet"
        className="absolute inset-x-0 top-full h-[calc(100dvh-4rem)] animate-rise-soft overflow-y-auto overscroll-contain border-t border-line bg-canvas px-4 pt-6 pb-10"
      >
        <div className="mx-auto flex min-h-full max-w-md flex-col gap-8">
          <AppNav variant="sheet" />
          <div className="mt-auto border-t border-line pt-5">
            <p className="px-3 text-overline font-semibold text-ink-subtle uppercase">{TEXTS.signedInAs}</p>
            <p className="mt-1 px-3 text-sm break-all text-ink">{email}</p>
            <div className="mt-2">
              <SignOutButton />
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}

/** The page behind the open sheet: out of the focus order and of the accessibility tree, and still. */
function setBackgroundLocked(locked: boolean) {
  const content = document.getElementById(CONTENT_ID);
  if (content) content.inert = locked;
  document.documentElement.style.overflow = locked ? "hidden" : "";
}
