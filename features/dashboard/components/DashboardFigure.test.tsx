// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import { DashboardFigure } from "./DashboardFigure";
import { SCOPES } from "./summary-fixture";

const TEXTS = APP_TEXTS.dashboard;
const unit = (total: number) => (total > 1 ? "tâches ouvertes" : "tâche ouverte");

afterEach(() => cleanup());

describe("DashboardFigure", () => {
  it("affiche le chiffre mesuré avec son unité et son périmètre", () => {
    render(<DashboardFigure indicator={{ status: "ok", scope: SCOPES.open, value: 7 }} unit={unit} />);

    const figure = screen.getByTestId("dashboard-figure");
    expect(figure.getAttribute("data-status")).toBe("ok");
    expect(figure.textContent).toContain("7");
    expect(figure.textContent).toContain("tâches ouvertes");
    expect(screen.getByTestId("dashboard-scope").textContent).toContain(TEXTS.scopes.open_all_time);
  });

  it("affiche « 0 » quand le calcul a réussi et vaut zéro", () => {
    render(<DashboardFigure indicator={{ status: "ok", scope: SCOPES.today, value: 0 }} unit={unit} />);

    const figure = screen.getByTestId("dashboard-figure");
    expect(figure.textContent).toContain("0");
    expect(figure.textContent).not.toContain(TEXTS.unavailable);
    expect(screen.getByTestId("dashboard-scope").textContent).toContain(TEXTS.scopes.today);
  });

  it("affiche « Indisponible », jamais 0, quand le calcul a échoué — et garde le périmètre", () => {
    render(<DashboardFigure indicator={{ status: "unavailable", scope: SCOPES.last7 }} unit={unit} />);

    const figure = screen.getByTestId("dashboard-figure");
    expect(figure.getAttribute("data-status")).toBe("unavailable");
    expect(figure.textContent).toContain(TEXTS.unavailable);
    // The value line reads « Indisponible » and nothing else: no figure at all
    // (the scope line below legitimately contains the « 7 » of « sur 7 jours »).
    expect(figure.querySelector("p")?.textContent).toBe(TEXTS.unavailable);
    expect(screen.getByTestId("dashboard-scope").textContent).toContain(TEXTS.scopes.last_7_days);
    expect(figure.textContent).toContain(TEXTS.unavailableHint);
  });

  it("traduit chaque périmètre", () => {
    for (const scope of Object.values(SCOPES)) {
      render(<DashboardFigure indicator={{ status: "ok", scope, value: 1 }} unit={unit} />);
      expect(screen.getByTestId("dashboard-scope").textContent).toContain(TEXTS.scopes[scope.key]);
      cleanup();
    }
  });
});
