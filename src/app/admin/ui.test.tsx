import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageWindow } from "@/modules/pagination";
import { FilterBar, KpiStrip, LinkButton, listHref, Notice, PageHeader, pageHref, Pagination, RecordTable } from "./ui";

test("Vermilion buttons keep a white foreground even with the type-scale classes that used to override it", () => {
  const button = renderToStaticMarkup(<Button variant="action" size="touch" className="w-full text-body font-semibold md:h-9">Save</Button>);
  expect(button).toMatch(/class="[^"]*\btext-white\b/);
  expect(button).toContain("bg-action");
  const link = renderToStaticMarkup(<LinkButton href="/admin/orders/new" variant="action" icon={Plus}>New order</LinkButton>);
  expect(link).toMatch(/class="[^"]*\btext-white\b/);
  expect(link).toContain("bg-action");
  const danger = renderToStaticMarkup(<Button variant="danger">Delete</Button>);
  expect(danger).toMatch(/class="[^"]*\btext-white\b/);
  expect(danger).toContain("bg-destructive");
});

test("every button variant has a deliberate hover state", () => {
  for (const variant of ["action", "outline", "ghost", "destructive", "danger", "secondary"] as const) {
    expect(renderToStaticMarkup(<Button variant={variant}>Go</Button>), variant).toMatch(/class="[^"]*\bhover:/);
  }
});

test("listHref keeps only the filters that have a value", () => {
  expect(listHref("/admin/orders", { status: "open", assigneeId: undefined, before: "" })).toBe("/admin/orders?status=open");
  expect(listHref("/admin/orders", {})).toBe("/admin/orders");
});

test("pageHref keeps filters, omits page 1 and carries later pages", () => {
  const href = pageHref("/admin/orders", { status: "in_progress", assigneeId: undefined });
  expect(href(1)).toBe("/admin/orders?status=in_progress");
  expect(href(3)).toBe("/admin/orders?status=in_progress&page=3");
  expect(pageHref("/admin/search", { q: "buyer" })(2)).toBe("/admin/search?q=buyer&page=2");
});

test("pagination states the real range and total, numbers the pages and disables the ends", () => {
  const hrefFor = pageHref("/admin/orders", { status: "completed" });
  const middle = renderToStaticMarkup(<Pagination noun="orders" paging={pageWindow(148, "2")} hrefFor={hrefFor} />);
  expect(middle).toContain("Showing 21–40 of 148 orders");
  expect(middle).toContain('aria-label="Page 2"');
  expect(middle).toContain('aria-current="page"');
  expect(middle).toContain('href="/admin/orders?status=completed&amp;page=8"');
  expect(middle).toContain('href="/admin/orders?status=completed"');
  expect(middle).toContain("Page 2 of 8");
  expect(middle).toMatch(/aria-current="page"[^>]*class="[^"]*border-action\/50[^"]*bg-action\/5[^"]*text-action-text/);
  expect(middle).not.toMatch(/aria-current="page"[^>]*bg-foreground/);
  const first = renderToStaticMarkup(<Pagination noun="orders" paging={pageWindow(148, "1")} hrefFor={hrefFor} />);
  expect(first).toMatch(/aria-disabled="true"[^>]*>(?:<svg.*?<\/svg>)?Previous/);
  const last = renderToStaticMarkup(<Pagination noun="orders" paging={pageWindow(148, "99")} hrefFor={hrefFor} />);
  expect(last).toContain("Showing 141–148 of 148 orders");
  expect(last).toMatch(/aria-disabled="true"[^>]*>Next/);
});

test("pagination stays quiet for one page and says nothing for no rows", () => {
  const one = renderToStaticMarkup(<Pagination noun="orders" paging={pageWindow(3, undefined)} hrefFor={pageHref("/admin/orders", {})} />);
  expect(one).toContain("Showing 1–3 of 3 orders");
  expect(one).not.toContain("Previous");
  expect(renderToStaticMarkup(<Pagination noun="orders" paging={pageWindow(1, undefined)} hrefFor={pageHref("/admin/orders", {})} />)).toContain("of 1 order<");
  expect(renderToStaticMarkup(<Pagination noun="orders" paging={pageWindow(0, "4")} hrefFor={pageHref("/admin/orders", {})} />)).toBe("");
});

test("records render once as a table and once as a tappable list, with a link per record", () => {
  const rows = [{ id: "a", name: "Order 1003" }];
  const html = renderToStaticMarkup(<RecordTable caption="Orders" rows={rows} rowKey={(row) => row.id} href={(row) => `/admin/orders/${row.id}`} columns={[{ label: "Order", cell: (row) => row.name }]} mobile={(row) => ({ title: row.name, subtitle: "Buyer", figures: [["Balance", "₱5.00"]], meta: "Oct 19, 2026", cta: "View order" })} />);
  expect(html).toContain("<table");
  expect(html).toContain("max-md:hidden");
  expect(html).toContain('<ul aria-label="Orders"');
  expect(html).toContain('href="/admin/orders/a"');
  expect(html).toContain("View order");
  expect(html).toContain("Balance");
  const noLink = renderToStaticMarkup(<RecordTable caption="Owners" rows={rows} rowKey={(row) => row.id} href={() => undefined} columns={[{ label: "Owner", cell: (row) => row.name }]} mobile={(row) => ({ title: row.name, action: <button type="button">Edit</button> })} />);
  expect(noLink).not.toContain("<a ");
  expect(noLink).toContain(">Edit<");
});

test("filters clear with a visible link and no outer card", () => {
  const html = renderToStaticMarkup(<FilterBar clearHref="/admin/orders" submit="Filter orders"><span /></FilterBar>);
  expect(html).toContain("Clear filters");
  expect(html).not.toContain("rounded-panel");
});

test("KPI strips group figures, label every one and link only the actionable ones", () => {
  const html = renderToStaticMarkup(<KpiStrip label="Key figures" groups={[{ label: "Money", items: [{ label: "Collected", value: "₱1.00", icon: Plus }] }, { label: "Operations", items: [{ label: "Open cases", value: 3, icon: Plus, href: "/admin/support?status=open", tone: "attention" }] }]} />);
  expect(html).toContain('aria-label="Key figures"');
  expect(html).toContain(">Money<");
  expect(html).toContain(">Operations<");
  expect(html.match(/<a /g)).toHaveLength(1);
});

test("a KPI definition is a labelled, focusable help button next to the figure's label", () => {
  const html = renderToStaticMarkup(<KpiStrip label="Key figures" groups={[{ label: "Money", items: [{ label: "Collected", value: "₱1.00", icon: Plus, info: "Payments received." }] }]} />);
  expect(html).toContain('aria-label="What is Collected?"');
  expect(html).toMatch(/<button[^>]*aria-label="What is Collected\?"/);
});

test("page headers keep phone actions under the title and share the row", () => {
  const html = renderToStaticMarkup(<PageHeader title="Orders" actionsLabel="Quick actions" actions={<a href="/x">New</a>} />);
  expect(html).toContain('role="group"');
  expect(html).toContain('aria-label="Quick actions"');
  expect(html).toContain("max-sm:[&amp;&gt;*]:flex-1");
});

test("notices carry an icon and a direct action", () => {
  const html = renderToStaticMarkup(<Notice tone="warning" title="3 cards in provisioning" action={<a href="/admin/inventory">Review</a>} />);
  expect(html).toContain("3 cards in provisioning");
  expect(html).toContain("<svg");
  expect(html).toContain('href="/admin/inventory"');
});
