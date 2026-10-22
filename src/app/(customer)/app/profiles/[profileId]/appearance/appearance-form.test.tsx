// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ACCENTS } from "@/modules/profiles/appearance-options";
import { coverFixture, profileFixture } from "@/dev/profile-fixture";
import { AppearanceForm } from "./appearance-form";

const m = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("../actions", () => ({ updateAppearanceAction: m.save }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, push: m.push }) }));
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.resetAllMocks();
  m.save.mockResolvedValue({ ok: "Saved." });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function render(accent = "#0C0C0D") {
  const view = structuredClone(profileFixture);
  view.appearance = { layout: "editorial", mode: "dark", accent, cover: coverFixture };
  await act(async () => root.render(<AppearanceForm profileId="p1" view={view} accentColor={accent} />));
}
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find(node => node.textContent === text)!;
const preview = () => host.querySelector('[data-appearance-preview] .pf-profile') as HTMLElement;
async function choose(value: string) { await act(async () => host.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`)!.click()); }
async function submit() { await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }

test("current layout/mode and exactly eight named curated accents are native choices; no cover or identity controls", async () => {
  await render();
  expect([...host.querySelectorAll<HTMLInputElement>('input[name="layout"]')].map(node => node.value)).toEqual(["classic", "editorial", "showcase"]);
  expect(host.querySelector<HTMLInputElement>('input[value="editorial"]')!.checked).toBe(true);
  expect(host.querySelector<HTMLInputElement>('input[value="dark"]')!.checked).toBe(true);
  expect([...host.querySelectorAll<HTMLInputElement>('input[name="accentColor"]')].map(node => [node.getAttribute("aria-label"), node.value])).toEqual(ACCENTS.map(a => [a.name, a.hex]));
  expect(button("Save changes").disabled).toBe(true);
  expect(host.querySelector('input[type="color"], input[type="file"], input[name="imageIsLogo"]')).toBeNull();
  for (const text of ["Recommended", "Goal", "Upload cover", "Remove cover", "Display as"]) expect(host.textContent).not.toContain(text);
});

test("real renderer responds to every layout, mode and accent while preserving cover and source view", async () => {
  await render();
  expect(preview().dataset.layout).toBe("editorial");
  expect(preview().style.colorScheme).toBe("dark");
  for (const layout of ["classic", "showcase", "editorial", "showcase"]) {
    await choose(layout);
    expect(preview().dataset.layout).toBe(layout);
    expect(preview().querySelectorAll('.pf-showcase-cover')).toHaveLength(layout === "showcase" ? 1 : 0);
  }
  await choose("light"); expect(preview().style.colorScheme).toBe("light");
  for (const accent of ACCENTS) {
    await choose(accent.hex);
    expect(preview().style.getPropertyValue("--pf-accent")).toBe(accent.hex);
    const radio = host.querySelector<HTMLInputElement>(`input[value="${accent.hex}"]`)!;
    expect(radio.checked).toBe(true);
    expect(radio.closest("label")!.querySelector("svg")).not.toBeNull();
  }
  expect(profileFixture.appearance.cover).toBeNull();
  expect(m.save).not.toHaveBeenCalled();
});

test("cover controls follow the draft layout; refreshed cover updates the real preview without saving appearance", async () => {
  await render();
  expect(host.textContent).not.toContain("Cover image");
  await choose("showcase");
  expect(host.textContent).toContain("Cover image");
  expect(host.textContent).not.toContain("Cover changes save immediately.");
  await choose("classic");
  expect(host.textContent).not.toContain("Cover image");
  await choose("showcase");
  expect(preview().querySelector('.pf-showcase-cover')).not.toBeNull();
  const view = structuredClone(profileFixture);
  view.appearance = { layout: "editorial", mode: "dark", accent: "#0C0C0D", cover: null };
  await act(async () => root.render(<AppearanceForm profileId="p1" view={view} accentColor="#0C0C0D" />));
  expect(preview().dataset.layout).toBe("showcase");
  expect(preview().querySelector('.pf-showcase-cover')).toBeNull();
  expect(m.save).not.toHaveBeenCalled();
});

test("layout thumbnails use the real renderer, are inert and hidden from accessibility; live preview has no active visitor targets", async () => {
  await render();
  const mini = [...host.querySelectorAll('[data-layout-mini]')];
  expect(mini).toHaveLength(3);
  expect(mini.map(node => node.querySelector('.pf-profile')!.getAttribute('data-layout'))).toEqual(["classic", "editorial", "showcase"]);
  for (const node of mini) { expect(node.hasAttribute('inert')).toBe(true); expect(node.getAttribute('aria-hidden')).toBe('true'); }
  expect(host.querySelector('[data-appearance-preview] [inert]')).not.toBeNull();
  expect(host.querySelectorAll("form")).toHaveLength(1);
});

test("desktop preview has an accessible name without a visible title and a scoped scroll container", async () => {
  await render();
  const aside = host.querySelector('[data-appearance-preview]')!;
  expect(aside.getAttribute('aria-label')).toBe('Live profile preview');
  expect(aside.textContent).not.toContain('Live preview');
  const scroll = aside.querySelector('.neffi-appearance-preview-scroll')!;
  expect(scroll.className).toContain('overflow-y-auto');
  expect(scroll.className).toContain('overflow-x-hidden');
  expect(host.querySelectorAll('.neffi-appearance-preview-scroll')).toHaveLength(1);
});

test("save sends layout, mode and accent only, then clears dirty state and toasts", async () => {
  await render(); await choose("showcase"); await choose("light"); await choose("#1F5FAE");
  expect(button("Save changes").disabled).toBe(false);
  await submit();
  const data = m.save.mock.calls[0][1] as FormData;
  expect(Object.fromEntries(data)).toEqual({ profileId: "p1", layout: "showcase", colorMode: "light", accentColor: "#1F5FAE" });
  expect(button("Save changes").disabled).toBe(true);
  expect(m.refresh).toHaveBeenCalledOnce();
  expect(document.body.textContent).toContain("Appearance updated");
  expect(preview().querySelector('.pf-showcase-cover')).not.toBeNull();
});

test("pending blocks duplicate saves and choices, failures preserve unsaved selection", async () => {
  const pending = Promise.withResolvers<{error: string}>(); m.save.mockReturnValue(pending.promise);
  await render(); await choose("classic"); await submit(); await submit();
  expect(m.save).toHaveBeenCalledOnce();
  expect(button("Saving\u2026").disabled).toBe(true);
  expect(host.querySelector<HTMLInputElement>('input[value="showcase"]')!.closest("fieldset")!.disabled).toBe(true);
  await act(async () => pending.resolve({ error: "Try again." }));
  expect(host.querySelector('[role="alert"]')!.textContent).toBe("Try again.");
  expect(preview().dataset.layout).toBe("classic");
  expect(button("Save changes").disabled).toBe(false);
});

test("network failure keeps draft; reverting selections restores pristine state", async () => {
  m.save.mockRejectedValue(new Error("offline"));
  await render(); await choose("classic"); await submit();
  expect(button("Save changes").disabled).toBe(false);
  await choose("editorial"); expect(button("Save changes").disabled).toBe(true);
});

test("legacy accent has no selected swatch until replaced", async () => {
  await render("#123456");
  expect(host.querySelectorAll('input[name="accentColor"]:checked')).toHaveLength(0);
  expect(preview().style.getPropertyValue('--pf-accent')).toBe(ACCENTS[0].dark);
  await choose("classic"); await submit();
  expect(m.save).not.toHaveBeenCalled();
  expect(button("Save changes").disabled).toBe(true);
  await choose("#0C0C0D"); expect(button("Save changes").disabled).toBe(false);
});

test("radio choices have full-size labels, visible focus and checkmarks, and mobile preview is a named dialog", async () => {
  await render();
  for (const radio of host.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
    expect(radio.closest("label")!.className).toContain("min-h-11");
    expect(radio.closest("label")!.className).toContain("focus-within:outline-2");
  }
  const radio = host.querySelector<HTMLInputElement>('input[value="editorial"]')!;
  await act(async () => radio.focus()); expect(document.activeElement).toBe(radio);
  await act(async () => button("Preview changes").click());
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain("Profile preview");
  expect(dialog.querySelector('.pf-profile')!.getAttribute('data-layout')).toBe("editorial");
  expect(dialog.querySelector('button[aria-label="Close preview"]')).not.toBeNull();
});
