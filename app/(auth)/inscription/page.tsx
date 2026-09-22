import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";

export const metadata: Metadata = {
  title: `${APP_TEXTS.shells.signUpTitle} — ${APP_TEXTS.brand.name}`,
};

/** Shell: agency accounts are created by Ascend Strategy during onboarding, not self-served. */
export default function SignUpPage() {
  return (
    <div className="w-full max-w-sm animate-rise text-center">
      <Badge tone="outline">{APP_TEXTS.states.comingSoon}</Badge>
      <h1 className="mt-4 text-title font-semibold tracking-tight text-ink">
        {APP_TEXTS.shells.signUpTitle}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">{APP_TEXTS.shells.signUpBody}</p>
      <ButtonLink href="/connexion" variant="secondary" className="mt-8">
        {APP_TEXTS.auth.title}
      </ButtonLink>
    </div>
  );
}
