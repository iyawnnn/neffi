// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ProfileActionState } from "../actions";
import type { DetailsProfile } from "./identity-values";

const m = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("../actions", () => ({ updateIdentityAction: m.save }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, push: m.push }) }));
import { IdentityForm } from "./identity-form";

const profile: DetailsProfile = { id: "p1", fullName: "Ana", headline: null, company: null, bio: null, phone: null, email: null, website: null, location: null };
let root: Root;
let host: HTMLDivElement;

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<IdentityForm profile={profile} />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const input = (name: string) => host.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
async function edit(name: string, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(name), value);
    input(name).dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

test("phone validation stays on blur/submit and never submits invalid PH input", async () => {
  await edit("phone", "0917");
  expect(host.querySelector('[role="alert"]')).toBeNull();
  await act(async () => input("phone").dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Enter a valid Philippine mobile number.");
  await submit();
  expect(m.save).not.toHaveBeenCalled();
  expect(input("phone").value).toBe("0917");
});

test("server validation displays inline errors, focuses the field and preserves entered values", async () => {
  m.save.mockResolvedValue({ fields: ["email"], error: "Check the highlighted fields and try again." });
  await edit("email", "invalid-email");
  await submit();
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Enter a valid email, such as name@example.com.");
  expect(document.activeElement).toBe(input("email"));
  expect(input("email").value).toBe("invalid-email");
  expect(host.textContent).toContain("Unsaved changes");
  expect(document.body.textContent).not.toContain("Couldn’t save changes");
});

test("save sends a normalized PH number, prevents duplicates and adopts server-normalized values", async () => {
  const pending = Promise.withResolvers<ProfileActionState>();
  m.save.mockReturnValue(pending.promise);
  await edit("phone", "0917 123 4567");
  await edit("website", "example.com");
  await submit();
  expect(host.textContent).toContain("Saving changes…");
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  expect((m.save.mock.calls[0][1] as FormData).get("phone")).toBe("+639171234567");
  await submit();
  expect(m.save).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve({ ok: "Saved.", identity: { fullName: "Ana", headline: null, company: null, bio: null, phone: "+639171234567", email: null, website: "https://example.com/", location: null } }));
  expect(input("website").value).toBe("https://example.com/");
  expect(input("phone").value).toBe("9171234567");
  expect(host.textContent).toContain("All changes saved");
  expect(document.body.textContent).toContain("Details updated");
  expect(m.refresh).toHaveBeenCalledOnce();
  expect(m.push).not.toHaveBeenCalled();
});

test("network failures keep the form dirty and preserve entered values", async () => {
  m.save.mockRejectedValue(new Error("network failure"));
  await edit("website", "example.com");
  await submit();
  expect(input("website").value).toBe("example.com");
  expect(host.textContent).toContain("Unsaved changes");
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  expect(document.body.textContent).toContain("Couldn’t save changes");
  expect(document.body.textContent).toContain("Your changes are still here. Try again.");
});
