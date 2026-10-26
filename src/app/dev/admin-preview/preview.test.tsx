import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); }, usePathname: () => "/dev/admin-preview", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/db", () => { throw new Error("Preview must not load the database"); });
vi.mock("@/auth/access", () => { throw new Error("Preview must not load authentication"); });
vi.mock("@/auth/actions", () => { throw new Error("Preview must not load auth actions"); });
import PreviewPage from "./[[...view]]/page";
import { dashboardData, expenses, filterQueue, MONTH, orders, report, trends } from "@/dev/admin/fixtures";
import { cashFlowPoints, expensePoints, orderPoints } from "@/app/admin/chart-data";
import { formatPeso } from "@/lib/money";

const page = (view = "dashboard", query: Record<string, string> = {}) => PreviewPage({ params: Promise.resolve({ view: [view] }), searchParams: Promise.resolve(query) });
beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL_ENV", ""); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Preview must not fetch"); })); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

test.each(["production", "test", ""])("preview returns 404 in NODE_ENV=%s", async (environment) => {
  vi.stubEnv("NODE_ENV", environment);
  await expect(page()).rejects.toThrow("NOT_FOUND");
});
test.each(["preview", "production"])("preview returns 404 in a %s deployment", async (environment) => {
  vi.stubEnv("VERCEL_ENV", environment);
  await expect(page()).rejects.toThrow("NOT_FOUND");
});

test.each(["dashboard", "orders", "inventory", "customers", "support", "expenses", "search"])("%s reuses the real presentation with only local read-only links and GET forms", async (view) => {
  const html = renderToStaticMarkup(await page(view, view === "search" ? { q: "sample" } : {}));
  expect(html).toContain("Development preview");
  expect(html.match(/(?:href|action)="\/admin[^"]*"|method="post"|\$ACTION/g)).toBeNull();
  expect(html).not.toContain('type="submit" formAction=');
  expect(fetch).not.toHaveBeenCalled();
  if (["dashboard", "inventory", "orders", "support", "expenses"].includes(view)) expect(html).toMatch(/<button[^>]*disabled=""/);
});

test("dashboard chart props are the fixture-derived daily series", async () => {
  const html = renderToStaticMarkup(await page());
  for (const amount of [dashboardData.collected, dashboardData.outstanding, report.total, dashboardData.collected - report.total]) expect(html).toContain(formatPeso(amount));
  expect(html).toContain(`${orders.length} orders were created`);
  for (const point of cashFlowPoints(MONTH, trends.collected, expenses).filter((row) => row.collected || row.expenses)) expect(html).toContain(formatPeso(point.collected));
  expect(orderPoints(MONTH, trends.orders)).toHaveLength(31);
  expect(expensePoints(MONTH, expenses)).toHaveLength(31);
});

test("stock deliveries show fixture costs and quantities without mutation actions", async () => {
  const html = renderToStaticMarkup(await page("inventory", { view: "stock" }));
  expect(html).toContain("Sample card workshop");
  expect(html).toContain("16 cards");
  expect(html).toContain("Showing 1–4 of 4 deliveries");
  expect(html.match(/href="\/admin|\$ACTION/g)).toBeNull();
});

test("last pages, invalid pages and filter reset retain the shared pagination behavior", async () => {
  for (const [view, last, expected] of [["inventory", String(Math.ceil(filterQueue(undefined).length / 20)), `Showing ${(Math.ceil(filterQueue(undefined).length / 20) - 1) * 20 + 1}–${filterQueue(undefined).length} of ${filterQueue(undefined).length} cards`], ["orders", "6", "Showing 101–102 of 102 orders"], ["customers", "3", "Showing 41–43 of 43 customers"], ["support", "2", "Showing 21–23 of 23 cases"]]) {
    expect(renderToStaticMarkup(await page(view, { page: last }))).toContain(expected);
  }
  expect(renderToStaticMarkup(await page("inventory", { page: "bad" }))).toContain(`Showing 1–20 of ${filterQueue(undefined).length} cards`);
  const html = renderToStaticMarkup(await page("orders", { status: "in_progress", page: "2" }));
  expect(html).toContain('name="status"');
  expect(html).not.toContain('name="page"');
  expect(html).toContain("/dev/admin-preview/orders?status=in_progress");
});

test("preview runtime graph contains no database, action, service, or network dependencies", () => {
  const visited = new Set<string>();
  const queue = [resolve("src/app/dev/admin-preview/[[...view]]/page.tsx")];
  while (queue.length) {
    const file = queue.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    expect(file.replaceAll("\\", "/")).not.toMatch(/\/(db|auth|config)\/|\/actions\.[jt]sx?$|\/use-record-search\./);
    const text = readFileSync(file, "utf8");
    expect(text).not.toMatch(/["']use server["']|\b(fetch|XMLHttpRequest|WebSocket)\s*\(|\b(resend|cloudinary|pg|drizzle-orm)\b/);
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    for (const node of ast.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
      if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause; const bindings = clause?.namedBindings;
        if (clause?.isTypeOnly || (!clause?.name && bindings && ts.isNamedImports(bindings) && bindings.elements.every((binding) => binding.isTypeOnly))) continue;
      } else if (node.isTypeOnly) continue;
      const specifier = node.moduleSpecifier.text;
      expect(specifier).not.toMatch(/^(pg|drizzle-orm|resend|cloudinary|@sentry)/);
      if (!specifier.startsWith("@/") && !specifier.startsWith(".")) continue;
      const base = specifier.startsWith("@/") ? resolve("src", specifier.slice(2)) : resolve(dirname(file), specifier);
      const local = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((path) => existsSync(path) && statSync(path).isFile());
      expect(local, `${file}: ${specifier}`).toBeDefined();
      queue.push(local!);
    }
  }
  expect(visited.size).toBeGreaterThan(20);
});
