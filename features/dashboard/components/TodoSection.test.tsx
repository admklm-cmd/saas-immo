// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import { makeSummary, message, okList, SCOPES } from "./summary-fixture";
import { TODO_ROW_SAMPLE } from "./TodoRow";
import { TodoSection } from "./TodoSection";

const TEXTS = APP_TEXTS.dashboard;

afterEach(() => cleanup());

function hrefs(container: HTMLElement): string[] {
  return within(container)
    .getAllByRole("link")
    .map((link) => link.getAttribute("href") ?? "");
}

describe("TodoSection", () => {
  it("affiche le total exact, les deux premiers éléments annoncés comme tels, et le lien explicite vers la file", () => {
    const todo = makeSummary().todo;
    const items = Array.from({ length: 5 }, (_, index) =>
      message({ id: `m-${index}`, contactId: `c-${index}`, contactName: `Contact ${index}` }),
    );
    todo.messagesToValidate = okList(SCOPES.pending, items, 12);

    render(<TodoSection todo={todo} />);

    const card = screen.getByTestId("dashboard-messages");
    expect(within(card).getByTestId("dashboard-figure").textContent).toContain("12");
    expect(card.textContent).toContain(TEXTS.messagesUnit(12));
    expect(card.textContent).toContain(TEXTS.scopes.pending_all_time);
    expect(card.textContent).toContain(TEXTS.sample(TODO_ROW_SAMPLE, 12));
    expect(within(card).getAllByRole("listitem")).toHaveLength(TODO_ROW_SAMPLE);

    const open = within(card).getByRole("link", { name: new RegExp(TEXTS.messagesLink) });
    expect(open.getAttribute("href")).toBe("/agents-ia/a-valider");
    expect(hrefs(card)).toContain("/contacts/c-0");
  });

  it("sans suite, n'annonce pas d'échantillon et garde un lien explicite vers la file", () => {
    render(<TodoSection todo={makeSummary().todo} />);

    const card = screen.getByTestId("dashboard-messages");
    expect(card.textContent).not.toContain(TEXTS.sample(1, 1));
    expect(within(card).getByRole("link", { name: new RegExp(TEXTS.messagesLink) }).getAttribute("href")).toBe(
      "/agents-ia/a-valider",
    );
  });

  it("dit honnêtement que le compteur des messages inclut les validés non envoyés", () => {
    const todo = makeSummary().todo;
    todo.messagesToValidate = okList(SCOPES.pending, [message({ status: "approved" })]);

    render(<TodoSection todo={todo} />);

    const card = screen.getByTestId("dashboard-messages");
    expect(card.textContent).toContain(TEXTS.messagesUnit(1));
    expect(TEXTS.messagesUnit(2)).toContain("pas encore envoyés");
    // The short hint still names BOTH states the figure counts.
    expect(card.textContent).toContain(TEXTS.messagesHint);
    expect(TEXTS.messagesHint).toMatch(/À valider/);
    expect(TEXTS.messagesHint).toMatch(/validés en attente d’envoi/);
    expect(card.textContent).toContain(TEXTS.approvedNotSent);
  });

  it("un état vide tient en une seule rangée, à la place du premier élément", () => {
    render(<TodoSection todo={makeSummary().todo} />);

    const toClose = screen.getByTestId("dashboard-appointments-to-close");
    const empty = within(toClose).getByTestId("dashboard-empty");
    expect(empty.textContent).toContain(TEXTS.toCloseEmpty);
    expect(within(toClose).queryByRole("list")).toBeNull();
    // One row of one panel, sharing the column grid of its neighbours: no card of its own.
    expect(toClose.className).toContain("lg:grid-cols-[18rem_minmax(0,1fr)]");
    expect(toClose.parentElement?.className).toContain("divide-y");
  });

  it("un indicateur indisponible n'affiche ni liste ni faux état vide", () => {
    const todo = makeSummary().todo;
    todo.appointmentsToClose = { status: "unavailable", scope: SCOPES.pending };

    render(<TodoSection todo={todo} />);

    const toClose = screen.getByTestId("dashboard-appointments-to-close");
    expect(within(toClose).queryByTestId("dashboard-empty")).toBeNull();
    expect(toClose.textContent).toContain(TEXTS.unavailable);
  });

  it("marque les messages et rendez-vous simulés d'un badge « Simulation »", () => {
    render(<TodoSection todo={makeSummary().todo} />);

    expect(within(screen.getByTestId("dashboard-messages")).getByText(APP_TEXTS.states.simulation)).toBeDefined();
    expect(
      within(screen.getByTestId("dashboard-appointments-to-confirm")).getByText(APP_TEXTS.states.simulation),
    ).toBeDefined();
  });

  it("n'affiche pas de badge « Simulation » sur un élément réel", () => {
    const todo = makeSummary().todo;
    todo.messagesToValidate = okList(SCOPES.pending, [message({ isSimulation: false })]);

    render(<TodoSection todo={todo} />);

    expect(within(screen.getByTestId("dashboard-messages")).queryByText(APP_TEXTS.states.simulation)).toBeNull();
  });

  it("relie chaque élément au bon écran", () => {
    render(<TodoSection todo={makeSummary().todo} />);

    // Lead: no contact file yet → the inbox.
    const leads = screen.getByTestId("dashboard-leads");
    expect(hrefs(leads).every((href) => href === "/agents-ia/leads-entrants")).toBe(true);

    // Appointment → its contact file + the follow-through screen.
    const toConfirm = screen.getByTestId("dashboard-appointments-to-confirm");
    expect(hrefs(toConfirm)).toEqual(["/contacts/contact-frederic", "/agents-ia/suivi-rendez-vous"]);

    // Task → its contact file.
    expect(hrefs(screen.getByTestId("dashboard-tasks"))).toContain("/contacts/contact-camille");
  });

  it("ne crée aucun lien pour une tâche d'agence sans contact", () => {
    const todo = makeSummary().todo;
    todo.openTasks = okList(SCOPES.open, [
      {
        id: "task-agency",
        contactId: null,
        contactName: null,
        type: "other",
        title: "Mettre à jour les mentions légales",
        dueAt: "2026-09-25T08:00:00.000Z",
        createdByAgent: null,
        createdAt: "2026-09-19T08:00:00.000Z",
      },
    ]);

    render(<TodoSection todo={todo} />);

    const tasks = screen.getByTestId("dashboard-tasks");
    expect(tasks.textContent).toContain(TEXTS.agencyTask);
    expect(hrefs(tasks)).toEqual(["/taches"]);
  });

  it("« Tâches ouvertes » mène à l'écran Tâches et annonce l'échantillon partiel", () => {
    const todo = makeSummary().todo;
    const first = todo.openTasks.status === "ok" ? todo.openTasks.value.items[0] : undefined;
    if (!first) throw new Error("fixture");
    const items = Array.from({ length: 5 }, (_, index) => ({ ...first, id: `t-${index}` }));
    todo.openTasks = okList(SCOPES.open, items, 131);

    render(<TodoSection todo={todo} />);

    const tasks = screen.getByTestId("dashboard-tasks");
    expect(tasks.textContent).toContain(TEXTS.sampleFeminine(TODO_ROW_SAMPLE, 131));
    expect(within(tasks).getByRole("link", { name: new RegExp(TEXTS.tasksLink) }).getAttribute("href")).toBe("/taches");
  });

  it("affiche « 0 » et l'état vide quand la liste mesurée est vide", () => {
    render(<TodoSection todo={makeSummary().todo} />);

    const toClose = screen.getByTestId("dashboard-appointments-to-close");
    expect(within(toClose).getByTestId("dashboard-figure").textContent).toContain("0");
    expect(toClose.textContent).toContain(TEXTS.toCloseEmpty);
  });

  it("un indicateur indisponible ne masque pas les autres", () => {
    const todo = makeSummary().todo;
    todo.openTasks = { status: "unavailable", scope: SCOPES.open };

    render(<TodoSection todo={todo} />);

    const tasks = screen.getByTestId("dashboard-tasks");
    expect(tasks.textContent).toContain(TEXTS.unavailable);
    expect(tasks.textContent).toContain(TEXTS.scopes.open_all_time);
    expect(tasks.textContent).not.toContain(TEXTS.tasksEmpty);
    // Still a way to the work.
    expect(hrefs(tasks)).toEqual(["/taches"]);

    expect(screen.getByTestId("dashboard-messages").textContent).not.toContain(TEXTS.unavailable);
    expect(screen.getByTestId("dashboard-leads").textContent).not.toContain(TEXTS.unavailable);
  });

  it("rend un titre de tâche et un nom de contact malveillants comme du texte, sans HTML ni détournement de lien", () => {
    const payload = `<img src=x onerror="alert(1)"><script>alert(2)</script>`;
    const todo = makeSummary().todo;
    todo.openTasks = okList(SCOPES.open, [
      {
        id: "task-xss",
        contactId: "../../agents-ia?x=1",
        contactName: payload,
        type: "other",
        title: payload,
        dueAt: null,
        createdByAgent: null,
        createdAt: "2026-09-19T08:00:00.000Z",
      },
    ]);
    todo.messagesToValidate = okList(SCOPES.pending, [message({ contactName: payload })]);

    const { container } = render(<TodoSection todo={todo} />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
    const tasks = screen.getByTestId("dashboard-tasks");
    expect(tasks.textContent).toContain(payload);
    // The id stays one path segment under /contacts/.
    expect(hrefs(tasks)).toContain(`/contacts/${encodeURIComponent("../../agents-ia?x=1")}`);
    expect(hrefs(tasks).every((href) => href === "/taches" || href.startsWith("/contacts/"))).toBe(true);
  });

  it("signale par la forme ce qui attend un humain : anneau actif seulement quand le total est positif", () => {
    const todo = makeSummary().todo;
    todo.openTasks = { status: "unavailable", scope: SCOPES.open };

    const { container } = render(<TodoSection todo={todo} />);

    const state = (id: string) =>
      container.querySelector(`[data-testid="dashboard-${id}"] [data-kind="human"]`)?.getAttribute("data-state");
    expect(state("messages")).toBe("active");
    expect(state("appointments-to-close")).toBe("idle");
    expect(state("tasks")).toBe("inactive");
    expect(screen.getByTestId("dashboard-messages").getAttribute("data-waiting")).toBe("true");
    expect(screen.getByTestId("dashboard-appointments-to-close").getAttribute("data-waiting")).toBe("false");
  });

  it("présente un lead par sa source et sa date, sans texte libre du prospect", () => {
    render(<TodoSection todo={makeSummary().todo} />);

    const leads = screen.getByTestId("dashboard-leads");
    expect(leads.textContent).toContain(TEXTS.leadItem("Formulaire d'estimation"));
  });
});
