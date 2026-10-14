import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
const { requireOwner, dashboard, search } = vi.hoisted(() => ({ requireOwner: vi.fn(), dashboard: vi.fn(), search: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireOwner })); vi.mock("@/auth/actions", () => ({ signOutAction: vi.fn() })); vi.mock("@/db", () => ({ db: {} })); vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/modules/orders/dashboard", () => ({ dashboard })); vi.mock("@/modules/search", () => ({ search }));
import AdminHome from "./page";
import SearchPage from "./search/page";
import { AdminNav } from "./admin-nav";
test("dashboard and search deny nonowners before querying", async () => {
  requireOwner.mockRejectedValue(new Error("Denied"));
  await expect(AdminHome()).rejects.toThrow("Denied");
  await expect(SearchPage({ searchParams: Promise.resolve({ q: "x" }), params: Promise.resolve({}) })).rejects.toThrow("Denied");
  expect(dashboard).not.toHaveBeenCalled(); expect(search).not.toHaveBeenCalled();
});
test("server nav has exactly approved sections and markers highlight nested pages", () => {
  const html = renderToStaticMarkup(<AdminNav />);
  for (const section of ["dashboard", "orders", "inventory", "customers", "expenses", "support", "settings"]) expect(html).toContain(`data-admin-section=${section}`);
  expect(html.match(/<a /g)).toHaveLength(7);
  expect(readFileSync("src/app/admin/orders/[orderId]/page.tsx", "utf8")).toContain('data-admin-section="orders"');
  expect(readFileSync("src/app/admin/inventory/cards/[cardId]/page.tsx", "utf8")).toContain('data-admin-section="inventory"');
});

test("dashboard shows open cases and an opening action", async () => {
  requireOwner.mockResolvedValue({ email: "owner@example.test" });
  dashboard.mockResolvedValue({ inProgress: 0, outstanding: 0, collected: 0, expenses: 0, openSupportCases: 3, stock: { rows: [], inProvisioning: 0 }, recent: [] });
  const html = renderToStaticMarkup(await AdminHome());
  expect(html).toContain("Open support cases");
  expect(html).toContain("Open Support Case");
  expect(html).toContain('href="/admin/support/new"');
});
