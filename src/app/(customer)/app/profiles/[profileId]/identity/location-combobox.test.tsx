import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { LocationCombobox, LocationFeedback, LocationResult } from "./location-combobox";

test("combobox preserves an existing selected location and exposes a labeled clear action", () => {
  const html = renderToStaticMarkup(<LocationCombobox value="Quezon City, Metro Manila" onChange={vi.fn()} disabled={false} />);
  expect(html).toContain('Quezon City, Metro Manila');
  expect(html).toContain('aria-haspopup="dialog"');
  expect(html).not.toContain('<input');
  expect(html).toContain("Clear location");
  expect(html).toContain("City / municipality");
  expect(html).not.toContain("Shown as a general location");
  const labelId = html.match(/<label\b[^>]*for="([^"]+)"/)?.[1];
  expect(labelId).toBeTruthy();
  expect(html).toContain(`id="${labelId}"`);
  expect(html).toMatch(new RegExp(`<button\\b[^>]*id="${labelId}"`));
});

test("empty field has no clear control; populated field has a non-submit clear control", () => {
  const empty = renderToStaticMarkup(<LocationCombobox value="" onChange={vi.fn()} disabled={false} />);
  expect(empty).not.toContain('aria-label="Clear location"');
  const selected = renderToStaticMarkup(<LocationCombobox value="San Fernando City, Pampanga" onChange={vi.fn()} disabled={false} />);
  expect(selected).toMatch(/<button\b[^>]*type="button"[^>]*aria-label="Clear location"/);
  expect(selected).not.toContain("Use “");
});

test("result shows locality and province separately with a check only for selection", () => {
  const location = { psgcCode: "0330100000", name: "Angeles City", province: "Pampanga", region: "Central Luzon", displayName: "Angeles City, Pampanga" };
  const selected = renderToStaticMarkup(<LocationResult location={location} selected />);
  expect(selected).toContain("Angeles City");
  expect(selected).toContain("Pampanga");
  expect(selected).toContain("lucide-check");
  expect(renderToStaticMarkup(<LocationResult location={location} selected={false} />)).not.toContain("lucide-check");
});

test("native label and field error describe the dialog trigger with unique IDs", () => {
  const html = renderToStaticMarkup(<><LocationCombobox value="" onChange={vi.fn()} disabled={false} error="Check your selection." /><LocationCombobox value="" onChange={vi.fn()} disabled={false} /></>);
  const ids = [...html.matchAll(/<label\b[^>]*for="([^"]+)"/g)].map(match => match[1]);
  expect(new Set(ids).size).toBe(2);
  expect(html).toContain(`aria-describedby="${ids[0]}-error"`);
  expect(html).toContain(`id="${ids[0]}-error"`);
  expect(html).not.toContain("location-help");
});

test.each([
  ["loading", "Loading locations…"],
  ["ready", "No locations found"],
  ["error", "Locations are unavailable right now."],
] as const)("%s state has accessible status content", (status, message) => {
  const html = renderToStaticMarkup(<LocationFeedback status={status} empty />);
  expect(html).toContain(message);
  expect(html).toContain('role="status"');
  expect(html).not.toContain("Try again");
  if (status !== "ready") expect(html).not.toContain("No locations found.");
  if (status === "ready") {
    expect(html).toContain("Try a different city or municipality.");
    expect(html).toContain("lucide-search");
  }
});

test("successful populated searches do not show an empty message", () => {
  expect(renderToStaticMarkup(<LocationFeedback status="ready" empty={false} />)).toBe("");
});
