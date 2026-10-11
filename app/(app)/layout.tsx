import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/app/AppNav";
import { MobileNav } from "@/components/app/MobileNav";
import { SignOutButton } from "@/components/app/SignOutButton";
import { RouteParticles } from "@/components/motion/RouteParticles";
import { APP_TEXTS } from "@/components/texts";
import { Logo } from "@/components/ui/Logo";
import { PointerField } from "@/components/ui/PointerField";
import { createClient } from "@/lib/supabase/server";

/**
 * Shell of the signed-in space.
 *
 * The session is verified server-side on every request with `auth.getUser()`
 * (which revalidates the token against the auth server, unlike `getSession()`).
 * Without a session, nothing is rendered: the user is redirected to sign-in.
 *
 * This is a convenience gate, not the security boundary: every query and server
 * action re-checks the session and resolves the `agency_id` server-side, and
 * RLS is the last line of defence.
 *
 * Frame (docs/design-system.md §2.10): a fixed column with the grouped
 * navigation from 1024 px; below, a top bar with a « Menu » sheet.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/connexion");
  }

  // Paint order (docs/design-system.md §2.5.8): the pearl gradient lives on this
  // wrapper, which creates no stacking context; the fixed particle canvas
  // (z-index 0) paints above it; <main>, later in the tree, positioned with
  // z-index auto, paints above the canvas without trapping the menus of the
  // pages in a stacking context of its own. The navigation keeps its z-40.
  return (
    <div className="app-canvas flex min-h-dvh flex-1 flex-col lg:flex-row">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-inverse focus:px-4 focus:py-2 focus:text-sm focus:text-ink-inverse"
      >
        {APP_TEXTS.nav.skipToContent}
      </a>

      {/* Compact top bar (< 1024 px): brand, then the « Menu » sheet. « Prototype »
          is ink-muted, not ink-subtle: the particles blurred behind the 78 % panel
          took ink-subtle down to 4.56:1 at 390 px (§2.5.8). */}
      <header className="panel-blur sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-line px-4 sm:px-6 lg:hidden">
        <Link href="/dashboard" className="inline-flex items-center gap-3 rounded-xs">
          <Logo />
          <span className="text-xs text-ink-muted">{APP_TEXTS.brand.prototype}</span>
        </Link>
        <MobileNav email={data.user.email} />
      </header>

      {/* Desktop column (≥ 1024 px): grouped navigation, account at the bottom. */}
      <aside className="panel-blur sticky top-0 z-40 hidden h-dvh w-64 shrink-0 flex-col border-r border-line lg:flex">
        <div className="flex h-full flex-col gap-8 overflow-y-auto px-4 pt-6 pb-5">
          <Link href="/dashboard" className="inline-flex items-center gap-3 self-start rounded-xs px-2">
            <Logo />
            <span className="text-xs text-ink-muted">{APP_TEXTS.brand.prototype}</span>
          </Link>

          <AppNav />

          <div className="mt-auto border-t border-line pt-4">
            <p className="px-3 text-overline font-semibold text-ink-subtle uppercase">{APP_TEXTS.nav.signedInAs}</p>
            <p className="mt-1 px-3 text-sm break-all text-ink">{data.user.email}</p>
            <div className="mt-2">
              <SignOutButton />
            </div>
          </div>
        </div>
      </aside>

      {/*
        One decorative canvas for the whole signed-in space (spec §9), fixed to the
        viewport and out of the flow. This layout persists across navigations, so
        the engine is never remounted: the shape morphs when the route changes.
      */}
      <RouteParticles />
      {/* One delegated pointer listener for the halo and magnetic controls. */}
      <PointerField />

      {/* overflow-x-clip: the soft edges of `.particle-veil` never add a horizontal
          scroll; clip (unlike hidden) creates no scroll container, so sticky
          columns inside keep working. */}
      <main id="content" className="relative min-w-0 flex-1 overflow-x-clip">
        {children}
      </main>
    </div>
  );
}
