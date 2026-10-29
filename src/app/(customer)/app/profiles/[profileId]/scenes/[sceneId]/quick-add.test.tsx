// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ModeEditor, type ModeEditorControls } from "./mode-editor";
import { PRESETS } from "@/modules/forms/config";

const m = vi.hoisted(() => ({ mutate: vi.fn(), load: vi.fn(), refresh: vi.fn() }));
vi.mock("./actions", () => ({ mutateItemAction: m.mutate, loadItemAction: m.load, updateFormAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
let root: Root;
let host: HTMLDivElement;
const blocks = [
  { id: "b1", type: "link" as const, visible: true, content: { kind: "facebook", url: "https://facebook.com/example", label: "" }, summary: "Facebook" },
  { id: "b2", type: "link" as const, visible: false, content: { kind: "booking", url: "https://booking.example/", label: "" }, summary: "Booking" },
];
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks(); m.mutate.mockResolvedValue({ ok: true });
  m.load.mockImplementation(async (_profile, _scene, id) => ({ ...blocks.find(block => block.id === id), sceneId: "s1", form: null }));
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')!;
const button = (label: string, container: ParentNode = document) => [...container.querySelectorAll<HTMLButtonElement>("button")].find(node => node.getAttribute("aria-label") === label || (node.querySelector(':scope > .inline-grid > span:not([aria-hidden="true"])')?.textContent ?? node.textContent) === label)!;
async function click(label: string, container?: ParentNode) { await act(async () => button(label, container).click()); }
async function render(items = blocks) { await act(async () => root.render(<ModeEditor profileId="p1" sceneId="s1" blocks={items} />)); }
async function input(name: string, value: string) {
  const node = dialog().querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(node, value); node.dispatchEvent(new Event("input", { bubbles: true })); });
}
async function submit() { await act(async () => dialog().querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }

test("normal sections stay compact; Add opens named modal with exact supported grouped horizontal tiles", async () => {
  await render();
  expect(dialog()).toBeNull(); expect(host.textContent).not.toContain("Popular"); expect(host.textContent).not.toContain("Close");
  await click("Add to Socials & links");
  expect(dialog().textContent).toContain("Add a social or link");
  const tiles = [...dialog().querySelectorAll('li button')];
  expect(tiles.map(tile => tile.textContent)).toEqual(["Facebook", "Instagram", "TikTok", "LinkedIn", "YouTube", "Threads", "X (Twitter)", "Discord", "Reddit", "Pinterest", "GitHub", "Behance", "Dribbble", "Messenger", "WhatsApp", "Viber", "Telegram", "Portfolio", "Shop", "Menu", "Custom link"]);
  expect(dialog().textContent).not.toMatch(/Spotify|Twitch|Snapchat/);
  for (const list of dialog().querySelectorAll("ul")) { expect(list.className).toContain("grid-cols-2"); expect(list.className).toContain("sm:grid-cols-3"); }
  for (const tile of tiles) { expect(tile.querySelector("svg")).not.toBeNull(); expect(tile.className).not.toContain("flex-col"); }
});

test("platform selection stays in the same dialog and successful add closes, refreshes and restores focus", async () => {
  await render(); const trigger = button("Add to Socials & links"); await click("Add to Socials & links"); const popup = dialog();
  await click("Facebook", popup);
  expect(dialog()).toBe(popup); expect(popup.querySelector("select")).toBeNull();
  expect(popup.querySelector<HTMLInputElement>('[name="kind"]')!.value).toBe("facebook");
  await input("url", "facebook.com/yourpage"); await submit();
  const data = m.mutate.mock.calls[0][0] as FormData;
  expect(data.get("operation")).toBe("add"); expect(data.get("kind")).toBe("facebook"); expect(data.get("url")).toBe("facebook.com/yourpage");
  await vi.waitFor(() => expect(dialog()).toBeNull()); await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(m.refresh).toHaveBeenCalled(); expect(document.body.textContent).toContain("Link added");
});

test("Custom link keeps optional label; inline errors preserve input and pending prevents duplicates", async () => {
  await render(); await click("Add to Socials & links"); await click("Custom link", dialog());
  expect(dialog().textContent).toContain("LabelOptional");
  const pending = Promise.withResolvers<{ error: string; fields: Record<string, string> }>(); m.mutate.mockReturnValue(pending.promise);
  await input("url", "bad"); await submit(); await submit(); expect(m.mutate).toHaveBeenCalledOnce();
  expect(button("Close dialog").disabled).toBe(true);
  await act(async () => pending.resolve({ error: "Check your link.", fields: { url: "Enter a valid website." } }));
  expect(dialog().textContent).toContain("Enter a valid website."); expect(dialog().querySelector<HTMLInputElement>('[name="url"]')!.value).toBe("bad");
});

test("legacy Booking links edit in place with their kind intact", async () => {
  await render(); await click("Edit Booking", host);
  expect(dialog().textContent).toContain("Edit Booking"); expect(dialog().querySelector<HTMLInputElement>('[name="kind"]')!.value).toBe("booking");
  expect(dialog().querySelector<HTMLInputElement>('[name="url"]')!.value).toBe("https://booking.example/"); await submit();
  expect((m.mutate.mock.calls[0][0] as FormData).get("operation")).toBe("update");
  expect((m.mutate.mock.calls[0][0] as FormData).get("blockId")).toBe("b2");
});

test.each([{ section: "Content", labels: ["About", "Project"] }, { section: "Actions", labels: ["Save contact", "Book a meeting", "Contact form"] }])("$section uses full width choices and transitions to fields", async ({ section, labels }) => {
  await render(); await click(`Add to ${section}`);
  const list = dialog().querySelector("ul")!; expect(list.className).not.toContain("grid");
  expect([...list.querySelectorAll("button")].map(node => node.querySelector("span span")?.textContent)).toEqual(labels);
  await act(async () => list.querySelector<HTMLButtonElement>("button")!.click());
  expect(dialog().querySelector("form")).not.toBeNull();
  if (section === "Actions") expect(dialog().querySelector<HTMLInputElement>('[name="saveContact"]')!.value).toBe("on");
});

test("Reorder exposes up/down with disabled boundaries and sends scoped moves; Done exits", async () => {
  await render(); expect(host.querySelector('[aria-label="Move Facebook up"]')).toBeNull();
  await click("Reorder Socials & links", host);
  expect(button("Move Facebook up", host).disabled).toBe(true); expect(button("Move Booking down", host).disabled).toBe(true);
  expect(host.querySelector('[role="switch"]')).toBeNull(); await click("Move Booking up", host);
  const data = m.mutate.mock.calls[0][0] as FormData; expect(data.get("operation")).toBe("move"); expect(data.get("section")).toBe("links"); expect(data.get("direction")).toBe("up");
  await click("Done", host); expect(host.querySelector('[role="switch"]')).not.toBeNull();
});

test("visibility sends one mutation; normal overflow has Hide/Show and no moves; remove needs confirmation", async () => {
  await render(); await click("Show Facebook to visitors", host);
  expect((m.mutate.mock.calls[0][0] as FormData).get("visible")).toBe("false");
  await click("Options for Facebook", host);
  const menu = document.querySelector('[role="menu"]')!;
  expect(menu.textContent).toContain("Hide"); expect(menu.textContent).not.toContain("Move");
  await act(async () => [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(node => node.textContent === "Remove")!.click());
  expect(dialog().textContent).toContain("Remove Facebook?"); expect(m.mutate).toHaveBeenCalledOnce();
  await click("Remove", dialog()); expect((m.mutate.mock.calls[1][0] as FormData).get("confirm")).toBe("on");
});

test("Escape closes pristine modal; dirty close protects drafts", async () => {
  await render(); await click("Add to Socials & links");
  await act(async () => dialog().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  await vi.waitFor(() => expect(dialog()).toBeNull());
  await click("Add to Socials & links"); await click("Facebook", dialog()); await input("url", "example.com"); await click("Close dialog");
  expect(document.body.textContent).toContain("Discard changes?"); await click("Keep editing");
  expect(dialog().querySelector<HTMLInputElement>('[name="url"]')!.value).toBe("example.com");
});

test("Keep editing restores focus to the active draft field", async () => {
  await render(); await click("Add to Socials & links"); await click("Facebook", dialog());
  const field = dialog().querySelector<HTMLInputElement>('[name="url"]')!;
  await act(async () => field.focus()); await input("url", "example.com"); await click("Close dialog");
  await click("Keep editing"); await vi.waitFor(() => expect(document.activeElement).toBe(field));
});

test("dialog is named and focus trapped, step Back works, and Base UI emits no warnings", async () => {
  const warn = vi.spyOn(console, "warn"); const error = vi.spyOn(console, "error");
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([new DOMRect(0, 0, 100, 44)] as unknown as DOMRectList);
  await render(); await click("Add to Socials & links");
  const popup = dialog(); expect(document.getElementById(popup.getAttribute("aria-labelledby")!)?.textContent).toBe("Add a social or link");
  await act(async () => (popup.nextElementSibling as HTMLElement).focus());
  await vi.waitFor(() => expect(popup.contains(document.activeElement)).toBe(true));
  await click("Facebook", popup); await click("Back to choices", popup);
  expect(dialog().textContent).toContain("Popular");
  expect(warn).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
  warn.mockRestore(); error.mockRestore();
});

test("network failure keeps values, enables retry and shows normal error feedback", async () => {
  m.mutate.mockRejectedValue(new Error("network"));
  await render(); await click("Add to Socials & links"); await click("Facebook", dialog()); await input("url", "facebook.com/yourpage"); await submit();
  expect(dialog().querySelector<HTMLInputElement>('[name="url"]')!.value).toBe("facebook.com/yourpage");
  expect(button("Add link", dialog()).disabled).toBe(false);
  expect(document.body.textContent).toContain("Your changes are still here. Try again.");
});

test("shared contact form edits the existing definition and preserves question IDs", async () => {
  const config = { ...PRESETS.connect.config, questions: [{ id: "abc12345", label: "Your goal", required: false }] };
  m.load.mockResolvedValue({ id: "fblock", type: "form", content: {}, form: { id: "f1", title: "Let's connect", config, useCount: 2 } });
  await act(async () => root.render(<ModeEditor profileId="p1" sceneId="s1" blocks={[{ id: "fblock", type: "form", visible: true, content: {}, summary: "Let's connect" }]} />));
  await click("Edit Let's connect", host);
  expect(dialog().textContent).toContain("Changes apply wherever this contact form is used.");
  expect(dialog().querySelector<HTMLInputElement>('[name="question.0.id"]')!.value).toBe("abc12345");
  await input("title", "Contact me"); await submit();
  const data = m.mutate.mock.calls[0][0] as FormData;
  expect(data.get("operation")).toBe("form"); expect(data.get("formId")).toBe("f1"); expect(data.get("blockId")).toBe("fblock"); expect(data.get("question.0.id")).toBe("abc12345");
});

test.each([{ choice: "Project", section: "Content", field: "title" }, { choice: "Book a meeting", section: "Actions", field: "url" }, { choice: "Contact form", section: "Actions", field: "preset" }])("$choice opens its own form in the dialog", async ({ choice, section, field }) => {
  await render(); await click(`Add to ${section}`);
  const option = [...dialog().querySelectorAll<HTMLButtonElement>("li button")].find(node => node.textContent?.startsWith(choice))!;
  await act(async () => option.click());
  expect(dialog().querySelector(`[name="${field}"]`)).not.toBeNull();
  expect(dialog().querySelector('a[href*="/blocks/"]')).toBeNull();
});

test("reorder keeps its state after refreshed props and focuses an enabled direction on the moved item", async () => {
  const pending = Promise.withResolvers<{ ok: boolean }>(); m.mutate.mockReturnValue(pending.promise);
  await render(); await click("Reorder Socials & links", host); await click("Move Booking up", host);
  expect(button("Move Facebook down", host).disabled).toBe(true);
  expect(button("Done", host).disabled).toBe(true);
  await render([...blocks].reverse());
  await act(async () => pending.resolve({ ok: true }));
  expect(button("Move Booking up", host).disabled).toBe(true);
  expect(button("Move Booking down", host).disabled).toBe(false);
  expect(document.activeElement).toBe(button("Move Booking down", host));
  expect(host.textContent).toContain("Moved Booking up.");
});

test("reorder failures retain rows and expose a retryable status; draft discard returns to choices", async () => {
  m.mutate.mockResolvedValue({ error: "Couldn’t save changes. Try again." });
  await render(); await click("Reorder Socials & links", host); await click("Move Booking up", host);
  expect(host.textContent).toContain("Couldn’t save changes. Try again.");
  expect(button("Move Booking up", host).disabled).toBe(false);
  await click("Done", host); await click("Add to Socials & links"); await click("Facebook", dialog()); await input("url", "example.com"); await click("Back to choices", dialog());
  await click("Discard changes");
  await vi.waitFor(() => expect(dialog().textContent).toContain("Popular"));
  expect(dialog().querySelector("form")).toBeNull();
});

test.each([
  { kind: "threads", label: "Threads" }, { kind: "discord", label: "Discord" },
  { kind: "reddit", label: "Reddit" }, { kind: "pinterest", label: "Pinterest" },
  { kind: "behance", label: "Behance" }, { kind: "dribbble", label: "Dribbble" },
])("$label selects its fixed kind and adds within the dialog", async ({ kind, label }) => {
  await render(); await click("Add to Socials & links"); const popup = dialog();
  await click(label, popup);
  expect(dialog()).toBe(popup);
  expect(popup.querySelector<HTMLInputElement>('[name="kind"]')!.value).toBe(kind);
  expect(popup.textContent).toContain(label + " link");
  expect(popup.textContent).toContain("Display labelOptional");
  await input("url", "example.com/yourname"); await submit();
  const data = m.mutate.mock.calls[0][0] as FormData;
  expect(data.get("kind")).toBe(kind); expect(data.get("operation")).toBe("add");
  await vi.waitFor(() => expect(dialog()).toBeNull());
});

test("new platform edits use the existing modal and preserve kind", async () => {
  const item = { ...blocks[0], content: { kind: "discord", label: "", url: "https://discord.gg/example" }, summary: "Discord" };
  m.load.mockResolvedValue({ ...item, sceneId: "s1", form: null });
  await render([item]); await click("Edit Discord", host);
  expect(dialog().textContent).toContain("Edit Discord");
  expect(dialog().querySelector<HTMLInputElement>('[name="url"]')!.value).toBe(item.content.url);
  await input("url", "discord.gg/new"); await submit();
  const data = m.mutate.mock.calls[0][0] as FormData;
  expect(data.get("operation")).toBe("update"); expect(data.get("kind")).toBe("discord");
});

test("renderItems reuses the Custom link dialog and pre-fills Resume", async () => {
  let controls: ModeEditorControls | undefined;
  await act(async () => root.render(<ModeEditor profileId="p1" sceneId="s1" blocks={blocks} renderItems={({ controls: next }) => { controls = next; return <button type="button" onClick={event => next.choose("link", "custom", "Resume", event.currentTarget)}>Add Resume</button>; }} />));
  await click("Add Resume", host);
  expect(dialog().querySelector<HTMLInputElement>('[name="kind"]')!.value).toBe("custom");
  expect(dialog().querySelector<HTMLInputElement>('[name="label"]')!.value).toBe("Resume");
  expect(controls).toBeDefined();
});

test("renderItems opens the existing chooser for every human section", async () => {
  await act(async () => root.render(<ModeEditor profileId="p1" sceneId="s1" blocks={blocks} renderItems={({ controls }) => <button type="button" onClick={event => controls.openAll(event.currentTarget)}>Add something else</button>} />));
  await click("Add something else", host);
  expect(dialog().textContent).toContain("Socials & links");
  expect(dialog().textContent).toContain("Content");
  expect(dialog().textContent).toContain("Actions");
});

test("renderItems uses injected item actions", async () => {
  const load = vi.fn().mockResolvedValue({ ...blocks[0], sceneId: "s1", form: null });
  const mutate = vi.fn().mockResolvedValue({ ok: true });
  await act(async () => root.render(<ModeEditor profileId="p1" sceneId="s1" blocks={blocks} actions={{ load, mutate }} renderItems={({ controls }) => <button type="button" onClick={event => controls.edit(blocks[0], event.currentTarget)}>Edit injected</button>} />));
  await click("Edit injected", host);
  await vi.waitFor(() => expect(load).toHaveBeenCalledWith("p1", "s1", "b1"));
  expect(m.load).not.toHaveBeenCalled();
});
