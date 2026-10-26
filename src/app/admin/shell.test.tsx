import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
const { requireOwner, dashboard, searchPage, pathname, expenseReport, listOrders, listCases, monthTrends } = vi.hoisted(() => ({ requireOwner: vi.fn(), dashboard: vi.fn(), searchPage: vi.fn(), pathname: vi.fn(), expenseReport: vi.fn(), listOrders: vi.fn(), listCases: vi.fn(), monthTrends: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireOwner })); vi.mock("@/auth/actions", () => ({ signOutAction: vi.fn() })); vi.mock("@/db", () => ({ db: {} })); vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: pathname, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/modules/orders/dashboard", () => ({ dashboard })); vi.mock("@/modules/search", () => ({ searchPage })); vi.mock("@/modules/orders/trends", () => ({ monthTrends }));
vi.mock("@/modules/expenses/report", () => ({ expenseReport })); vi.mock("@/modules/orders/queries", () => ({ listOrders })); vi.mock("@/modules/support/queries", () => ({ listCases }));
import AdminHome from "./page";
import SearchPage from "./search/page";
import { AdminNav } from "./admin-nav";
import { activeSection } from "./nav-sections";

test("dashboard and search deny nonowners before querying", async () => {
  requireOwner.mockRejectedValue(new Error("Denied"));
  await expect(AdminHome()).rejects.toThrow("Denied");
  await expect(SearchPage({ searchParams: Promise.resolve({ q: "x" }), params: Promise.resolve({}) })).rejects.toThrow("Denied");
  expect(dashboard).not.toHaveBeenCalled(); expect(searchPage).not.toHaveBeenCalled();
});

test("every route activates exactly one parent section", () => {
  const cases: [string, string | null][] = [
    ["/admin", "dashboard"],
    ["/admin/orders", "orders"], ["/admin/orders/new", "orders"], ["/admin/orders/0b1c", "orders"],
    ["/admin/inventory", "inventory"], ["/admin/inventory/cards/abc", "inventory"], ["/admin/inventory/stock/abc", "inventory"],
    ["/admin/customers", "customers"], ["/admin/customers/purchasers/abc", "customers"], ["/admin/customers/accounts/abc", "customers"],
    ["/admin/expenses", "expenses"],
    ["/admin/support", "support"], ["/admin/support/new", "support"], ["/admin/support/abc", "support"],
    ["/admin/settings", "settings"],
    ["/admin/search", null], ["/admin/orderly", null], ["/", null],
  ];
  for (const [path, section] of cases) expect(activeSection(path), path).toBe(section);
  expect(activeSection(null)).toBeNull();
  expect(activeSection("/admin/orders/")).toBe("orders");
});

test("nav marks only the current section, from the URL rather than from page markup", () => {
  for (const [path, label] of [["/admin/expenses", "Expenses"], ["/admin/support/abc", "Support"], ["/admin/settings", "Settings"], ["/admin", "Dashboard"]] as const) {
    pathname.mockReturnValue(path);
    const html = renderToStaticMarkup(<AdminNav />);
    expect(html.match(/<a /g)).toHaveLength(7);
    expect(html.match(/<svg/g)?.length).toBe(7);
    expect(html.match(/aria-current="page"/g), path).toHaveLength(1);
    expect(html).toMatch(new RegExp(`aria-current="page"[^>]*>(?:<svg.*?</svg>)?${label}<`));
  }
  pathname.mockReturnValue("/admin/search");
  expect(renderToStaticMarkup(<AdminNav />)).not.toContain("aria-current");
});

test("nav is grouped under quiet headings in a stable order", () => {
  pathname.mockReturnValue("/admin");
  const html = renderToStaticMarkup(<AdminNav />);
  const order = ["Overview", "Dashboard", "Operations", "Orders", "Inventory", "Customers", "Expenses", "Service", "Support", "System", "Settings"].map((text) => html.indexOf(`>${text}<`));
  expect(order.every((index) => index >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  expect(html.match(/<ul /g)).toHaveLength(4);
  expect(html).not.toMatch(/rounded-full[^"]*>[A-Z]</);
});

test("pages still declare their section marker", () => {
  expect(readFileSync("src/app/admin/orders/[orderId]/page.tsx", "utf8")).toContain('data-admin-section="orders"');
  expect(readFileSync("src/app/admin/inventory/cards/[cardId]/page.tsx", "utf8")).toContain('data-admin-section="inventory"');
});

test("dashboard shows open cases and an opening action", async () => {
  requireOwner.mockResolvedValue({ email: "owner@example.test" });
  dashboard.mockResolvedValue({ inProgress: 0, outstanding: 0, collected: 0, expenses: 0, openSupportCases: 3, stock: { status: [] }, recent: [] });
  expenseReport.mockResolvedValue({ rows: [], categories: {}, total: 0 }); listOrders.mockResolvedValue({ orders: [], next: null }); listCases.mockResolvedValue({ cases: [], next: null }); monthTrends.mockResolvedValue({ collected: [], orders: [] });
  const html = renderToStaticMarkup(await AdminHome());
  expect(html).toContain("Open support cases");
  expect(html).toContain("Open Support Case");
  expect(html).toContain('href="/admin/support/new"');
  expect(html).not.toMatch(/what needs you|Good morning/);
});

test("dashboard charts use real rows and say so when there are none", async () => {
  requireOwner.mockResolvedValue({ email: "owner@example.test" });
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" }).format(new Date());
  dashboard.mockResolvedValue({ inProgress: 1, outstanding: 50000, collected: 120000, expenses: 30000, openSupportCases: 0, stock: { status: [{ kind: "dbc", status: "ready", count: 4 }, { kind: "dbc", status: "needs_preparation", count: 4 }, { kind: "dbc", status: "available_blank", count: 1 }] }, recent: [] });
  expenseReport.mockResolvedValue({ rows: [{ spentOn: `${month}-02`, amount: 30000 }], categories: { marketing: 30000, other: 0 }, total: 30000 });
  monthTrends.mockResolvedValue({ collected: [{ day: `${month}-02`, amount: 120000 }], orders: [{ day: `${month}-02`, status: "in_progress", count: 1 }] });
  listOrders.mockResolvedValue({ orders: [], next: null }); listCases.mockResolvedValue({ cases: [], next: null });
  const html = renderToStaticMarkup(await AdminHome());
  expect(html).toContain("₱300.00");
  expect(html).toContain("Cash flow");
  expect(html).toContain("Collected, expenses and cash surplus by day");
  expect(html).toContain("Orders created by day");
  expect(html).toContain("Orders in progress");
  expect(html).toContain("Needs preparation");
  expect(html).toContain("Cash surplus");
  expect(html).toContain('aria-label="What is Cash surplus?"');
  expect(html).toContain('aria-label="What is Collected?"');
  expect(html).not.toMatch(/net income|net cash|Cards ready|Open cases/i);
  expect(html.match(/<dt/g)?.length).toBeGreaterThanOrEqual(4);
  expect(html).not.toContain("Not enough data to chart this period");
  monthTrends.mockResolvedValue({ collected: [], orders: [] }); expenseReport.mockResolvedValue({ rows: [], categories: {}, total: 0 });
  const empty = renderToStaticMarkup(await AdminHome());
  expect(empty).toContain("Not enough data to chart this period");
  expect(empty).toContain("No orders created this month");
});
