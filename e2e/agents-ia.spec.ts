import { expect, test, type Page } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";
import { NOTABLE_CONTACTS } from "@/fixtures/dataset";
import { AGENT_ERROR_MESSAGES, AGENT_LABELS, AGENT_ORDER } from "@/lib/agents/messages";
import { AGENT_RUN_PHASE_LABELS } from "@/lib/agents/steps";

import { keepAgentsRunning } from "./helpers/kill-switch";
import { setAiPaused } from "./helpers/local-agency";
import { fixtureUser, signIn } from "./helpers/sign-in";

/**
 * "Agents IA" module: the five agents, the replay of a real execution, and the
 * agency kill switch.
 *
 * Requires the local Supabase stack with the fixtures loaded (`npm run db:reset`).
 *
 * Serial mode: these tests flip the agency-wide kill switch, so they must never
 * run at the same time as each other (the whole suite runs with one worker for
 * the same reason — see playwright.config.ts).
 *
 * The generous timeouts exist because the Next.js dev server compiles each
 * route and each server action on first hit.
 */
test.describe.configure({ mode: "serial" });

const COLD_START = 60_000;
const CONTACT_ID = NOTABLE_CONTACTS.qualifiable;

test.beforeEach(() => {
  test.setTimeout(150_000);
});

// Every test here starts from an agency whose agents are running, and leaves it
// that way — whatever happened in between, including a timeout.
keepAgentsRunning("agentA");

async function openAgentsScreen(page: Page): Promise<void> {
  await page.goto("/agents-ia");
  await expect(page.getByRole("heading", { level: 1, name: APP_TEXTS.agentsIa.title })).toBeVisible({
    timeout: COLD_START,
  });
}

test("écran Agents IA : les cinq agents, l'activité de l'agence et l'historique", async ({ page }) => {
  await signIn(page, "agentA");
  await openAgentsScreen(page);

  // The five agents, in the order of the seller's journey.
  for (const agent of AGENT_ORDER) {
    const card = page.getByTestId(`agent-card-${agent}`);
    await expect(card).toBeVisible();
    await expect(card.getByRole("heading", { name: AGENT_LABELS[agent] })).toBeVisible();
  }

  // Figures always carry the window they were counted in.
  const activity = page.getByTestId("agency-activity");
  await expect(activity).toBeVisible();
  await expect(activity).toContainText(APP_TEXTS.agentsIa.runsAgainstLimit);
  await expect(activity).toContainText("aujourd'hui");

  // The kill switch is reachable from the screen, and states where it stands.
  const killSwitch = page.getByTestId("kill-switch");
  await expect(killSwitch).toBeVisible();
  await expect(killSwitch).toContainText(APP_TEXTS.killSwitch.running);

  await expect(page.getByTestId("run-history")).toBeVisible();
});

// The replay only unfolds step by step under real motion: reduced motion (the
// default for this whole file, see playwright.config.ts) shows every step at
// once by design (see the accessibility test below). This group opts back
// into real motion, locally, to exercise the actual animation.
test.describe("rejeu animé (mouvement complet)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("rejeu animé : Hugo lancé depuis une fiche contact, puis rejoué depuis le journal", async ({
    page,
  }) => {
    await signIn(page, "agentA");
    await page.goto(`/contacts/${CONTACT_ID}`);
    await expect(page.getByTestId("agent-actions")).toBeVisible({ timeout: COLD_START });

    await page.getByRole("button", { name: APP_TEXTS.agents.runHugo }).click();

    const replay = page.getByTestId("agent-replay");
    await expect(replay).toBeVisible({ timeout: COLD_START });
    // The replay says how it is played back: real speed, or an announced slowdown.
    await expect(replay).toContainText(/Rejeu (ralenti ×\d+|à vitesse réelle)/);

    // It unfolds: the steps appear one after the other, they are not dumped at once.
    const steps = replay.getByTestId("replay-step");
    const firstCount = await steps.count();
    expect(firstCount).toBeGreaterThan(0);
    await expect.poll(async () => steps.count(), { timeout: 30_000 }).toBeGreaterThan(firstCount);

    // "Tout afficher" ends the animation immediately when the user asks.
    const showAll = replay.getByTestId("replay-show-all");
    if (await showAll.isVisible()) {
      await showAll.click();
    }
    await expect(replay.getByTestId("replay-restart")).toBeVisible({ timeout: 30_000 });

    const finalCount = await steps.count();
    expect(finalCount).toBeGreaterThanOrEqual(5);
    // The decision is a step of its own, distinct from the call to the provider.
    await expect(replay).toContainText(AGENT_RUN_PHASE_LABELS.decision);
    await expect(replay).toContainText(AGENT_RUN_PHASE_LABELS.ai_call);
    await expect(replay).toContainText(APP_TEXTS.replay.decisionMarker);

    // Same execution, replayed later from the journal: same steps, persisted.
    await replay.getByRole("link", { name: APP_TEXTS.agentsIa.viewReplay }).click();
    await expect(page).toHaveURL(/\/agents-ia\/executions\//, { timeout: COLD_START });
    const journalReplay = page.getByTestId("replay");
    await expect(journalReplay).toBeVisible({ timeout: COLD_START });
    await expect(page.getByText(APP_TEXTS.states.simulation).first()).toBeVisible();
    await expect
      .poll(async () => journalReplay.getByTestId("replay-step").count(), { timeout: 30_000 })
      .toBe(finalCount);
  });
});

test("accessibilité : mouvement réduit — le rejeu montre toutes les étapes d'emblée, sans étape par étape", async ({
  page,
}) => {
  // Default project setting (playwright.config.ts): reducedMotion "reduce".
  // A person sensitive to motion must get the full, finished execution the
  // instant it renders — never a partial list waiting on a timer.
  await signIn(page, "agentA");
  await page.goto(`/contacts/${CONTACT_ID}`);
  await expect(page.getByTestId("agent-actions")).toBeVisible({ timeout: COLD_START });

  await page.getByRole("button", { name: APP_TEXTS.agents.runHugo }).click();

  const replay = page.getByTestId("agent-replay");
  await expect(replay).toBeVisible({ timeout: COLD_START });

  // Every step is already there — no polling for growth, unlike the real-motion
  // test above: there is nothing left to unfold.
  const steps = replay.getByTestId("replay-step");
  const immediateCount = await steps.count();
  expect(immediateCount).toBeGreaterThanOrEqual(5);
  await expect(replay).toContainText(AGENT_RUN_PHASE_LABELS.decision);
  await expect(replay).toContainText(AGENT_RUN_PHASE_LABELS.ai_call);

  // Nothing is mid-animation: the list isn't flagged busy, and there is
  // nothing left to skip, so "Tout afficher" has no reason to exist.
  await expect(replay.getByTestId("replay-steps")).not.toHaveAttribute("aria-busy", "true");
  await expect(replay.getByTestId("replay-show-all")).toHaveCount(0);

  // The live region used to announce each step during playback already
  // reads "finished": there is no step-by-step narration to catch up on.
  await expect(replay).toContainText(APP_TEXTS.replay.finished);
});

test("coupe-circuit : suspendu depuis l'écran, un agent refuse de tourner et le blocage est rejouable", async ({
  page,
}) => {
  await signIn(page, "directorA");
  await openAgentsScreen(page);

  // --- suspend, with an explicit confirmation ------------------------------
  await page.getByTestId("kill-switch-toggle").click();
  const confirm = page.getByTestId("kill-switch-confirm");
  await expect(confirm).toContainText(APP_TEXTS.killSwitch.confirmPauseTitle);
  await confirm.getByRole("button", { name: APP_TEXTS.killSwitch.confirm }).click();

  await expect(page.getByTestId("kill-switch-success")).toContainText(
    APP_TEXTS.killSwitch.pausedSuccess,
    { timeout: COLD_START },
  );
  await expect(page.getByTestId("kill-switch")).toContainText(APP_TEXTS.killSwitch.paused);

  // --- an agent now refuses to run, with a message that says why -----------
  await page.goto(`/contacts/${CONTACT_ID}`);
  await page.getByRole("button", { name: APP_TEXTS.agents.runHugo }).click();
  const error = page.getByTestId("agent-error");
  await expect(error).toBeVisible({ timeout: COLD_START });
  await expect(error).toContainText(AGENT_ERROR_MESSAGES.ai_paused);
  await expect(page.getByTestId("agent-replay")).toHaveCount(0);

  // --- the refused attempt is journaled, and its replay shows where it stopped
  await page.goto("/agents-ia?status=blocked");
  const history = page.getByTestId("run-history");
  await expect(history).toBeVisible({ timeout: COLD_START });
  await history.getByRole("link", { name: APP_TEXTS.agentsIa.viewReplay }).first().click();

  const blockedStep = page.getByTestId("replay").getByTestId("replay-step").first();
  await expect(blockedStep).toBeVisible({ timeout: COLD_START });
  await expect(blockedStep).toHaveAttribute("data-status", "blocked");
  await expect(blockedStep).toContainText(AGENT_RUN_PHASE_LABELS.guardrails);
  await expect(blockedStep).toContainText("coupe-circuit");

  // --- resume, also confirmed ---------------------------------------------
  await openAgentsScreen(page);
  await page.getByTestId("kill-switch-toggle").click();
  await page
    .getByTestId("kill-switch-confirm")
    .getByRole("button", { name: APP_TEXTS.killSwitch.confirm })
    .click();
  await expect(page.getByTestId("kill-switch-success")).toContainText(
    APP_TEXTS.killSwitch.resumedSuccess,
    { timeout: COLD_START },
  );
  // The switch is put back by `keepAgentsRunning()`, even if the run above
  // failed halfway: no test of this suite depends on the one before it.
});

test("réactivation : un conseiller voit le bouton désactivé et l'explication", async ({ page }) => {
  const user = await fixtureUser("agentA");

  await setAiPaused(user.agencyId, true);

  await signIn(page, "agentA");
  await openAgentsScreen(page);

  const killSwitch = page.getByTestId("kill-switch");
  await expect(killSwitch).toContainText(APP_TEXTS.killSwitch.paused);
  await expect(page.getByTestId("kill-switch-toggle")).toBeDisabled();
  await expect(killSwitch).toContainText(AGENT_ERROR_MESSAGES.only_director_can_resume_ai);
});
