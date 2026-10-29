// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ImageUpload } from "./image-upload";

const m = vi.hoisted(() => ({ save: vi.fn(), start: vi.fn(), confirm: vi.fn(), remove: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("./actions", () => ({ updateAppearanceAction: m.save, startImageUploadAction: m.start, confirmImageAction: m.confirm, removeImageAction: m.remove }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, push: m.push }) }));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.resetAllMocks();
  m.save.mockResolvedValue({ ok: "Saved." });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function render(image = false, fullName?: string) { await act(async () => root.render(<ImageUpload profileId="p1" fullName={fullName} hasImage={image} image={image ? "https://example.com/photo" : null} logo={false} />)); }
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find(node => (node.querySelector(":scope > .inline-grid > span:not([aria-hidden='true'])")?.textContent ?? node.textContent) === text)!;
async function file(file: File) {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}

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
