// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import type { PipelineStage } from "@/features/contacts/types";

import { PipelineStageChangeProvider } from "./PipelineStageChangeProvider";
import { PipelineStageMenu } from "./PipelineStageMenu";

const TEXTS = APP_TEXTS.pipeline.stageChange;
const changeContactStage = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("@/features/pipeline/actions", () => ({ changeContactStage }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const CONTACT_ID = "11111111-1111-4111-8111-111111111111";

beforeAll(() => {
  // jsdom has <dialog> but not its modal API: the minimum the component relies on.
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal: () => void; close: () => void };
  if (typeof proto.showModal !== "function" || !String(proto.showModal).includes("setAttribute")) {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    proto.close = function close(this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  }
});

beforeEach(() => {
  changeContactStage.mockReset();
  refresh.mockReset();
});

afterEach(() => cleanup());

function success(previousStage: PipelineStage, stage: PipelineStage) {
  return {
    data: {
      contactId: CONTACT_ID,
      previousStage,
      stage,
      activityId: "22222222-2222-4222-8222-222222222222",
      changedAt: "2026-09-23T10:00:00.000Z",
    },
    error: null,
  };
}

function renderMenu(stage: PipelineStage, canExitSignedMandate = false) {
  return render(
    <PipelineStageChangeProvider>
      <PipelineStageMenu
        contactId={CONTACT_ID}
        contactName="Olivier Sanchez"
        stage={stage}
        canExitSignedMandate={canExitSignedMandate}
      />
    </PipelineStageChangeProvider>,
  );
}

function openMenu() {
  const trigger = screen.getByRole("button", { name: new RegExp(TEXTS.trigger) });
  fireEvent.click(trigger);
  return { trigger, menu: screen.getByRole("group", { name: TEXTS.menuTitle }) };
}

function option(menu: HTMLElement, label: string) {
  return within(menu).getByRole("button", { name: new RegExp(`^${label}`) });
}

describe("PipelineStageMenu — accessible menu", () => {
  it("is a disclosure named after the contact, listing every stage with the current one marked", () => {
    renderMenu("qualifie");

    const trigger = screen.getByRole("button", { name: `${TEXTS.trigger} ${TEXTS.triggerFor("Olivier Sanchez")}` });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    const { menu } = openMenu();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(within(menu).getAllByRole("button")).toHaveLength(7);

    const current = option(menu, "Qualifié");
    expect(current.getAttribute("aria-current")).toBe("true");
    expect(current.getAttribute("aria-disabled")).toBe("true");
    // Focus lands on the first selectable stage.
    expect(document.activeElement).toBe(option(menu, "Nouveau"));
  });

  it("moves with the arrow keys and closes on Escape, giving the focus back to the trigger", () => {
    renderMenu("nouveau");
    const { trigger, menu } = openMenu();

    expect(document.activeElement).toBe(option(menu, "Qualifié"));
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(option(menu, "Chaud"));
    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement).toBe(option(menu, "Perdu"));

    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("group", { name: TEXTS.menuTitle })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("clicking the current stage sends nothing", () => {
    renderMenu("chaud");
    const { menu } = openMenu();
    fireEvent.click(option(menu, "Chaud"));
    expect(changeContactStage).not.toHaveBeenCalled();
  });
});

describe("PipelineStageMenu — plain move", () => {
  it("sends the move once, announces it politely and refreshes the board", async () => {
    let resolve: (value: unknown) => void = () => {};
    changeContactStage.mockReturnValue(new Promise((r) => (resolve = r)));
    renderMenu("qualifie");
    const { menu } = openMenu();

    const chaud = option(menu, "Chaud");
    fireEvent.click(chaud);
    // Double click while the request is running: still a single call.
    fireEvent.click(chaud);
    fireEvent.click(option(menu, "Perdu"));
    expect(changeContactStage).toHaveBeenCalledTimes(1);
    expect(changeContactStage).toHaveBeenCalledWith({
      contactId: CONTACT_ID,
      stage: "chaud",
      mandateConfirmed: false,
      reason: null,
    });
    expect(chaud.getAttribute("aria-busy")).toBe("true");
    expect(within(menu).getByText(TEXTS.pending)).toBeDefined();

    await act(async () => resolve(success("qualifie", "chaud")));

    expect(screen.getByTestId("pipeline-stage-status").textContent).toContain(
      TEXTS.success("Olivier Sanchez", "Chaud"),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("group", { name: TEXTS.menuTitle })).toBeNull();
  });

  it("shows the server message as is, keeping the menu and the selection", async () => {
    const message = "Ce contact est déjà à cette étape : rien n'a été modifié.";
    changeContactStage.mockResolvedValue({ data: null, error: { code: "stage_unchanged", message } });
    renderMenu("qualifie");
    const { menu } = openMenu();

    await act(async () => {
      fireEvent.click(option(menu, "Chaud"));
    });

    const alert = within(menu).getByRole("alert");
    expect(alert.textContent).toContain(TEXTS.errorTitle);
    expect(alert.textContent).toContain(message);
    expect(option(menu, "Chaud").className).toContain("font-medium");
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByTestId("pipeline-stage-status").textContent).toBe("");
  });
});

describe("PipelineStageMenu — entering « Mandat signé »", () => {
  it("opens a modal confirmation whose box starts unticked and blocks the confirmation", async () => {
    changeContactStage.mockResolvedValue(success("estimation_faite", "mandat_signe"));
    renderMenu("estimation_faite");
    const { menu } = openMenu();

    fireEvent.click(option(menu, "Mandat signé"));
    expect(changeContactStage).not.toHaveBeenCalled();

    const dialog = screen.getByTestId("mandate-enter-dialog");
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(within(dialog).getByRole("heading", { name: TEXTS.enterTitle })).toBeDefined();
    expect(within(dialog).getByText(TEXTS.enterHumanRule)).toBeDefined();

    const box = within(dialog).getByRole("checkbox", { name: TEXTS.enterCheckbox }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    const confirm = within(dialog).getByRole("button", { name: TEXTS.enterSubmit }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(changeContactStage).not.toHaveBeenCalled();

    fireEvent.click(box);
    expect(confirm.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(confirm);
    });

    expect(changeContactStage).toHaveBeenCalledWith({
      contactId: CONTACT_ID,
      stage: "mandat_signe",
      mandateConfirmed: true,
      reason: null,
    });
    expect(screen.queryByTestId("mandate-enter-dialog")).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape without sending anything and gives the focus back to the trigger", () => {
    renderMenu("chaud");
    const { trigger, menu } = openMenu();
    fireEvent.click(option(menu, "Mandat signé"));

    const dialog = screen.getByTestId("mandate-enter-dialog");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));

    expect(screen.queryByTestId("mandate-enter-dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(changeContactStage).not.toHaveBeenCalled();
  });

  it("keeps the dialog and the ticked box when the server refuses", async () => {
    const message = "Confirmez explicitement la signature du mandat pour passer ce contact en « Mandat signé ».";
    changeContactStage.mockResolvedValue({ data: null, error: { code: "x", message } });
    renderMenu("chaud");
    const { menu } = openMenu();
    fireEvent.click(option(menu, "Mandat signé"));

    const dialog = screen.getByTestId("mandate-enter-dialog");
    const box = within(dialog).getByRole("checkbox") as HTMLInputElement;
    fireEvent.click(box);
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: TEXTS.enterSubmit }));
    });

    expect(within(dialog).getByRole("alert").textContent).toContain(message);
    expect(box.checked).toBe(true);
  });
});

describe("PipelineStageMenu — leaving « Mandat signé »", () => {
  it("is disabled for an agent, with the reason, and never reaches the server", () => {
    renderMenu("mandat_signe", false);
    const { menu } = openMenu();

    // Testing Library collapses the non-breaking spaces of the French copy.
    expect(within(menu).getByText(TEXTS.exitDirectorOnly.replace(/\s+/g, " "))).toBeDefined();
    const perdu = option(menu, "Perdu");
    expect(perdu.getAttribute("aria-disabled")).toBe("true");
    expect(perdu.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(perdu.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      TEXTS.exitDirectorOnly,
    );

    fireEvent.click(perdu);
    expect(screen.queryByTestId("mandate-exit-dialog")).toBeNull();
    expect(changeContactStage).not.toHaveBeenCalled();
  });

  it("asks a director for an explicit confirmation and a 3–500 character motive", async () => {
    changeContactStage.mockResolvedValue(success("mandat_signe", "estimation_faite"));
    renderMenu("mandat_signe", true);
    const { menu } = openMenu();
    fireEvent.click(option(menu, "Estimation faite"));

    const dialog = screen.getByTestId("mandate-exit-dialog");
    const box = within(dialog).getByRole("checkbox", { name: TEXTS.exitCheckbox }) as HTMLInputElement;
    const reason = within(dialog).getByRole("textbox", { name: TEXTS.reasonLabel }) as HTMLTextAreaElement;
    const confirm = within(dialog).getByRole("button", { name: TEXTS.exitSubmit }) as HTMLButtonElement;

    expect(box.checked).toBe(false);
    expect(reason.maxLength).toBe(500);
    expect(confirm.disabled).toBe(true);

    fireEvent.click(box);
    expect(confirm.disabled).toBe(true); // motive still missing

    fireEvent.change(reason, { target: { value: "  a " } });
    expect(confirm.disabled).toBe(true); // 1 meaningful character
    expect(within(dialog).getByTestId("mandate-exit-reason-counter").textContent).toBe(TEXTS.reasonCounter(4, 500));

    fireEvent.change(reason, { target: { value: "Mandat annulé par le vendeur" } });
    expect(confirm.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(confirm);
    });
    expect(changeContactStage).toHaveBeenCalledWith({
      contactId: CONTACT_ID,
      stage: "estimation_faite",
      mandateConfirmed: true,
      reason: "Mandat annulé par le vendeur",
    });
  });
});
