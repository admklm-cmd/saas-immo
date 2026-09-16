import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { APP_TEXTS } from "@/components/texts";
import { SignInForm } from "@/features/auth/components/SignInForm";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/utils/safe-redirect";

export const metadata: Metadata = { title: `${APP_TEXTS.auth.title} — ${APP_TEXTS.brand.name}` };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // `?suivant=` is attacker-controlled: only a same-origin path survives
  // (see lib/utils/safe-redirect.ts), so it can never become an open redirect.
  const target = safeInternalPath(params.suivant);

  // Already signed in: never show the form again.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(target);

  return (
    <div className="w-full max-w-sm animate-rise">
      <h1 className="text-title font-semibold tracking-tight text-ink">{APP_TEXTS.auth.title}</h1>
      <p className="mt-2 text-sm text-ink-muted">{APP_TEXTS.auth.subtitle}</p>

      <div className="mt-8 rounded-xl border border-line bg-surface p-6 shadow-raised sm:p-7">
        <SignInForm redirectTo={target} />
      </div>

      <p className="mt-6 text-center text-xs text-ink-subtle">{APP_TEXTS.auth.noAccount}</p>
    </div>
  );
}
