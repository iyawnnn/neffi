// @vitest-environment happy-dom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { LocationCombobox } from "./location-combobox";

const locations = [
  { psgcCode: "0305401000", name: "Apalit", province: "Pampanga", region: "Central Luzon", displayName: "Apalit, Pampanga" },
  { psgcCode: "0330100000", name: "Angeles City", province: "Pampanga", region: "Central Luzon", displayName: "Angeles City, Pampanga" },
  { psgcCode: "0305416000", name: "San Fernando City", province: "Pampanga", region: "Central Luzon", displayName: "San Fernando City, Pampanga" },
  { psgcCode: "0103314000", name: "San Fernando City", province: "La Union", region: "Ilocos", displayName: "San Fernando City, La Union" },
];
let root: Root;
let host: HTMLDivElement;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(locations)));
  vi.stubGlobal("fetch", fetcher);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function render(value = "", disabled = false) {
  function Form() {
    const [location, setLocation] = useState(value);
    return <LocationCombobox value={location} onChange={setLocation} disabled={disabled} />;
  }
  await act(async () => root.render(<Form />));
  return host.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
}

const search = () => document.querySelector<HTMLInputElement>('input[aria-label="Search city or municipality"]')!;
const rows = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')];
async function click(element: HTMLElement) {
  await act(async () => element.click());
}
async function type(query: string) {
  const input = search();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, query);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function key(key: string, shiftKey = false) {
  await act(async () => search().dispatchEvent(new KeyboardEvent("keydown", { key, code: key, shiftKey, bubbles: true, cancelable: true })));
}

test("opens a named modal with autofocus, initial alphabetical results and no Base UI warnings", async () => {
  const warn = vi.spyOn(console, "warn");
  const error = vi.spyOn(console, "error");
  const trigger = await render();
  expect(host.querySelector("input")).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
  await click(trigger);
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent).toBe("Select city / municipality");
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  await vi.waitFor(() => expect(document.activeElement).toBe(search()));
  expect(search().value).toBe("");
  expect(rows().map(row => row.textContent)).toEqual(["Angeles CityPampanga", "ApalitPampanga", "San Fernando CityLa Union", "San Fernando CityPampanga"]);
  expect(document.querySelector('[aria-label="Clear search"]')).toBeNull();
  expect(warn).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});

test("Arrow Down/Up navigate results and Enter selects, closes and restores trigger focus", async () => {
  const trigger = await render();
  await click(trigger);
  await key("ArrowDown");
  expect(search().getAttribute("aria-activedescendant")).toBe(rows()[0].id);
  await key("ArrowDown");
  expect(search().getAttribute("aria-activedescendant")).toBe(rows()[1].id);
  await key("ArrowUp");
  expect(search().getAttribute("aria-activedescendant")).toBe(rows()[0].id);
  await key("Enter");
  expect(trigger.textContent).toContain("Angeles City, Pampanga");
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
});

test("searches locally, preserves province search, and allows clearing the query without clearing selection", async () => {
  const trigger = await render("San Fernando City, Pampanga");
  await click(trigger);
  const selected = rows().find(row => row.getAttribute("aria-selected") === "true")!;
  expect(selected.textContent).toBe("San Fernando CityPampanga");
  expect(selected.querySelector(".lucide-check")).not.toBeNull();
  await type("pampanga");
  expect(rows()).toHaveLength(3);
  await type("san fernando");
  expect(rows()).toHaveLength(2);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await click(document.querySelector('[aria-label="Clear search"]')!);
  expect(search().value).toBe("");
  expect(rows()).toHaveLength(4);
  expect(trigger.textContent).toContain("San Fernando City, Pampanga");
  expect(document.activeElement).toBe(search());
});

test("no-match searches have a neutral empty state and cannot create a locality", async () => {
  const trigger = await render();
  await click(trigger);
  await type("not-a-real-place");
  expect(rows()).toHaveLength(0);
  expect(document.querySelector('[role="status"]')?.textContent).toBe("No locations foundTry a different city or municipality.");
  expect(document.querySelector('[role="status"] .lucide-search')).not.toBeNull();
  await key("Enter");
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(trigger.textContent).toContain("Search city or municipality...");
  await key("Escape");
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
});

test("pointer selection closes; clearing the optional value does not reopen or reload the dialog", async () => {
  const trigger = await render();
  await click(trigger);
  await click(rows().find(row => row.textContent === "San Fernando CityPampanga")!);
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  expect(trigger.textContent).toContain("San Fernando City, Pampanga");
  await click(host.querySelector('[aria-label="Clear location"]')!);
  expect(trigger.textContent).toContain("Search city or municipality...");
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(host.querySelector('[aria-label="Clear location"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  await click(trigger);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("disabled field cannot open or clear", async () => {
  const trigger = await render("Angeles City, Pampanga", true);
  expect(trigger.disabled).toBe(true);
  const clear = host.querySelector<HTMLButtonElement>('[aria-label="Clear location"]')!;
  expect(clear.disabled).toBe(true);
  await click(trigger);
  await click(clear);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(trigger.textContent).toContain("Angeles City, Pampanga");
  expect(fetcher).not.toHaveBeenCalled();
});

test("Tab and Shift+Tab boundaries keep focus inside the dialog, and Close restores the trigger", async () => {
  // happy-dom has no layout; give tabbability checks visible control bounds.
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([new DOMRect(0, 0, 100, 44)] as unknown as DOMRectList);
  const trigger = await render();
  await click(trigger);
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
  const before = dialog.previousElementSibling as HTMLElement;
  const after = dialog.nextElementSibling as HTMLElement;
  const close = dialog.querySelector<HTMLButtonElement>('[aria-label="Close location selector"]')!;
  // Native Tab traversal lands on Base UI's guards at either boundary.
  await key("Tab");
  await act(async () => after.focus());
  await vi.waitFor(() => expect(document.activeElement).toBe(close));
  await key("Tab", true);
  await act(async () => before.focus());
  await vi.waitFor(() => expect(document.activeElement).toBe(search()));
  await click(close);
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
});

test("reopening clears only the query and selecting the existing locality closes normally", async () => {
  const trigger = await render("San Fernando City, Pampanga");
  await click(trigger);
  await type("la union");
  await key("Escape");
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  await click(trigger);
  expect(search().value).toBe("");
  expect(rows()).toHaveLength(4);
  await click(rows().find(row => row.getAttribute("aria-selected") === "true")!);
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  expect(trigger.textContent).toContain("San Fernando City, Pampanga");
});

test("dialog follows the visible viewport when the mobile keyboard resizes it", async () => {
  const viewport = Object.assign(new EventTarget(), { offsetTop: 0, height: 700 });
  vi.stubGlobal("visualViewport", viewport);
  await click(await render());
  const frame = document.querySelector('[role="dialog"]')!.parentElement!;
  expect(frame.style.height).toBe("700px");
  await vi.waitFor(() => expect(document.activeElement).toBe(search()));
  await act(async () => {
    viewport.offsetTop = 24;
    viewport.height = 320;
    viewport.dispatchEvent(new Event("resize"));
  });
  expect(frame.style.top).toBe("24px");
  expect(frame.style.height).toBe("320px");
  expect(document.activeElement).toBe(search());
});
