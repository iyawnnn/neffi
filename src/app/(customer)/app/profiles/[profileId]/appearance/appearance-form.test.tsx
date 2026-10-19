// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ACCENTS } from "@/modules/profiles/appearance-options";
import { AppearanceForm } from "../image-upload";

const m = vi.hoisted(() => ({ save: vi.fn(), start: vi.fn(), confirm: vi.fn(), remove: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("../actions", () => ({ updateAppearanceAction: m.save, startImageUploadAction: m.start, confirmImageAction: m.confirm, removeImageAction: m.remove }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, push: m.push }) }));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.resetAllMocks();
  m.save.mockResolvedValue({ ok: "Saved." });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function render(image = false, fullName?: string) { await act(async () => root.render(<AppearanceForm profileId="p1" fullName={fullName} accentColor={null} imageIsLogo={false} photoUrl={image ? "https://example.com/photo" : null} logoUrl={image ? "https://example.com/logo" : null} />)); }
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find(node => node.textContent === text)!;
async function choose(value: string) { await act(async () => host.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`)!.click()); }
async function submit() { await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
async function file(file: File) {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}

test("profile image is first, empty state is useful, and save is neutral and disabled", async () => {
  await render();
  expect([...host.querySelectorAll("h2")].map(node => node.textContent)).toEqual(["Profile image", "Display as", "Accent color"]);
  expect(host.textContent).toContain("Add a profile image");
  expect(host.textContent).toContain("JPG, PNG, WebP or HEIC · Max 5 MB");
  expect(host.textContent).not.toContain("All changes saved");
  expect(host.textContent).toContain("Available after you upload an image.");
  expect(host.querySelector<HTMLInputElement>('input[type="radio"][value="true"]')!.closest("fieldset")!.disabled).toBe(true);
  expect(host.querySelector("header")!.querySelector('button[type="submit"]')).toBeNull();
  expect(host.querySelector("footer")!.contains(button("Save changes"))).toBe(true);
  expect(button("Save changes").disabled).toBe(true);
  expect(button("Save changes").className).not.toContain("bg-action");
  expect(host.querySelectorAll('input[name="accentColor"]')).toHaveLength(8);
});

test("mode and swatch changes preview immediately and successful save resets dirty state", async () => {
  await render(true); await choose("true"); await choose("#1F5FAE");
  expect(host.querySelector("img")!.src).toBe("https://example.com/logo");
  expect(host.textContent).not.toContain("Unsaved changes");
  expect(button("Save changes").disabled).toBe(false);
  expect(button("Save changes").className).toContain("bg-action");
  await submit();
  const data = m.save.mock.calls[0][1] as FormData;
  expect(data.get("imageIsLogo")).toBe("true"); expect(data.get("accentColor")).toBe("#1F5FAE");
  expect(host.textContent).not.toContain("All changes saved"); expect(button("Save changes").disabled).toBe(true);
  expect(document.body.textContent).toContain("Appearance updated");
});

test("changing back to the saved value is pristine and Cancel returns to the profile", async () => {
  await render(); await choose("#1F5FAE"); await choose("#0C0C0D");
  expect(button("Save changes").disabled).toBe(true);
  await choose("#1F5FAE"); await act(async () => button("Cancel").click());
  expect(m.push).toHaveBeenCalledWith("/app/profiles/p1");
});

test("pending prevents duplicate save; server failure preserves the selection", async () => {
  const pending = Promise.withResolvers<{ error: string }>(); m.save.mockReturnValue(pending.promise);
  await render(); await choose("#1F5FAE"); await submit(); await submit();
  expect(m.save).toHaveBeenCalledOnce(); expect(button("Saving…").disabled).toBe(true);
  expect(button("Cancel").disabled).toBe(true);
  await act(async () => pending.resolve({ error: "Try again." }));
  expect(host.querySelector('[role="alert"]')!.textContent).toContain("Try again.");
  expect(document.body.textContent).toContain("Couldn’t save changes");
  expect(document.body.textContent).toContain("Your changes are still here. Try again.");
  expect(host.querySelector<HTMLInputElement>('input[value="#1F5FAE"]')!.checked).toBe(true);
  expect(button("Save changes").disabled).toBe(false);
});

test("network save failure preserves input and stops loading", async () => {
  m.save.mockRejectedValue(new Error("offline"));
  await render(); await choose("#1F5FAE"); await submit();
  expect(document.body.textContent).toContain("Couldn’t save changes");
  expect(document.body.textContent).toContain("Your changes are still here. Try again.");
  expect(button("Save changes").disabled).toBe(false);
});

test("oversized and unsupported images fail inline before requesting a ticket", async () => {
  await render();
  await file(new File([new Uint8Array(5_000_001)], "large.jpg", { type: "image/jpeg" }));
  expect(m.start).not.toHaveBeenCalled(); expect(host.querySelector('[role="alert"]')).not.toBeNull();
  await file(new File(["x"], "file.svg", { type: "image/svg+xml" }));
  expect(m.start).not.toHaveBeenCalled();
});

test("successful upload uses signed flow; removal failure is recoverable", async () => {
  await render(true);
  m.start.mockResolvedValue({ ticket: { url: "https://upload.example", fields: { signature: "test" } } });
  m.confirm.mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ public_id: "asset" }) }));
  await file(new File(["image"], "photo.heic", { type: "image/heic" }));
  expect(m.confirm).toHaveBeenCalledWith("p1", "asset"); expect(m.refresh).toHaveBeenCalled();
  m.remove.mockRejectedValue(new Error("offline"));
  await act(async () => button("Remove").click());
  expect(host.textContent).toContain("Couldn’t remove");
  expect(button("Remove").disabled).toBe(false);
});

test("dropzone supports dropping a supported file", async () => {
  await render(); m.start.mockResolvedValue({ error: "Upload limit reached." });
  const dropzone = host.querySelector('[data-dropzone]')!;
  const event = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { files: [new File(["x"], "photo.png", { type: "image/png" })] } });
  await act(async () => dropzone.dispatchEvent(event));
  expect(m.start).toHaveBeenCalledWith("p1");
  expect(host.textContent).toContain("Upload limit reached.");
});

test("supported image MIME type works without a filename extension", async () => {
  await render(); m.start.mockResolvedValue({ error: "Upload limit reached." });
  await file(new File(["image"], "camera-photo", { type: "image/jpeg" }));
  expect(m.start).toHaveBeenCalledWith("p1");
});

test("only one actual image is shown and all decorative preview UI is absent", async () => {
  await render(true, "Alex Reyes");
  expect(host.textContent).toContain("Alex Reyes");
  expect(host.querySelectorAll("img")).toHaveLength(1);
  expect(host.querySelector('[data-appearance-preview]')).toBeNull();
  expect(host.querySelector("aside")).toBeNull();
  for (const copy of ["Appearance preview", "Profile link", "Connect", "Image uploads and removal save immediately."]) expect(host.textContent).not.toContain(copy);
  await choose("#E64A35");
  expect(host.querySelectorAll("img")).toHaveLength(1);
  expect(m.save).not.toHaveBeenCalled();
  expect(host.querySelector('a[href="/app/profiles/p1/preview"]')).not.toBeNull();
});

test("empty shared data has a neutral fallback and no fake photo or customer information", async () => {
  await render();
  expect(host.textContent).toContain("Add a profile image");
  expect(host.querySelector("img")).toBeNull();
  expect(host.textContent).not.toContain("Alex Reyes");
  expect(host.textContent).not.toContain("Product Designer");
  expect(button("Choose image")).toBeDefined();
});

test("existing image has compact controls and both presentation options update the same asset", async () => {
  await render(true);
  expect(host.querySelector('[data-dropzone]')).toBeNull();
  expect(button("Change image")).toBeDefined(); expect(button("Remove")).toBeDefined();
  await choose("true");
  for (const image of host.querySelectorAll("img")) expect(image.src).toBe("https://example.com/logo");
  await choose("false");
  for (const image of host.querySelectorAll("img")) expect(image.src).toBe("https://example.com/photo");
  expect(button("Save changes").disabled).toBe(true);
});

test("accent radios have names, selected state and responsive compact swatch layout", async () => {
  await render();
  const radios = [...host.querySelectorAll<HTMLInputElement>('input[name="accentColor"]')];
  expect(radios.map(node => node.getAttribute("aria-label"))).toEqual(["Ink", "Ocean", "Teal", "Forest", "Amber", "Vermilion", "Rose", "Plum"]);
  expect(radios[0].checked).toBe(true);
  const grid = radios[0].closest("label")!.parentElement!;
  expect(grid.className).toContain("grid-cols-4");
  expect(grid.className).toContain("lg:grid-cols-8");
  for (const radio of radios) expect(radio.closest("label")!.className).toContain("min-h-11");
  await choose("#B83A6B");
  expect(radios[6].checked).toBe(true); expect(radios[0].checked).toBe(false);
  expect(radios[6].closest("label")!.querySelector("svg")).not.toBeNull();
});

test("upload pending blocks duplicates and appearance actions without discarding selections", async () => {
  await render(); await choose("#1F5FAE");
  const pending = Promise.withResolvers<{ error: string }>(); m.start.mockReturnValue(pending.promise);
  await file(new File(["image"], "photo.jpg", { type: "image/jpeg" }));
  await file(new File(["other"], "other.jpg", { type: "image/jpeg" }));
  expect(m.start).toHaveBeenCalledOnce();
  expect(host.textContent).toContain("Uploading…");
  expect(button("Save changes").matches(":disabled")).toBe(true);
  await act(async () => pending.resolve({ error: "Upload failed. Try again." }));
  expect(host.textContent).toContain("Upload failed. Try again.");
  expect(host.querySelector<HTMLInputElement>('input[value="#1F5FAE"]')!.checked).toBe(true);
  expect(button("Save changes").matches(":disabled")).toBe(false);
});

test("image refresh preserves unsaved selections and no image preserves the stored display preference", async () => {
  await render(true); await choose("true"); await choose("#1F5FAE");
  await render(false); await submit();
  const data = m.save.mock.calls[0][1] as FormData;
  expect(data.get("imageIsLogo")).toBe("true");
  expect(data.get("accentColor")).toBe("#1F5FAE");
});

test("native choices retain keyboard focus and no console accessibility warnings occur", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const warnings = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  await render(true);
  const radio = host.querySelector<HTMLInputElement>('input[aria-label="Logo"]')!;
  await act(async () => radio.focus());
  expect(document.activeElement).toBe(radio);
  expect(radio.closest("label")!.className).toContain("focus-within:outline-2");
  await choose("true"); await submit();
  expect(errors).not.toHaveBeenCalled(); expect(warnings).not.toHaveBeenCalled();
});

test.each(ACCENTS)("$name selection uses its own color for border, tint and check", async ({ name, hex }) => {
  await render(); await choose(hex);
  const radio = host.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`)!;
  const label = radio.closest("label")!;
  expect(radio.checked).toBe(true);
  expect(label.style.borderColor).toBe(hex);
  expect(label.style.backgroundColor.toLowerCase()).toBe(`${hex}0A`.toLowerCase());
  expect(label.querySelector("svg")!.parentElement!.style.color).toBe(hex);
  expect(label.className).not.toContain("border-brand");
  expect(label.className).not.toContain("bg-brand");
});

test("Appearance footer stays in document flow when pristine, dirty and saving", async () => {
  const pending = Promise.withResolvers<{ ok: string }>(); m.save.mockReturnValue(pending.promise);
  await render();
  const assertFlow = () => expect(host.querySelector("footer")!.className).not.toMatch(/(?:^|\s)(sticky|fixed|bottom-\S+)/);
  assertFlow(); await choose("#1F5FAE"); assertFlow(); await submit(); assertFlow();
  expect(button("Saving…").disabled).toBe(true);
  await act(async () => pending.resolve({ ok: "Saved." })); assertFlow();
});

test("successful removal refreshes the single image and preserves unsaved accent", async () => {
  await render(true); await choose("#1F5FAE");
  m.remove.mockResolvedValue(undefined);
  await act(async () => button("Remove").click());
  expect(m.remove).toHaveBeenCalledWith("p1"); expect(m.refresh).toHaveBeenCalled();
  expect(host.textContent).toContain("Image removed.");
  await render(false);
  expect(host.querySelector("img")).toBeNull();
  expect(host.querySelector<HTMLInputElement>('input[value="#1F5FAE"]')!.checked).toBe(true);
  expect(host.textContent).not.toContain("Unsaved changes");
  expect(button("Save changes").disabled).toBe(false);
});

test("image content is centered at every breakpoint and Remove is an equal-height outlined button", async () => {
  await render(true, "Ian Macabulos");
  const image = host.querySelector("img")!;
  const composition = image.parentElement!;
  expect(composition.className).toContain("flex-col");
  expect(composition.className).toContain("items-center");
  expect(composition.className).toContain("text-center");
  expect(composition.className).not.toContain("sm:flex-row");
  expect(composition.textContent).toContain("Ian Macabulos");
  const change = button("Change image"); const remove = button("Remove");
  expect(remove.tagName).toBe("BUTTON");
  expect(remove.type).toBe("button");
  expect(remove.className).toContain("border-destructive/40");
  expect(remove.querySelector("svg")).not.toBeNull();
  expect(remove.className).toContain("h-11"); expect(change.className).toContain("h-11");
  expect(change.parentElement).toBe(remove.parentElement);
  expect(change.parentElement!.className).toContain("min-[360px]:grid-cols-2");
});

test("Appearance footer contains only actions when pristine, dirty, saving and saved", async () => {
  const pending = Promise.withResolvers<{ ok: string }>(); m.save.mockReturnValue(pending.promise);
  await render(); const footer = host.querySelector("footer")!;
  expect(footer.textContent).toBe("CancelSave changes");
  expect(button("Save changes").disabled).toBe(true);
  await choose("#1F5FAE");
  expect(footer.textContent).toBe("CancelSave changes");
  expect(button("Save changes").className).toContain("bg-action");
  await submit();
  expect(footer.textContent).toBe("CancelSaving…");
  expect(button("Saving…").querySelector("svg")).not.toBeNull();
  expect(button("Cancel").disabled).toBe(true);
  await act(async () => pending.resolve({ ok: "Saved." }));
  expect(footer.textContent).toBe("CancelSave changes");
  expect(button("Save changes").disabled).toBe(true);
  expect(footer.querySelector('[role="status"]')).toBeNull();
  expect(footer.className).not.toMatch(/(?:^|\s)(sticky|fixed)(?:\s|$)/);
});

test("Preview profile reuses the saved-profile route as a responsive secondary header action", async () => {
  await render(true);
  const header = host.querySelector("header")!;
  const link = header.querySelector<HTMLAnchorElement>('a[href="/app/profiles/p1/preview"]')!;
  expect(link.textContent).toBe("Preview profile");
  expect(link.target).toBe("");
  expect(link.querySelector("svg")).not.toBeNull();
  expect(link.className).toContain("min-h-11");
  expect(link.className).toContain("w-full");
  expect(link.className).toContain("sm:w-auto");
  expect(link.className).not.toContain("bg-action");
  expect(link.parentElement!.className).toContain("flex-col");
  expect(link.parentElement!.className).toContain("sm:flex-row");
  expect(link.parentElement!.querySelector("h1")!.textContent).toBe("Appearance");
  await choose("#1F5FAE");
  expect(link.getAttribute("href")).toBe("/app/profiles/p1/preview");
  expect(m.save).not.toHaveBeenCalled();
  expect(host.querySelectorAll("img")).toHaveLength(1);
});
