import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useActionState: () => [undefined, vi.fn(), false],
}));
vi.mock("./actions", () => ({
  receiveStockAction: vi.fn(), provisionDbcAction: vi.fn(), recordNfcCheckAction: vi.fn(),
  matchPackageAction: vi.fn(), replaceCredentialAction: vi.fn(), reserveGrcAction: vi.fn(), retireCardAction: vi.fn(),
}));
import { StockForm } from "./forms";

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

test("OWNER can enter optional receiving notes within the action's 500-character limit", () => {
  const html = renderToStaticMarkup(<StockForm />);
  expect(html).toContain("Notes (optional)");
  expect(html).toMatch(/<textarea[^>]*name="notes"[^>]*maxLength="500"/);
});

test("received date defaults on browser mount to the local day across UTC midnight", () => {
  vi.stubEnv("TZ", "Asia/Manila");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T17:00:00Z"));
  const form = StockForm();
  const labels = (form.props as { children: ReactElement[] }).children;
  const dateInput = (labels[0].props as { children: ReactElement[] }).children.find((child) => child?.type === "input")!;
  const { ref, defaultValue } = dateInput.props as { ref: (input: HTMLInputElement | null) => void; defaultValue?: string };
  expect(defaultValue).toBeUndefined(); // No server-timezone value to hydrate over.
  const input = { defaultValue: "" } as HTMLInputElement;
  ref(input);
  expect(new Date().toISOString().slice(0, 10)).toBe("2026-10-11");
  expect(input.defaultValue).toBe("2026-10-12");
  ref(null);
});
