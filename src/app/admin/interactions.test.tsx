import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/orders", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/auth/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("@/components/session-keep-alive", () => ({ SessionKeepAlive: () => null }));
import { ActionForm } from "./inventory/forms";
import { AdminShell } from "./shell";
import { MobileMenu } from "./mobile-menu";
import { CashFlowChart, ExpenseCategoriesChart, OrdersChart, StateBar } from "./charts";
import { cashFlowPoints, groupCategories, orderPoints } from "./chart-data";
import { describeHit, hitHref, hitKey } from "./search/hits";
import { InventorySummary } from "./inventory-summary";

const noop = async () => ({});

test("a confirmation flag belongs only to the accepted submitter, with no checkbox", () => {
  const html = renderToStaticMarkup(<ActionForm action={noop} submit="Cancel order" variant="destructive" confirm={{ field: "confirm", title: "Cancel Order 1002?", description: "This is final." }}><input type="hidden" name="orderId" value="x" /></ActionForm>);
  expect(html).toContain('type="submit" hidden="" value="on" name="confirm"');
  expect(html).not.toContain('type="hidden" name="confirm"');
  expect(html).not.toContain('type="checkbox"');
  expect(html).toContain('type="button"');
  expect(renderToStaticMarkup(<ActionForm action={noop} submit="Save" />)).not.toContain('name="confirm"');
});

test("the shell shows the sidebar nav once, a labelled phone menu button, and no horizontal tab strip", () => {
  const html = renderToStaticMarkup(<AdminShell email="owner@example.test"><p>page</p></AdminShell>);
  expect(html.match(/aria-label="Owner navigation"/g)).toHaveLength(1);
  expect(html).toContain('aria-label="Open menu"');
  expect(html).toContain('aria-label="Search"');
  expect(html).not.toContain("overflow-x-auto");
  expect(html).not.toMatch(/rounded-full[^>]*>O</);
  expect(html).toContain("owner@example.test");
  expect(html).toContain("Owner");
  // Sign out lives inside the account menu, so it is not in the resting markup and no oversized button sits in the sidebar.
  expect(html).not.toContain("Sign out");
  expect(html).toContain("aria-haspopup=\"menu\"");
  expect(html).not.toMatch(/before:(absolute|w-0\.5)/);
});

test("the phone menu keeps its navigation out of the page until it is opened", () => {
  const html = renderToStaticMarkup(<MobileMenu account={<p>account</p>} />);
  expect(html).toContain('aria-label="Open menu"');
  expect(html).not.toContain("Owner navigation");
});

test("charts ship a summary and a screen-reader table of the real numbers", () => {
  const cash = renderToStaticMarkup(<CashFlowChart summary="Collected 1 and spent 2." points={cashFlowPoints("2026-10", [{ day: "2026-10-04", amount: 50000 }], [{ spentOn: "2026-10-01", amount: 215000 }])} />);
  expect(cash).toContain("Collected 1 and spent 2.");
  expect(cash).toContain("Collected, expenses and cash surplus by day");
  expect(cash).toContain("Cash surplus");
  expect(cash).toContain("October 4");
  expect(cash).toContain("₱500.00");
  expect(cash).not.toContain("October 2<");
  const orders = renderToStaticMarkup(<OrdersChart summary="3 orders." points={orderPoints("2026-10", [{ day: "2026-10-10", status: "completed", count: 2 }])} />);
  expect(orders).toContain("October 10");
  const bar = renderToStaticMarkup(<StateBar name="Digital Business Card" max={10} segments={[{ key: "ready", label: "Ready", value: 4, color: "red" }, { key: "blank", label: "Blank", value: 0, color: "grey" }]} />);
  expect(bar).toContain("Digital Business Card: 4 cards. 4 Ready.");
  expect(bar).not.toContain("recharts-tooltip-wrapper");
});

test("inventory summary carves provisioning out of blank and never invents cards", () => {
  const html = renderToStaticMarkup(<InventorySummary full inProvisioning={4} rows={[{ kind: "dbc", state: "blank", count: 6 }, { kind: "dbc", state: "ready", count: 2 }, { kind: "grc", state: "reserved", count: 1 }]} />);
  expect(html).toContain(">9<");
  expect(html).toContain("cards in total");
  expect(html).toContain("In provisioning");
  expect(html).toContain('href="/admin/inventory?state=ready"');
  expect(renderToStaticMarkup(<InventorySummary inProvisioning={0} rows={[]} />)).toContain("No cards yet");
});

test("search hits link to the right record and show only the card ending", () => {
  const tracking = { type: "tracking", id: "same-order", title: "TRACK-1", subtitle: "Order 1", status: null, matched: "Tracking number" } as const;
  expect(hitKey(tracking)).not.toBe(hitKey({ ...tracking, title: "TRACK-2" }));
  expect(hitHref(tracking)).toBe(hitHref({ ...tracking, id: "same-order" }));
  expect(hitHref({ type: "order", id: "a" })).toBe("/admin/orders/a");
  expect(hitHref({ type: "tracking", id: "o" })).toBe("/admin/orders/o");
  expect(hitHref({ type: "customer", id: "p" })).toBe("/admin/customers/purchasers/p");
  expect(hitHref({ type: "account", id: "c" })).toBe("/admin/customers/accounts/c");
  expect(hitHref({ type: "card", id: "k" })).toBe("/admin/inventory/cards/k");
  expect(hitHref({ type: "support", id: "s" })).toBe("/admin/support/s");
  expect(describeHit({ type: "card", id: "k", title: "42AF", subtitle: "dbc", status: "ready", matched: "Card ending" })).toEqual({ title: "•••• 42AF", subtitle: "Digital Business Card", status: "Ready" });
});

test("category bars show ranked amounts and shares with an accessible data table", () => {
  const slices = groupCategories([{ key: "inventory_production", label: "Inventory production", amount: 200000 }, { key: "shipping_delivery", label: "Shipping delivery", amount: 27000 }]);
  const html = renderToStaticMarkup(<ExpenseCategoriesChart slices={slices} summary="Spending by category." />);
  expect(html).toContain("Inventory production");
  expect(html).toContain("₱2,000.00");
  expect(html).toContain(">88%<");
  expect(html).toContain("₱270.00");
  expect(html).toContain(">12%<");
  expect(html).toContain('aria-label="Expense category distribution"');
  expect(html).toContain("Expenses by category");
  expect(html).toContain("Spending by category.");
});
