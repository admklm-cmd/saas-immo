import { expect, test, type Page } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";
import { AGENT_ERROR_MESSAGES } from "@/lib/agents/messages";

import { keepAgentsRunning } from "./helpers/kill-switch";
import { setAiPaused } from "./helpers/local-agency";
import { fixtureUser, signIn, type FixtureUserKey } from "./helpers/sign-in";

/**
 * `/parametres` — read-only settings of the agency, with the kill switch as
 * its only working control.
 *
 * Requires the local Supabase stack with the fixtures loaded (reloaded by
 * e2e/global-setup.ts). Serial: two tests flip the agency-wide kill switch.
 */
test.describe.configure({ mode: "serial" });

const COLD_START = 60_000;
const TEXTS = APP_TEXTS.settings;
const KILL_SWITCH = APP_TEXTS.killSwitch;

test.beforeEach(() => {
  test.setTimeout(120_000);
});

// Every test starts with the agents of agency A running and leaves them so,
// whatever happens in between (timeout included).
keepAgentsRunning("agentA");

async function openSettings(page: Page): Promise<void> {
  await page.goto("/parametres");
  await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toBeVisible({ timeout: COLD_START });
}

for (const key of ["agentA", "directorA"] as const satisfies readonly FixtureUserKey[]) {
  test(`${key} : l'équipe de sa seule agence, lecture seule, intégrations simulées et conservation`, async ({
    page,
  }) => {
    const me = await signIn(page, key);
    const otherAgency = await fixtureUser("userB");
    const colleague = await fixtureUser(key === "agentA" ? "directorA" : "agentA");
    await openSettings(page);

    await expect(page.getByTestId("settings-read-only")).toContainText(TEXTS.readOnlyTitle);
    await expect(page.getByTestId("settings-agency")).toContainText("Calanques Immobilier (fictive)");

    // Team: both members of agency A, the signed-in one marked « (vous) ».
    const team = page.getByTestId("settings-team");
    await expect(team).toContainText(me.email);
    await expect(team).toContainText(colleague.email);
    const current = team.locator('[data-testid="settings-member"][data-current="true"]');
    await expect(current).toHaveCount(1);
    await expect(current).toContainText(me.email);
    await expect(current).toContainText(TEXTS.you);
    await expect(current).toContainText(key === "directorA" ? "Directeur" : "Conseiller");

    // Isolation: nothing of agency B appears anywhere on the page.
    await expect(page.locator("body")).not.toContainText(otherAgency.email);
    await expect(page.locator("body")).not.toContainText("Agence Test Isolation");

    // Daily limit of agency A, read-only.
    await expect(page.getByTestId("settings-daily-limit-value")).toHaveText("100");

    // Integrations: every one simulated, none connected.
    const integrations = page.getByTestId("settings-integration");
    const count = await integrations.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      await expect(integrations.nth(index)).toContainText(APP_TEXTS.states.simulation);
      await expect(integrations.nth(index)).toContainText(TEXTS.notConnected);
    }

    await expect(page.getByTestId("settings-retention-value")).toHaveText(
      "Non définie — à valider avant mise en production",
    );
    await expect(page.locator("body")).not.toContainText("Bientôt disponible");
  });
}

test("directeur : suspendre puis réactiver les agents IA depuis Paramètres", async ({ page }) => {
  await signIn(page, "directorA");
  await openSettings(page);

  const panel = page.getByTestId("kill-switch");
  await expect(panel).toContainText(KILL_SWITCH.running);

  // Suspend, with an explicit confirmation.
  await page.getByTestId("kill-switch-toggle").click();
  const confirm = page.getByTestId("kill-switch-confirm");
  await expect(confirm).toContainText(KILL_SWITCH.confirmPauseTitle);
  await confirm.getByRole("button", { name: KILL_SWITCH.confirm }).click();
  await expect(page.getByTestId("kill-switch-success")).toContainText(KILL_SWITCH.pausedSuccess, {
    timeout: COLD_START,
  });
  await expect(panel).toContainText(KILL_SWITCH.paused);

  // The state is real, not local: it survives a reload.
  await openSettings(page);
  await expect(page.getByTestId("kill-switch")).toContainText(KILL_SWITCH.paused);

  // Resume (director only), also confirmed.
  await page.getByTestId("kill-switch-toggle").click();
  await page.getByTestId("kill-switch-confirm").getByRole("button", { name: KILL_SWITCH.confirm }).click();
  await expect(page.getByTestId("kill-switch-success")).toContainText(KILL_SWITCH.resumedSuccess, {
    timeout: COLD_START,
  });
  await expect(page.getByTestId("kill-switch")).toContainText(KILL_SWITCH.running);
});

test("conseiller : peut suspendre, mais ne peut pas réactiver et sait pourquoi", async ({ page }) => {
  await signIn(page, "agentA");
  await openSettings(page);

  // Any member may suspend.
  await page.getByTestId("kill-switch-toggle").click();
  await page.getByTestId("kill-switch-confirm").getByRole("button", { name: KILL_SWITCH.confirm }).click();
  await expect(page.getByTestId("kill-switch-success")).toContainText(KILL_SWITCH.pausedSuccess, {
    timeout: COLD_START,
  });

  // Only a director may resume: disabled button, with the reason in words.
  await openSettings(page);
  const panel = page.getByTestId("kill-switch");
  await expect(panel).toContainText(KILL_SWITCH.paused);
  await expect(page.getByTestId("kill-switch-toggle")).toBeDisabled();
  await expect(panel).toContainText(AGENT_ERROR_MESSAGES.only_director_can_resume_ai);
});

test("conseiller : l'état suspendu posé ailleurs est le même ici", async ({ page }) => {
  const user = await fixtureUser("agentA");
  await setAiPaused(user.agencyId, true);

  await signIn(page, "agentA");
  await openSettings(page);
  await expect(page.getByTestId("kill-switch")).toContainText(KILL_SWITCH.paused);
  await expect(page.getByTestId("kill-switch-toggle")).toBeDisabled();
});

test("cas d'erreur : sans session, /parametres renvoie vers la connexion", async ({ page }) => {
  await page.goto("/parametres");
  await expect(page).toHaveURL(/\/connexion/, { timeout: COLD_START });
  await expect(page.getByRole("heading", { level: 1, name: APP_TEXTS.auth.title })).toBeVisible();
});
