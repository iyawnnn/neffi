// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
vi.mock("./actions", () => ({ submitSupportAction: vi.fn() }));
import { SupportForm } from "./support-form";

test("same-page recovery navigation selects the new topic without discarding the contact draft", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<SupportForm email="draft@example.test" clientKey="00000000-0000-4000-8000-000000000001" topic="other" />));
    expect(host.querySelector<HTMLSelectElement>("select")!.value).toBe("other");
    await act(async () => root.render(<SupportForm email="draft@example.test" clientKey="00000000-0000-4000-8000-000000000001" topic="recovery" />));
    expect(host.querySelector<HTMLSelectElement>("select")!.value).toBe("recovery");
    expect(host.querySelector<HTMLInputElement>('[name="email"]')!.value).toBe("draft@example.test");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
