import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";

/** Calm, centred shell for the sign-in / sign-up screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface-muted">
      <header className="px-6 py-6">
        <Link
          href="/"
          className="inline-flex items-baseline gap-2 rounded-xs text-sm font-semibold tracking-tight text-ink"
        >
          {APP_TEXTS.brand.name}
          <span className="text-xs font-normal text-ink-subtle">{APP_TEXTS.brand.prototype}</span>
        </Link>
      </header>
      <main id="content" className="flex flex-1 items-center justify-center px-6 pb-20">
        {children}
      </main>
    </div>
  );
}
