// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ reveal: vi.fn(), save: vi.fn() }));
vi.mock("../../actions", () => ({ revealActivationCodeAction: m.reveal, saveExistingActivationCodeAction: m.save }));
import { ActivationCode } from "./activation-code";

const cardId = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const credentialId = "5a2b8f64-5717-4562-b3fc-2c963f66afa7";
const CODE = "N8KF-42PQ";
let host: HTMLElement; let root: ReturnType<typeof createRoot>;
const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
async function mount(props: Partial<React.ComponentProps<typeof ActivationCode>> = {}) {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<ActivationCode cardId={cardId} credentialId={credentialId} retrievable {...props} />));
}
const button = (name: RegExp) => [...host.querySelectorAll("button")].find((b) => name.test(b.textContent ?? "")) as HTMLButtonElement | undefined;
const click = (el: HTMLElement | undefined) => act(async () => el!.click());
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
  m.reveal.mockResolvedValue({ reveal: { code: CODE } });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

test("the initial render contains no plaintext and offers only Show activation code", async () => {
  await mount();
  expect(host.innerHTML).not.toContain(CODE);
  expect(button(/Show activation code/)).toBeDefined();
  expect(button(/^Copy/)).toBeUndefined();
  expect(button(/^Hide/)).toBeUndefined();
  expect(m.reveal).not.toHaveBeenCalled();
});

test("Show calls the authorized reveal action for this card and credential, then offers Copy and Hide", async () => {
  await mount();
  await click(button(/Show activation code/));
  const sent = m.reveal.mock.calls[0][1] as FormData;
  expect([sent.get("cardId"), sent.get("credentialId")]).toEqual([cardId, credentialId]);
  expect(host.textContent).toContain(CODE);
  await click(button(/Copy activation code/));
  expect(clipboard.writeText).toHaveBeenCalledWith(CODE);
  expect(host.querySelector('[role="status"]')?.textContent).toMatch(/copied/i);
});

test("Hide clears the code from the page", async () => {
  await mount();
  await click(button(/Show activation code/));
  await click(button(/^Hide/));
  expect(host.innerHTML).not.toContain(CODE);
  expect(button(/Show activation code/)).toBeDefined();
});

test("the code is cleared when the tab is hidden", async () => {
  await mount();
  await click(button(/Show activation code/));
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(host.innerHTML).not.toContain(CODE);
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

test("a refused reveal (claimed, revoked or replaced) announces an error and never shows a code", async () => {
  m.reveal.mockResolvedValue({ error: "The activation code could not be shown. Reload the card and try again." });
  await mount();
  await click(button(/Show activation code/));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("could not be shown");
  expect(host.innerHTML).not.toContain(CODE);
  expect(button(/^Copy/)).toBeUndefined();
});

test("the code is never written to browser storage", async () => {
  const set = vi.spyOn(Storage.prototype, "setItem");
  await mount();
  await click(button(/Show activation code/));
  expect(set).not.toHaveBeenCalled();
  expect(JSON.stringify({ ...localStorage })).not.toContain(CODE);
  expect(JSON.stringify({ ...sessionStorage })).not.toContain(CODE);
});

test("a legacy credential explains itself honestly and offers to save the existing package code, never to replace it", async () => {
  await mount({ retrievable: false });
  expect(host.textContent).toMatch(/older credential/i);
  expect(button(/Show activation code/)).toBeUndefined();
  expect(host.querySelector('input[name="code"]')).not.toBeNull();
  expect(button(/Save existing code/)).toBeDefined();
  expect(host.textContent).not.toMatch(/replace/i);
});

test("a reveal still in flight when the tab is hidden never sets the code afterwards", async () => {
  let resolve!: (value: unknown) => void;
  m.reveal.mockReturnValue(new Promise((r) => { resolve = r; }));
  await mount();
  await click(button(/Show activation code/));
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  await act(async () => { resolve({ reveal: { code: CODE } }); });
  expect(host.innerHTML).not.toContain(CODE);
  expect(button(/^Copy/)).toBeUndefined();
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});
