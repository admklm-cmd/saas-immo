// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const { SignInForm } = await import("./SignInForm");

afterEach(() => cleanup());

describe("SignInForm", () => {
  it("declares method=post, so a submission before hydration never puts the password in the URL", () => {
    const { container } = render(<SignInForm redirectTo="/contacts" />);
    const form = container.querySelector("form");
    expect(form?.getAttribute("method")).toBe("post");
    expect(form?.querySelector("input[type=password]")).not.toBeNull();
  });
});
