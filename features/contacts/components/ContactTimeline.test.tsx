// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import type { TimelineEntry } from "@/features/contacts/types";

import { ContactTimeline } from "./ContactTimeline";

afterEach(() => {
  cleanup();
});

function entry(overrides: Partial<TimelineEntry> & Pick<TimelineEntry, "id">): TimelineEntry {
  return {
    kind: "activity",
    occurredAt: "2026-09-14T08:30:00.000Z",
    title: "Événement",
    description: null,
    isSimulation: false,
    actor: { type: "system", agent: null, userId: null },
    status: null,
    meta: {},
    ...overrides,
  };
}

describe("ContactTimeline", () => {
  it("offers an empty state instead of a blank area", () => {
    render(<ContactTimeline entries={[]} />);
    expect(screen.getByText(APP_TEXTS.contact.timelineEmpty)).toBeDefined();
  });

  it("badges simulated entries, and only those", () => {
    render(
      <ContactTimeline
        entries={[
          entry({
            id: "1",
            kind: "message",
            title: "Email — À valider",
            isSimulation: true,
            actor: { type: "ai_agent", agent: "louis", userId: null },
          }),
          entry({ id: "2", kind: "task", title: "Tâche — À faire", isSimulation: false }),
        ]}
      />,
    );

    // Product guard rail: a simulated action must never look like a real send.
    expect(screen.getAllByText(APP_TEXTS.states.simulation)).toHaveLength(1);
    expect(screen.getByText("Louis")).toBeDefined();
  });

  it("renders one list item per entry, with a machine-readable date", () => {
    const { container } = render(
      <ContactTimeline
        entries={[
          entry({ id: "1", occurredAt: "2026-09-14T08:30:00.000Z" }),
          entry({ id: "2", occurredAt: "2026-09-13T08:30:00.000Z" }),
          entry({ id: "3", occurredAt: "2026-09-12T08:30:00.000Z" }),
        ]}
      />,
    );

    expect(container.querySelectorAll("li")).toHaveLength(3);
    expect(container.querySelector("time")?.getAttribute("dateTime")).toBe("2026-09-14T08:30:00.000Z");
  });
});

describe("ContactTimeline — human stage change", () => {
  it("reads « Étape : X → Y », shows the motive as plain text and never a simulation badge", () => {
    render(
      <ContactTimeline
        entries={[
          entry({
            id: "1",
            title: "Dossier sorti de « Mandat signé » par un directeur (→ Estimation faite). Motif : <b>annulé</b>",
            actor: { type: "user", agent: null, userId: "u1" },
            meta: {
              type: "contact_stage_changed",
              previous_stage: "mandat_signe",
              stage: "estimation_faite",
              reason: "<b>annulé</b> par le vendeur",
            },
          }),
          entry({
            id: "2",
            actor: { type: "user", agent: null, userId: "u1" },
            meta: { type: "contact_stage_changed", previous_stage: "chaud", stage: "mandat_signe", reason: null },
          }),
        ]}
      />,
    );

    const changes = screen.getAllByTestId("timeline-stage-change");
    expect(changes.map((node) => node.textContent)).toEqual([
      APP_TEXTS.contact.timelineStageChange("Mandat signé", "Estimation faite"),
      APP_TEXTS.contact.timelineStageChange("Chaud", "Mandat signé"),
    ]);
    // Rendered as text, never as markup.
    expect(screen.getByText(/<b>annulé<\/b> par le vendeur/)).toBeDefined();
    expect(document.querySelector("b")).toBeNull();
    expect(screen.getAllByText(new RegExp(`^${APP_TEXTS.contact.timelineStageReason}`))).toHaveLength(1);
    expect(screen.queryByText(APP_TEXTS.states.simulation)).toBeNull();
  });

  it("falls back to the stored summary when the stages are unreadable", () => {
    render(
      <ContactTimeline
        entries={[
          entry({
            id: "1",
            title: "Résumé enregistré",
            meta: { type: "contact_stage_changed", previous_stage: "inconnue", stage: null, reason: null },
          }),
        ]}
      />,
    );
    expect(screen.getByText("Résumé enregistré")).toBeDefined();
    expect(screen.queryByTestId("timeline-stage-change")).toBeNull();
  });
});

describe("ContactTimeline — author of a human stage change", () => {
  const change = { type: "contact_stage_changed", previous_stage: "mandat_signe", stage: "chaud", reason: "Annulé" };

  it("reads « Directeur » when the stage change records a director", () => {
    render(
      <ContactTimeline
        entries={[
          entry({
            id: "1",
            actor: { type: "user", agent: null, userId: "u1" },
            meta: { ...change, actor_role: "director" },
          }),
        ]}
      />,
    );
    expect(screen.getByText("Directeur")).toBeDefined();
    expect(screen.queryByText("Conseiller")).toBeNull();
  });

  it("keeps « Conseiller » for an agent, a missing role, or any other human entry", () => {
    render(
      <ContactTimeline
        entries={[
          entry({ id: "1", actor: { type: "user", agent: null, userId: "u1" }, meta: { ...change, actor_role: "agent" } }),
          entry({ id: "2", actor: { type: "user", agent: null, userId: "u1" }, meta: { ...change, actor_role: null } }),
          // A role on another kind of entry is not trusted as a stage-change author.
          entry({ id: "3", actor: { type: "user", agent: null, userId: "u1" }, meta: { actor_role: "director" } }),
        ]}
      />,
    );
    expect(screen.getAllByText("Conseiller")).toHaveLength(3);
    expect(screen.queryByText("Directeur")).toBeNull();
  });
});

describe("ContactTimeline — human review of a message", () => {
  const review = {
    channel: "email",
    agent: "Louis",
    validated_by_user_id: "u1",
    validated_by_label: "marc.conseiller@example.test",
  };

  function message(id: string, meta: TimelineEntry["meta"], overrides: Partial<TimelineEntry> = {}): TimelineEntry {
    return entry({
      id,
      kind: "message",
      title: "Email — Envoyé (simulation)",
      isSimulation: true,
      actor: { type: "ai_agent", agent: "louis", userId: null },
      status: "sent_simulated",
      // The entry date is the SEND date: it must never be used as the review date.
      occurredAt: "2026-09-20T16:45:00.000Z",
      meta,
      ...overrides,
    });
  }

  function reviewLine(): HTMLElement {
    return screen.getByTestId("timeline-review");
  }

  it("reads « Validé par <email> (<rôle>) le <date Paris> » from the stored values", () => {
    render(
      <ContactTimeline
        entries={[
          message("1", {
            ...review,
            review_outcome: "approved",
            validated_by_email: "marc.conseiller@example.test",
            validated_by_role: "agent",
            validated_by_role_label: "Conseiller",
            validated_at: "2026-09-20T08:05:00.000Z",
          }),
        ]}
      />,
    );

    const line = reviewLine();
    expect(line.getAttribute("data-outcome")).toBe("approved");
    // 08:05 UTC is 10:05 in Paris (summer time).
    expect(line.textContent).toBe("Validé par marc.conseiller@example.test (Conseiller) le 20 sept. 2026 à 10:05");
    expect(line.querySelector("time")?.getAttribute("dateTime")).toBe("2026-09-20T08:05:00.000Z");
  });

  it("reads « Refusé par … le … » for a refused message", () => {
    render(
      <ContactTimeline
        entries={[
          message(
            "1",
            {
              ...review,
              review_outcome: "rejected",
              validated_by_email: "direction@example.test",
              validated_by_role: "director",
              validated_by_role_label: "Directeur",
              validated_at: "2026-01-15T09:00:00.000Z",
            },
            { status: "rejected", title: "Email — Refusé" },
          ),
        ]}
      />,
    );

    const line = reviewLine();
    expect(line.getAttribute("data-outcome")).toBe("rejected");
    // Winter time: UTC+1.
    expect(line.textContent).toBe("Refusé par direction@example.test (Directeur) le 15 janv. 2026 à 10:00");
  });

  it("says « En attente de validation humaine » while nobody has decided", () => {
    render(
      <ContactTimeline
        entries={[
          message(
            "1",
            {
              ...review,
              review_outcome: null,
              validated_by_user_id: null,
              validated_by_label: null,
              validated_by_email: null,
              validated_by_role: null,
              validated_by_role_label: null,
              validated_at: null,
            },
            { status: "pending_validation", title: "Email — À valider" },
          ),
        ]}
      />,
    );

    expect(reviewLine().textContent).toBe(APP_TEXTS.contact.reviewPending);
    expect(reviewLine().getAttribute("data-outcome")).toBe("pending");
    expect(reviewLine().querySelector("time")).toBeNull();
  });

  it("says « Auteur non disponible » without inventing one, and keeps the stored date", () => {
    render(
      <ContactTimeline
        entries={[
          message("1", {
            ...review,
            review_outcome: "approved",
            validated_by_user_id: null,
            validated_by_label: null,
            validated_by_email: null,
            validated_by_role: null,
            validated_by_role_label: null,
            validated_at: "2026-09-20T08:05:00.000Z",
          }),
        ]}
      />,
    );

    expect(reviewLine().textContent).toBe(
      `Validé le 20 sept. 2026 à 10:05 — ${APP_TEXTS.contact.reviewAuthorUnknown}`,
    );
    expect(reviewLine().textContent).not.toContain("Conseiller");
  });

  it("writes no date at all when none was stored — never the send date nor the entry date", () => {
    render(
      <ContactTimeline
        entries={[
          message("1", {
            ...review,
            review_outcome: "approved",
            validated_by_email: "marc.conseiller@example.test",
            validated_by_role: "agent",
            validated_by_role_label: "Conseiller",
            validated_at: null,
          }),
        ]}
      />,
    );

    const line = reviewLine();
    expect(line.textContent).toBe("Validé par marc.conseiller@example.test (Conseiller)");
    expect(line.querySelector("time")).toBeNull();
    // The entry date (the send) is shown in the header only, never in the review line.
    expect(line.textContent).not.toMatch(/20 sept/);
  });

  it("with neither author nor date, only states the outcome and the missing author", () => {
    render(
      <ContactTimeline
        entries={[
          message("1", {
            review_outcome: "rejected",
            validated_by_email: null,
            validated_by_role_label: null,
            validated_at: null,
          }),
        ]}
      />,
    );
    expect(reviewLine().textContent).toBe(`Refusé — ${APP_TEXTS.contact.reviewAuthorUnknown}`);
  });

  it("renders the stored author as text, never as markup", () => {
    render(
      <ContactTimeline
        entries={[
          message("1", {
            review_outcome: "approved",
            validated_by_email: "<b>x</b>@example.test",
            validated_by_role_label: "Conseiller",
            validated_at: "2026-09-20T08:05:00.000Z",
          }),
        ]}
      />,
    );
    expect(reviewLine().textContent).toContain("<b>x</b>@example.test");
    expect(document.querySelector("b")).toBeNull();
  });

  it("shows no review line on entries that are not messages, nor on messages without review data", () => {
    render(
      <ContactTimeline
        entries={[
          entry({ id: "1", kind: "task", meta: { review_outcome: "approved" } }),
          message("2", { channel: "email" }),
        ]}
      />,
    );
    expect(screen.queryByTestId("timeline-review")).toBeNull();
  });
});

describe("ContactTimeline — AI runs refused or failed", () => {
  it("badges a guard-rail block and a technical error differently", () => {
    render(
      <ContactTimeline
        entries={[
          entry({
            id: "1",
            kind: "ai_run",
            title: "Emma — Mandat signé : aucune relance n'est préparée.",
            status: "blocked",
            isSimulation: true,
            actor: { type: "ai_agent", agent: "emma", userId: null },
          }),
          entry({
            id: "2",
            kind: "ai_run",
            title: "Hugo — Sortie refusée par le schéma.",
            status: "failed",
            isSimulation: true,
            actor: { type: "ai_agent", agent: "hugo", userId: null },
          }),
          entry({ id: "3", kind: "ai_run", status: "succeeded", title: "Louis — Créneau proposé." }),
        ]}
      />,
    );

    const statuses = screen.getAllByTestId("run-status").map((node) => node.getAttribute("data-status"));
    expect(statuses).toEqual(["blocked", "failed"]);
    expect(screen.getByText("Bloquée par un garde-fou")).toBeDefined();
    expect(screen.getByText("Erreur technique")).toBeDefined();
  });
});

describe("ContactTimeline — glyph tiles", () => {
  it("draws one decorative tile per entry, shaped by who acted", () => {
    const { container } = render(
      <ContactTimeline
        entries={[
          entry({ id: "1", kind: "ai_run", actor: { type: "ai_agent", agent: "hugo", userId: null }, isSimulation: true }),
          entry({ id: "2", kind: "task", actor: { type: "user", agent: null, userId: "u1" } }),
        ]}
      />,
    );

    const tiles = Array.from(container.querySelectorAll('[data-testid="timeline-mark"]'));
    expect(tiles.map((tile) => tile.getAttribute("data-kind"))).toEqual(["agent", "human"]);
    for (const tile of tiles) expect(tile.getAttribute("aria-hidden")).toBe("true");
    // The simulation badge and the words stay.
    expect(screen.getAllByText(APP_TEXTS.states.simulation)).toHaveLength(1);
    expect(screen.getByText("Hugo")).toBeDefined();
  });
});
