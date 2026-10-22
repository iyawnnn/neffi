// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
import { SetupForm } from "./setup-form";
afterEach(() => { vi.unstubAllGlobals(); push.mockClear(); });
test("dirty setup protects reload and Back, cancel keeps input, discard navigates", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<><a href="?step=goal">Back</a><SetupForm action={() => {}}><input name="name" defaultValue="" /><button type="submit">Continue</button></SetupForm></>));
    const clean = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(clean); expect(clean.defaultPrevented).toBe(false);
    const input = host.querySelector("input")!; input.value = "Ana";
    await act(async () => input.dispatchEvent(new Event("input", { bubbles: true })));
    const dirty = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(dirty); expect(dirty.defaultPrevented).toBe(true);
    await act(async () => host.querySelector("a")!.click());
    expect(document.body.textContent).toContain("Discard changes?");
    await act(async () => [...document.querySelectorAll("button")].find(button => button.textContent === "Keep editing")!.click());
    expect(input.value).toBe("Ana"); expect(push).not.toHaveBeenCalled();
    await act(async () => host.querySelector("a")!.click());
    await act(async () => [...document.querySelectorAll("button")].find(button => button.textContent === "Discard changes")!.click());
    expect(push).toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); host.remove(); }
});
