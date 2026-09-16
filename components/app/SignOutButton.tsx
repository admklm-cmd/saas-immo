"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const TEXTS = APP_TEXTS.nav;

/** Clears the Supabase session cookies, then sends the user back to sign-in. */
export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    setHasFailed(false);
    try {
      const { error } = await createClient().auth.signOut();
      if (error) {
        setHasFailed(true);
        setIsSigningOut(false);
        return;
      }
      router.replace("/connexion");
      router.refresh();
    } catch {
      setHasFailed(true);
      setIsSigningOut(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="ghost" size="sm" onClick={handleSignOut} isLoading={isSigningOut}>
        {isSigningOut ? TEXTS.signingOut : TEXTS.signOut}
      </Button>
      {hasFailed ? (
        <p role="alert" className="px-3 text-xs text-ink">
          {TEXTS.signOutError}
        </p>
      ) : null}
    </div>
  );
}
