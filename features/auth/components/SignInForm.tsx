"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useSingleFlight } from "@/components/ui/use-single-flight";
import { createClient } from "@/lib/supabase/client";

const TEXTS = APP_TEXTS.auth;

/**
 * Sign-in form.
 *
 * Uses the browser Supabase client (publishable key only): it writes the
 * session cookies that the server client reads on the next request, so every
 * authenticated screen is still validated server-side. No secret ever reaches
 * the browser, and no business logic lives here.
 */
export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const singleFlight = useSingleFlight();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // One sign-in request at a time, even on a double Enter.
    await singleFlight(() => signIn());
  }

  async function signIn() {
    if (isSubmitting) return;
    setError(null);

    if (email.trim().length === 0 || password.length === 0) {
      setError(TEXTS.missingFields);
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        // Same message for "unknown email" and "wrong password": an error must
        // never tell an attacker whether an account exists.
        setError(signInError.status === 400 ? TEXTS.invalidCredentials : TEXTS.unexpected);
        setIsSubmitting(false);
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError(TEXTS.unexpected);
      setIsSubmitting(false);
    }
  }

  return (
    // method="post": if the form is submitted before hydration (slow network,
    // cold dev server), the browser's native submission must never put the
    // email and password in the URL (history, server logs). Once hydrated,
    // `handleSubmit` prevents the native submission.
    <form method="post" onSubmit={handleSubmit} noValidate data-sensitive="" className="flex flex-col gap-5">
      {error ? <Alert tone="error" title={TEXTS.errorTitle}>{error}</Alert> : null}

      <Field
        label={TEXTS.emailLabel}
        type="email"
        name="email"
        autoComplete="username"
        inputMode="email"
        placeholder={TEXTS.emailPlaceholder}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={isSubmitting}
        required
      />

      <Field
        label={TEXTS.passwordLabel}
        type="password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        disabled={isSubmitting}
        required
      />

      <Button type="submit" size="lg" isLoading={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? TEXTS.submitting : TEXTS.submit}
      </Button>
    </form>
  );
}
