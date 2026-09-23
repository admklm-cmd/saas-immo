import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/app/AppNav";
import { RouteParticles } from "@/components/motion/RouteParticles";
import { SignOutButton } from "@/components/app/SignOutButton";
import { APP_TEXTS } from "@/components/texts";
import { Logo } from "@/components/ui/Logo";
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
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/connexion");
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-inverse focus:px-4 focus:py-2 focus:text-sm focus:text-ink-inverse"
      >
        {APP_TEXTS.nav.skipToContent}
      </a>

      <aside className="panel-blur sticky top-0 z-40 border-b border-line lg:h-dvh lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex h-full flex-col gap-6 px-4 py-4 lg:px-5 lg:py-6">
          <div className="flex items-center justify-between gap-4">
            <Link href="/dashboard" className="inline-flex items-center gap-3 rounded-xs">
              <Logo />
              <span className="text-xs text-ink-subtle">{APP_TEXTS.brand.prototype}</span>
            </Link>
          </div>

          <AppNav />

          <div className="mt-auto hidden border-t border-line pt-4 lg:block">
            <p className="px-3 text-overline font-semibold text-ink-subtle uppercase">
              {APP_TEXTS.nav.signedInAs}
            </p>
            <p className="mt-1 px-3 text-sm break-all text-ink">{data.user.email}</p>
            <div className="mt-2">
              <SignOutButton />
            </div>
          </div>
        </div>
      </aside>

      <main id="content" className="app-canvas particle-shell relative min-w-0 flex-1">
        <RouteParticles />
        {children}
        <div className="border-t border-line px-6 py-6 lg:hidden">
          <p className="text-xs text-ink-subtle">
            {APP_TEXTS.nav.signedInAs} <span className="break-all text-ink">{data.user.email}</span>
          </p>
          <div className="mt-2">
            <SignOutButton />
          </div>
        </div>
      </main>
    </div>
  );
}
