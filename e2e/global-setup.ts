import { spawnSync } from "node:child_process";

import { adminClient, loadLocalEnv } from "./helpers/local-supabase";

/**
 * Playwright global setup: reloads the fictitious fixtures before the E2E suite.
 *
 * Why it exists — the E2E suite and the Vitest `integration` project share the
 * SAME local Supabase database, and both consume fixture rows (a draft that
 * gets sent, an appointment that gets booked…). Run on their own, both suites
 * are green; chained (`vitest run` then `playwright test`), the E2E suite used
 * to fail on rows a previous integration run had already consumed. That was a
 * tooling problem, never a product one: reloading the fixtures here makes the
 * starting state explicit instead of inherited, so both commands can be chained
 * in any order, as many times as wanted.
 *
 * The fixtures are reloaded by running the existing `npm run db:seed` script in
 * a child process rather than by importing `fixtures/load-fixtures.ts`: that
 * module is ESM (`import.meta.url`), while Playwright transpiles the files it
 * loads to CommonJS, which fails with "Cannot use 'import.meta' outside a
 * module". A child process keeps the loader as the single source of truth,
 * untouched, and gives us its exit code.
 *
 * Safety: seeding touches the database with the secret key, so it goes through
 * the same guards as before (`lib/supabase/local-only.ts`, applied inside the
 * loader and in the reachability probe below) — local Supabase URL only, never
 * NODE_ENV=production. Nothing here can reach a hosted project.
 */

/** A dead local stack must fail here, once, instead of timing out test by test. */
const REACHABILITY_TIMEOUT_MS = 10_000;
const SEED_TIMEOUT_MS = 180_000;

const START_HINT = "Démarrez-la avec `npm run db:start`, puis relancez `npx playwright test`.";

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Fails with a readable French message when the local stack is down or empty. */
async function assertLocalStackReachable(): Promise<void> {
  const admin = adminClient();

  let failure: string | null = null;
  try {
    const { error } = await admin
      .from("agencies")
      .select("id", { head: true, count: "exact" })
      .abortSignal(AbortSignal.timeout(REACHABILITY_TIMEOUT_MS));
    // A rejected key answers with an empty message, hence the fallbacks.
    failure = error ? error.message || error.code || "réponse refusée par Supabase" : null;
  } catch (error) {
    failure = describe(error);
  }

  if (failure !== null) {
    throw new Error(
      `La base Supabase locale est injoignable ou son schéma est absent (${failure}).\n` +
        `${START_HINT} Si elle tourne déjà, appliquez les migrations avec \`npm run db:reset\`.`,
    );
  }
}

function reloadFixtures(): void {
  // stdio piped on purpose: the loader prints the generated fixture passwords,
  // which belong in fixtures/.generated-credentials.json (mode 0600,
  // git-ignored), not in a test run log. Only failures are surfaced.
  // Windows needs a shell to resolve `npm` (npm.cmd); harmless elsewhere. The
  // command is a fixed literal with no interpolation, and it is passed as a
  // single string (no argument array) to avoid Node's DEP0190 warning.
  const result = spawnSync("npm run --silent db:seed", {
    cwd: process.cwd(),
    shell: true,
    encoding: "utf8",
    timeout: SEED_TIMEOUT_MS,
  });

  if (result.error) {
    throw new Error(`\`npm run db:seed\` n'a pas pu être lancé : ${describe(result.error)}`);
  }
  if (result.status !== 0) {
    const details = (result.stderr || "").trim().split("\n").slice(-10).join("\n");
    throw new Error(
      `\`npm run db:seed\` a échoué (code ${String(result.status)}).\n${details}\n` +
        "Relancez `npm run db:reset` pour repartir d'une base propre.",
    );
  }
}

export default async function globalSetup(): Promise<void> {
  console.log("Tests E2E : rechargement des données fictives avant la suite…");

  try {
    loadLocalEnv();
    await assertLocalStackReachable();
    reloadFixtures();
  } catch (error) {
    // A single, readable French failure beats 17 tests timing out one by one.
    throw new Error(`Tests E2E : impossible de préparer la base locale.\n${describe(error)}`);
  }

  console.log("Tests E2E : données fictives rechargées (2 agences fictives).");
}
