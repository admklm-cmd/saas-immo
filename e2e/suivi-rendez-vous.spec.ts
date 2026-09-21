import { expect, test, type Locator, type Page } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";
import { AGENT_ERROR_MESSAGES } from "@/lib/agents/messages";

import { keepAgentsRunning } from "./helpers/kill-switch";
import { setAiPaused } from "./helpers/local-agency";
import { fixtureUser, signIn } from "./helpers/sign-in";

test.describe.configure({ mode: "serial" });

const TEXTS = APP_TEXTS.followThrough;
const NAV = APP_TEXTS.nav;
const COLD_START = 60_000;
const REPORT_WITH_DATA = "jardin exposé sud";
const REPORT_MISSING_CONTACT = "Alain Chevalier";
const PROPOSED_CONTACT = "Isabelle Dubreuil";
const HUMAN_REPORT =
  "Estimation présentée lors du rendez-vous. La vendeuse souhaite comparer avant de décider. Relance à prévoir sous dix jours.";

test.beforeEach(() => test.setTimeout(150_000));
keepAgentsRunning("agentA");

function navigation(page: Page): Locator {
  return page.getByRole("navigation", { name: NAV.primaryLabel });
}

function appointmentCard(page: Page, text: string): Locator {
  return page.getByTestId("sarah-appointment").filter({ hasText: text });
}

async function openFollowThroughFromNav(page: Page): Promise<void> {
  const link = navigation(page).getByRole("link", { name: NAV.agentsFollowThrough, exact: true });
  await link.focus();
  await expect(link).toBeFocused();
  await link.click();
  await expect(page).toHaveURL(/\/agents-ia\/suivi-rendez-vous$/);
  await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toBeVisible({
    timeout: COLD_START,
  });
}

test("parcours principal : un humain confirme et consigne le rendez-vous avant de lancer Sarah", async ({ page }) => {
  await signIn(page, "agentA");
  await openFollowThroughFromNav(page);

  const current = navigation(page).locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText(NAV.agentsFollowThrough);
  await expect(page.getByTestId("sarah-rule")).toContainText(TEXTS.ruleTitle);

  const blocked = appointmentCard(page, REPORT_MISSING_CONTACT);
  await expect(blocked).toContainText(TEXTS.blockedNoReport, { timeout: COLD_START });
  await expect(blocked.getByTestId("run-sarah")).toHaveCount(0);

  const target = appointmentCard(page, PROPOSED_CONTACT);
  await expect(target).toContainText("Proposé", { timeout: COLD_START });
  await expect(target.getByTestId("run-sarah")).toHaveCount(0);
  await expect(target).not.toContainText("Sarah");

  await target.getByTestId("confirm-appointment").click();
  await expect(target).toContainText("Confirmé", { timeout: COLD_START });
  await expect(target.getByTestId("appointment-workflow-success")).toContainText(TEXTS.confirmSuccess);

  const report = target.getByRole("textbox", { name: TEXTS.report });
  await report.fill(HUMAN_REPORT);
  await target.getByTestId("complete-appointment").click();
  await expect(target).toContainText("Réalisé", { timeout: COLD_START });
  await expect(target).toContainText(HUMAN_REPORT);
  await expect(target.getByTestId("appointment-workflow-success")).toContainText(TEXTS.completeSuccess);
  await expect(target.getByTestId("run-sarah")).toBeVisible();

  await target.getByTestId("run-sarah").click();

  await expect(target.getByTestId("sarah-result")).toBeVisible({ timeout: COLD_START });
  await expect(target.getByTestId("sarah-analysis")).toBeVisible();
  await expect(target.getByTestId("sarah-replay")).toBeVisible();
  await expect(target.getByText(APP_TEXTS.states.simulation).first()).toBeVisible();
});

test("cas d'erreur : le coupe-circuit refuse Sarah et explique le blocage", async ({ page }) => {
  const user = await fixtureUser("agentA");
  await signIn(page, "agentA");
  await openFollowThroughFromNav(page);

  const target = appointmentCard(page, REPORT_WITH_DATA);
  await expect(target).toBeVisible({ timeout: COLD_START });
  await setAiPaused(user.agencyId, true);
  await target.getByTestId("run-sarah").click();

  await expect(target.getByTestId("sarah-error")).toContainText(AGENT_ERROR_MESSAGES.ai_paused, {
    timeout: COLD_START,
  });
  await expect(target.getByTestId("sarah-result")).toHaveCount(0);
  await expect(target.getByTestId("run-sarah")).toBeEnabled();
});
