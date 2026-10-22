// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { PublicForm } from "./public-form";

afterEach(() => vi.unstubAllGlobals());
test("the restyled form submits and announces success without changing its request contract", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const send = vi.fn<typeof fetch>(async () => new Response("{}", { status: 201 }));
  vi.stubGlobal("fetch", send);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<PublicForm formId="form" title="Get in touch" fields={[{ key: "email", label: "Email", kind: "email", required: true }]} />));
    host.querySelector<HTMLInputElement>('[name="email"]')!.value = "visitor@example.test";
    await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe("/api/forms/form/submissions");
    expect(JSON.parse(String(send.mock.calls[0][1]?.body))).toMatchObject({ answers: { email: "visitor@example.test" } });
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Thanks, your message was sent.");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
