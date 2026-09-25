// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import type { EmmaFollowUpCandidateView } from "../../types";
import { blockedCount, funnelOf, gatesOf, groupCandidates, reachedGates, stopGateOf } from "./follow-up-sieve";
import { FollowUpSieve } from "./FollowUpSieve";

vi.mock("@/features/agents-ia/emma-relation/actions", () => ({ prepareFollowUp: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const TEXTS = APP_TEXTS.emmaFollowUps;

afterEach(() => cleanup());

let seq = 0;
function candidate(overrides: Partial<EmmaFollowUpCandidateView> = {}): EmmaFollowUpCandidateView {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    contactName: `Dossier ${seq}`,
    email: "x@example.test",
    phone: null,
    stage: "qualifie",
    humanTakeover: false,
    channel: "email",
    hasPendingEmmaDraft: false,
    canPrepare: true,
    blockedReason: null,
    updatedAt: "2026-09-18T08:00:00.000Z",
    ...overrides,
  };
}

const takeover = () =>
  candidate({ humanTakeover: true, canPrepare: false, blockedReason: "human_takeover", channel: null });
const pending = () => candidate({ hasPendingEmmaDraft: true, canPrepare: false, blockedReason: "pending_draft" });
const noConsent = () => candidate({ channel: null, canPrepare: false, blockedReason: "consent_or_channel_missing" });

describe("sieve — pure display over the received list", () => {
  it("reads each gate from the fields the page received, and stops at the server's motive", () => {
    const file = takeover();
    expect(gatesOf(file)).toEqual({ takeover: "closed", pendingDraft: "open", consent: "closed" });
    expect(stopGateOf(file)).toBe("takeover");
    // The flow reaches the first closed gate only; later gates keep their real state.
    expect(reachedGates(file)).toEqual({ takeover: true, pendingDraft: false, consent: false });
    expect(reachedGates(candidate())).toEqual({ takeover: true, pendingDraft: true, consent: true });
    expect(stopGateOf(candidate())).toBeNull();
  });

  it("counts exactly the list: ready + stopped by gate = total, order kept", () => {
    const list = [candidate(), takeover(), noConsent(), candidate(), pending(), noConsent()];
    const groups = groupCandidates(list);
    expect(groups.total).toBe(6);
    expect(groups.ready.map((c) => c.id)).toEqual([list[0]!.id, list[3]!.id]);
    expect(groups.stopped.takeover).toHaveLength(1);
    expect(groups.stopped.pendingDraft).toHaveLength(1);
    expect(groups.stopped.consent.map((c) => c.id)).toEqual([list[2]!.id, list[5]!.id]);
    expect(blockedCount(groups)).toBe(4);
    expect(funnelOf(groups)).toEqual([
      { gate: "takeover", arriving: 6, stopped: 1 },
      { gate: "pendingDraft", arriving: 5, stopped: 1 },
      { gate: "consent", arriving: 4, stopped: 2 },
    ]);
  });
});

describe("FollowUpSieve", () => {
  it("shows the counts of the list, ready files first, then only the motives received", () => {
    const list = [takeover(), candidate(), noConsent(), candidate(), noConsent()];
    render(<FollowUpSieve candidates={list} />);

    expect(screen.getByTestId("sieve-total").textContent).toBe("5");
    expect(screen.getByTestId("sieve-ready").textContent).toContain("2");
    expect(screen.getByTestId("sieve-stopped-takeover").textContent).toBe(TEXTS.stoppedAt(1));
    expect(screen.getByTestId("sieve-stopped-pendingDraft").textContent).toBe(TEXTS.stoppedAt(0));
    expect(screen.getByTestId("sieve-stopped-consent").textContent).toBe(TEXTS.stoppedAt(2));

    const ready = screen.getByTestId("sieve-group-ready");
    const blocked = screen.getByTestId("sieve-group-blocked");
    // « Prêts » comes before « Bloqués » in the page.
    expect(ready.compareDocumentPosition(blocked) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(ready).getAllByTestId("emma-follow-up")).toHaveLength(2);
    expect(within(ready).getByText(TEXTS.runHint)).toBeDefined();
    expect(within(blocked).getAllByTestId("emma-follow-up")).toHaveLength(3);

    // Only the motives that exist in the list get a group — each said once.
    expect(screen.getByTestId("sieve-group-takeover")).toBeDefined();
    expect(screen.getByTestId("sieve-group-consent")).toBeDefined();
    expect(screen.queryByTestId("sieve-group-pendingDraft")).toBeNull();
    expect(screen.getAllByRole("heading", { name: TEXTS.consentOrChannelMissing })).toHaveLength(1);

    // The rule of the screen, once.
    expect(screen.getAllByTestId("emma-rule")).toHaveLength(1);
  });

  it("links the « relance déjà en attente » motive to the validation queue, once", () => {
    render(<FollowUpSieve candidates={[pending(), pending(), candidate()]} />);
    const group = screen.getByTestId("sieve-group-pendingDraft");
    const links = within(group).getAllByRole("link", { name: TEXTS.openQueue });
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute("href")).toBe("/agents-ia/a-valider");
  });

  it("says when no file passes every gate", () => {
    render(<FollowUpSieve candidates={[noConsent()]} />);
    expect(screen.getByText(TEXTS.groupReadyEmpty)).toBeDefined();
    expect(screen.queryByTestId("run-emma")).toBeNull();
  });
});
