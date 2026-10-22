// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GOALS } from "@/modules/profiles/goals";
import { LINK_KINDS } from "@/modules/profiles/block-options";
import { PLATFORMS } from "@/modules/profiles/platform-registry";
const m = vi.hoisted(() => ({ load: vi.fn(), mutate: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: m.refresh }) }));
vi.mock("../../profiles/[profileId]/scenes/[sceneId]/actions", () => ({ loadItemAction: m.load, mutateItemAction: m.mutate }));
import { SetupLinks } from "./setup-links";
import { setupDraft } from "./setup-draft";
const item = { id: "l1", type: "link" as const, visible: true, content: { kind: "linkedin", label: null, url: "https://linkedin.com/in/ana" }, summary: "LinkedIn" };
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); });
afterEach(() => vi.unstubAllGlobals());
async function mount(goal: keyof typeof GOALS | null = null, blocks = [] as typeof item[]) {
 const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
 await act(async () => root.render(<SetupLinks suffix="TEST" goal={goal} profileId="p1" sceneId="s1" blocks={blocks} view={setupDraft(null, { fullName: "Ana" })} />));
 return { host, close: async () => { await act(async () => root.unmount()); host.remove(); } };
}
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.trim() === text || b.getAttribute("aria-label") === text)!;
test.each([null, "networking", "freelance", "business", "student"] as const)("%s suggestions follow canonical Goal order; no automatic creation", async goal => {
 const { host, close } = await mount(goal);
 try {
  const expected = goal ? GOALS[goal].suggestions : ["linkedin", "facebook", "instagram", "custom"];
  expect([...host.querySelectorAll('[aria-label="Suggested additions"] button')].map(b => b.getAttribute("data-suggestion"))).toEqual(expected.map(s => typeof s === "string" ? s : "resume"));
  expect(m.mutate).not.toHaveBeenCalled(); expect(host.textContent).toContain("Nothing added yet");
  expect([...host.querySelectorAll("a")].find(a => a.textContent === "Skip for now")?.getAttribute("href")).toBe("?step=look");
  expect(host.querySelector('[data-layout] a[href*="example"]')).toBeNull();
 } finally { await close(); }
});
test("full chooser retains all 22 supported platforms and supported content/actions", async () => {
 const { close } = await mount();
 try {
  await act(async () => button("Add something else").click());
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(LINK_KINDS).toHaveLength(22);
  for (const kind of LINK_KINDS.filter(kind => kind !== "booking")) expect(dialog.textContent).toContain(PLATFORMS[kind].label);
  expect(dialog.textContent).toContain("Book a meeting");
  expect(dialog.textContent).toContain("Contact form"); expect(dialog.textContent).toContain("Project");
  expect(m.mutate).not.toHaveBeenCalled();
 } finally { await close(); }
});
test("Resume opens existing Custom fields with only its label prefilled", async () => {
 const { close } = await mount("student");
 try {
  await act(async () => button("Add Resume").click());
  expect(document.querySelector<HTMLInputElement>('[name="label"]')?.value).toBe("Resume");
  expect(document.querySelector<HTMLInputElement>('[name="url"]')?.value).toBe("");
  expect(m.mutate).not.toHaveBeenCalled();
 } finally { await close(); }
});
test("invalid destination stays editable; explicit add uses the existing mutation", async () => {
 const { close } = await mount("networking");
 try {
  await act(async () => button("Add LinkedIn").click());
  m.mutate.mockResolvedValue({ error: "Check the highlighted fields and try again.", fields: { url: "Enter a valid link." } });
  await act(async () => document.querySelector("[role=dialog] form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(m.mutate).toHaveBeenCalledTimes(1);
  expect(m.mutate.mock.calls[0][0].get("operation")).toBe("add");
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Enter a valid link.");
  expect(document.activeElement?.getAttribute("name")).toBe("url");
 } finally { await close(); }
});
test("existing hidden items stay listed; Remove uses intentional existing confirmation", async () => {
 const { host, close } = await mount(null, [{ ...item, visible: false }]);
 try {
  expect(host.textContent).toContain("Hidden");
  m.mutate.mockResolvedValue({ ok: true, blockId: "l1" });
  await act(async () => button("Remove LinkedIn").click());
  await act(async () => button("Remove").click());
  const data = m.mutate.mock.calls[0][0] as FormData;
  expect(data.get("operation")).toBe("remove"); expect(data.get("confirm")).toBe("on");
  expect(data.get("blockId")).toBe("l1"); expect(m.refresh).toHaveBeenCalled();
 } finally { await close(); }
});

async function setInput(name: string, value: string) {
 const input = document.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
 await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
test("editing a saved link preserves its id and kind through the canonical update", async () => {
 const { close } = await mount(null, [item]);
 try {
  m.load.mockResolvedValue({ ...item, sceneId: "s1", form: null });
  m.mutate.mockResolvedValue({ ok: true });
  await act(async () => button("Edit LinkedIn").click());
  expect(m.load).toHaveBeenCalledWith("p1", "s1", "l1");
  await setInput("url", "https://linkedin.com/in/updated");
  await act(async () => document.querySelector("[role=dialog] form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  const data = m.mutate.mock.calls[0][0] as FormData;
  expect(data.get("operation")).toBe("update"); expect(data.get("blockId")).toBe("l1");
  expect(data.get("kind")).toBe("linkedin"); expect(data.get("url")).toBe("https://linkedin.com/in/updated");
  expect(m.refresh).toHaveBeenCalled();
 } finally { await close(); }
});
test("real preview renders saved public links without hidden links or fake placeholders", async () => {
 const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
 const view = setupDraft(null, { fullName: "Ana" });
 view.blocks = [{ id: "l1", type: "link", kind: "custom", label: "Portfolio", url: "https://ana.example.test/work" }];
 try {
  await act(async () => root.render(<SetupLinks suffix="TEST" goal={null} profileId="p1" sceneId="s1" blocks={[item]} view={view} />));
  expect(host.querySelector('[data-layout] a[href="https://ana.example.test/work"]')).not.toBeNull();
  await act(async () => button("Preview").click());
  expect(document.querySelector('[role="dialog"] a[href="https://ana.example.test/work"]')).not.toBeNull();
 } finally { await act(async () => root.unmount()); host.remove(); }
});
