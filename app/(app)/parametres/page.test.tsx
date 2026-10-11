// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import { SETTINGS_INTEGRATIONS } from "@/features/settings/data";
import type { AgencySettings } from "@/features/settings/types";
import { AGENT_ERROR_MESSAGES } from "@/lib/agents/messages";

/**
 * The read-only `/parametres` screen, assembled from `getAgencySettings()`.
 *
 * What this file protects: each section stands alone (one « Indisponible »
 * never hides another), nothing suggests a real connection or a retention
 * period, and the kill switch keeps its rules (a non-director cannot resume).
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

// The kill switch panel is wired to the existing server action; the mutation
// itself is covered by its own tests and by the E2E journey.
vi.mock("@/features/agents-ia/actions", () => ({
  setAgencyAiPaused: vi.fn(),
}));

vi.mock("@/features/settings/queries", () => ({
  getAgencySettings: vi.fn(),
}));

const { getAgencySettings } = await import("@/features/settings/queries");
const SettingsPage = (await import("./page")).default;

const TEXTS = APP_TEXTS.settings;

function makeSettings(overrides: Partial<AgencySettings> = {}): AgencySettings {
  return {
    agencyId: "agency-1",
    viewer: { userId: "user-1", role: "agent" },
    agency: { status: "ok", value: { name: "Calanques Immobilier (fictive)", city: "La Ciotat", sector: null } },
    members: {
      status: "ok",
      value: [
        {
          userId: "user-2",
          email: "direction@calanques.test",
          role: "director",
          memberSince: "2026-09-01T08:00:00.000Z",
          isCurrentUser: false,
        },
        {
          userId: "user-1",
          email: "marc@calanques.test",
          role: "agent",
          memberSince: "2026-09-02T08:00:00.000Z",
          isCurrentUser: true,
        },
      ],
    },
    agents: {
      killSwitch: { status: "ok", value: { aiPaused: false, canResume: false } },
      dailyRunLimit: { status: "ok", value: 200 },
    },
    integrations: [...SETTINGS_INTEGRATIONS],
    retention: { status: "undefined" },
    ...overrides,
  };
}

async function renderPage(settings: AgencySettings): Promise<void> {
  vi.mocked(getAgencySettings).mockResolvedValue({ data: settings, error: null });
  render(await SettingsPage());
}

afterEach(() => cleanup());

describe("Écran Paramètres", () => {
  it("annonce la lecture seule, sans promesse de date", async () => {
    await renderPage(makeSettings());

    expect(screen.getByRole("heading", { level: 1, name: TEXTS.title })).toBeDefined();
    const note = screen.getByTestId("settings-read-only");
    expect(note.textContent).toContain(TEXTS.readOnlyTitle);
    expect(note.textContent).toContain(APP_TEXTS.brand.name);
    expect(document.body.textContent).not.toMatch(/bientôt|prochainement|à venir/i);
  });

  it("affiche l'agence, et « Non renseigné » pour une valeur absente", async () => {
    await renderPage(makeSettings());

    const agency = screen.getByTestId("settings-agency");
    expect(agency.textContent).toContain("Calanques Immobilier (fictive)");
    expect(agency.textContent).toContain("La Ciotat");
    expect(within(agency).getAllByText(TEXTS.notProvided)).toHaveLength(1);
  });

  it("liste l'équipe : rôle écrit, « (vous) » sur la seule personne connectée, date d'arrivée", async () => {
    await renderPage(makeSettings());

    const rows = screen.getAllByTestId("settings-member");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain("direction@calanques.test");
    expect(rows[0]!.textContent).toContain("Directeur");
    expect(rows[0]!.textContent).not.toContain(TEXTS.you);
    expect(rows[1]!.textContent).toContain("Conseiller");
    expect(rows[1]!.textContent).toContain(TEXTS.you);
    // 1 September 2026 in Paris time.
    expect(rows[0]!.textContent).toContain(TEXTS.memberSince("01 sept. 2026"));
    expect(screen.getByTestId("settings-team").textContent).toContain(TEXTS.teamCount(2));
  });

  it("dit « Indisponible » pour la seule section en échec, sans masquer les autres", async () => {
    await renderPage(makeSettings({ members: { status: "unavailable" } }));

    const team = screen.getByTestId("settings-team");
    expect(team.textContent).toContain(TEXTS.unavailable);
    expect(screen.queryAllByTestId("settings-member")).toHaveLength(0);

    expect(screen.getByTestId("settings-agency").textContent).not.toContain(TEXTS.unavailable);
    expect(screen.getByTestId("kill-switch")).toBeDefined();
    expect(screen.getByTestId("settings-daily-limit-value").textContent).toBe("200");
    expect(screen.getAllByText(TEXTS.unavailable)).toHaveLength(1);
  });

  it("garde le coupe-circuit utilisable quand la limite quotidienne est indisponible", async () => {
    await renderPage(
      makeSettings({
        agents: {
          killSwitch: { status: "ok", value: { aiPaused: false, canResume: true } },
          dailyRunLimit: { status: "unavailable" },
        },
      }),
    );

    expect(screen.getByTestId("settings-daily-limit").textContent).toContain(TEXTS.unavailable);
    const toggle = screen.getByTestId("kill-switch-toggle");
    expect(toggle.hasAttribute("disabled")).toBe(false);
    expect(toggle.textContent).toContain(APP_TEXTS.killSwitch.pause);
  });

  it("dit « Indisponible » si le coupe-circuit n'a pas pu être lu, sans inventer d'état", async () => {
    await renderPage(
      makeSettings({
        agents: { killSwitch: { status: "unavailable" }, dailyRunLimit: { status: "ok", value: 200 } },
      }),
    );

    expect(screen.getByTestId("settings-kill-switch-unavailable").textContent).toContain(TEXTS.unavailable);
    expect(screen.queryByTestId("kill-switch-toggle")).toBeNull();
    expect(screen.queryByText(APP_TEXTS.killSwitch.running)).toBeNull();
  });

  it("coupe-circuit actif : un conseiller ne peut pas réactiver, et sait pourquoi", async () => {
    await renderPage(
      makeSettings({
        agents: {
          killSwitch: { status: "ok", value: { aiPaused: true, canResume: false } },
          dailyRunLimit: { status: "ok", value: 200 },
        },
      }),
    );

    const toggle = screen.getByTestId("kill-switch-toggle");
    expect(toggle.textContent).toContain(APP_TEXTS.killSwitch.resume);
    expect(toggle.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(AGENT_ERROR_MESSAGES.only_director_can_resume_ai)).toBeDefined();
  });

  it("coupe-circuit actif : un directeur peut réactiver", async () => {
    await renderPage(
      makeSettings({
        viewer: { userId: "user-2", role: "director" },
        agents: {
          killSwitch: { status: "ok", value: { aiPaused: true, canResume: true } },
          dailyRunLimit: { status: "ok", value: 200 },
        },
      }),
    );

    expect(screen.getByTestId("kill-switch-toggle").hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText(AGENT_ERROR_MESSAGES.only_director_can_resume_ai)).toBeNull();
  });

  it("présente chaque intégration comme une simulation non connectée", async () => {
    await renderPage(makeSettings());

    const items = screen.getAllByTestId("settings-integration");
    expect(items).toHaveLength(SETTINGS_INTEGRATIONS.length);
    for (const item of items) {
      expect(within(item).getByText(APP_TEXTS.states.simulation)).toBeDefined();
      expect(within(item).getByText(TEXTS.notConnected)).toBeDefined();
    }

    const card = screen.getByTestId("settings-integrations");
    // Nothing may read as a live connection.
    expect(within(card).queryByText(/^(Connectée|Connecté|Active|Actif)$/i)).toBeNull();
    expect(card.textContent?.match(/Non connectée/g)).toHaveLength(SETTINGS_INTEGRATIONS.length);
    for (const category of Object.values(TEXTS.integrationCategories)) {
      expect(within(card).getByRole("heading", { level: 3, name: category })).toBeDefined();
    }

    const hektor = items.find((item) => item.getAttribute("data-integration") === "hektor")!;
    expect(hektor.textContent).toContain(TEXTS.integrationSimulates.none);
    const outlook = items.find((item) => item.getAttribute("data-integration") === "outlook")!;
    expect(outlook.textContent).toContain(TEXTS.integrationSimulates.appointments);
  });

  it("affiche le texte exact de conservation, sans aucune durée", async () => {
    await renderPage(makeSettings());

    const value = screen.getByTestId("settings-retention-value");
    expect(value.textContent).toBe("Non définie — à valider avant mise en production");
    expect(screen.getByTestId("settings-retention").textContent).not.toMatch(/\d/);
  });

  it("remplace l'écran par une erreur utile quand la session est invalide", async () => {
    const message = "Votre session a expiré. Reconnectez-vous.";
    vi.mocked(getAgencySettings).mockResolvedValue({ data: null, error: { code: "unauthenticated", message } });

    render(await SettingsPage());

    const alert = screen.getByTestId("settings-error");
    expect(alert.textContent).toContain(TEXTS.errorTitle);
    expect(alert.textContent).toContain(message);
    expect(screen.getByRole("link", { name: APP_TEXTS.states.retry }).getAttribute("href")).toBe("/parametres");
    expect(screen.queryByTestId("settings-team")).toBeNull();
    expect(screen.queryByTestId("kill-switch")).toBeNull();
  });
});
