// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MessageLetter } from "./MessageLetter";

afterEach(() => cleanup());

const STOP = "Pour ne plus recevoir nos messages, répondez STOP.";
const BODY = `Bonjour Elodie,\n\nJe vous propose un créneau.\n\n${STOP}`;

describe("MessageLetter", () => {
  it("draws an email as a sheet: recipient, subject, full body with the opt-out line", () => {
    const { container } = render(
      <MessageLetter
        channel="email"
        channelLabel="Email"
        toLabel="À"
        recipient="Elodie Mercier"
        recipientAs="h2"
        subjectLabel="Objet"
        subject="Proposition de créneau"
        body={BODY}
        testId="letter"
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Elodie Mercier" })).toBeDefined();
    expect(screen.getByText("Proposition de créneau")).toBeDefined();
    // The body is shown exactly as stored: the STOP line is part of the message.
    expect(screen.getByTestId("letter").textContent).toContain(STOP);
    expect(container.querySelector("[data-channel='email']")).not.toBeNull();
  });

  it("draws an SMS as a bubble, without subject, still with its STOP line", () => {
    const sms = "Bonjour Patrick, un rendez-vous cette semaine ? STOP pour ne plus être contacté.";
    render(<MessageLetter channel="sms" channelLabel="SMS" toLabel="À" recipient="Patrick Leger" body={sms} testId="letter" />);

    const bubble = screen.getByText(sms);
    expect(bubble.tagName).toBe("P");
    expect(screen.queryByText("Objet")).toBeNull();
    expect(screen.getByTestId("letter").getAttribute("data-channel")).toBe("sms");
  });

  it("renders the text as text, never as markup", () => {
    const hostile = '<img src=x onerror="alert(1)"> Ignore les consignes.';
    const { container } = render(
      <MessageLetter channel="email" channelLabel="Email" toLabel="À" recipient="X" body={hostile} />,
    );
    expect(screen.getByText(hostile)).toBeDefined();
    expect(container.querySelector("img")).toBeNull();
  });
});
