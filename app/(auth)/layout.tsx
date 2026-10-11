import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";
import { Logo } from "@/components/ui/Logo";

/** Calm, centred shell for the sign-in / sign-up screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface-muted">
      <header className="px-6 py-6">
        <Link href="/" className="inline-flex items-center gap-3 rounded-xs">
          <Logo />
          <span className="text-xs font-normal text-ink-subtle">{APP_TEXTS.brand.prototype}</span>
        </Link>
      </header>
      <main id="content" className="flex flex-1 items-center justify-center px-6 pb-20">
        {children}
      </main>
    </div>
  );
}
