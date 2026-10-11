// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Alert } from "./Alert";

afterEach(() => cleanup());

describe("Alert", () => {
  it("annonce un succès poliment, avec la coche de la famille d'icônes, décorative", () => {
    render(<Alert tone="success" title="Message validé" />);

    const alert = screen.getByRole("status");
    expect(alert.textContent).toBe("Message validé");
    expect(alert.textContent).not.toContain("✓");
    const check = alert.querySelector('svg[data-icon="check"]');
    expect(check).not.toBeNull();
    expect(check?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("interrompt pour une erreur", () => {
    render(<Alert tone="error" title="Envoi impossible" />);

    expect(screen.getByRole("alert").textContent).toBe("Envoi impossible");
  });
});
