import type { Metadata } from "next";
import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";
import { ButtonLink } from "@/components/ui/ButtonLink";

const TEXTS = APP_TEXTS.signUp;

export const metadata: Metadata = { title: `${TEXTS.title} — ${APP_TEXTS.brand.name}` };

/**
 * `/inscription` — finished, and honest: there is no self-service sign-up.
 * Agency accounts are created by Ascend Strategy with the agency during
 * onboarding (a security choice: every access belongs to a verified agency).
 * No form, no contact address invented here: the only ways out are signing in
 * and going back home.
 */
export default function SignUpPage() {
  return (
    <div className="w-full max-w-sm animate-rise" data-testid="sign-up">
      <h1 className="text-title font-semibold tracking-tight text-ink">{TEXTS.title}</h1>
      <p className="mt-2 text-sm text-ink-muted">{TEXTS.lead}</p>

      <div className="mt-8 rounded-xl border border-line bg-surface p-6 shadow-raised sm:p-7">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-muted text-ink"
          >
            <svg viewBox="0 0 24 24" className="size-4 stroke-current" fill="none" strokeWidth="1.5">
              <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
              <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" strokeLinecap="round" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-sm text-ink">{TEXTS.body}</p>
            <p className="mt-3 text-sm text-ink-muted">{TEXTS.securityNote}</p>
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <p className="text-xs text-ink-subtle">{TEXTS.alreadyMember}</p>
        <ButtonLink href="/connexion" className="mt-3 w-full">
          {TEXTS.signIn}
        </ButtonLink>
        <p className="mt-4 text-center">
          <Link
            href="/"
            className="rounded-xs text-sm font-medium text-ink-muted underline-offset-4 transition-colors duration-150 ease-standard hover:text-ink hover:underline"
          >
            {TEXTS.backHome}
          </Link>
        </p>
      </div>
    </div>
  );
}
