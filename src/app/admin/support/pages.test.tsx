import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const { requireOwner, listCases, getCaseDetail, caseLinkOptions } = vi.hoisted(() => ({ requireOwner: vi.fn(), listCases: vi.fn(), getCaseDetail: vi.fn(), caseLinkOptions: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireOwner }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/modules/support/queries", () => ({ listCases, getCaseDetail, caseLinkOptions }));
vi.mock("@/modules/orders/queries", () => ({ orderAssignees: vi.fn().mockResolvedValue([]) }));
vi.mock("@/modules/orders/purchasers", () => ({ getPurchaser: vi.fn().mockResolvedValue(null) }));
vi.mock("@/modules/accounts/directory", () => ({ accountDirectoryDetail: vi.fn().mockResolvedValue(null) }));
vi.mock("@/modules/inventory/queries", () => ({ getCardDetail: vi.fn().mockResolvedValue(null) }));
vi.mock("@/config/env", () => ({ env: {} }));
vi.mock("./[caseId]/actions", () => ({ openCaseAction: vi.fn(), assignCaseAction: vi.fn(), setCaseStatusAction: vi.fn(), reopenCaseAction: vi.fn(), addCaseNoteAction: vi.fn(), fillCaseLinkAction: vi.fn(), linkCaseCardAction: vi.fn() }));
import Queue from "./page";
import Detail from "./[caseId]/page";
import NewCase from "./new/page";
import { AdminNav } from "../admin-nav";
const id = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
const detail = { id, type: "other", status: "open", summary: "Correct a payment", purchaserId: null, accountId: null, orderId: null, assignedToAccountId: null, createdAt: new Date("2026-10-14"), updatedAt: new Date("2026-10-14"), resolvedAt: null, order: null, account: null, purchaser: null, cards: [], refunds: [], shipments: [], linkedOrders: [], timeline: [], assignees: [] };
beforeEach(() => { vi.clearAllMocks(); requireOwner.mockResolvedValue({ accountId: id }); listCases.mockResolvedValue({ cases: [], next: null }); getCaseDetail.mockResolvedValue(detail); caseLinkOptions.mockResolvedValue({ orders: [], purchasers: [], accounts: [], cards: [] }); });

test.each(["open", "waiting_on_customer", "resolved"])("owner workspace renders %s and retains notes", async (status) => {
  getCaseDetail.mockResolvedValue({ ...detail, status });
  const html = renderToStaticMarkup(await Detail({ params: Promise.resolve({ caseId: id }), searchParams: Promise.resolve({}) }));
  expect(html).toContain("Correct a payment");
  expect(html).toContain("Internal note");
  expect(html).toContain(status === "resolved" ? "Reopen case" : "Resolve case");
});

test("queue renders empty state and Support navigation", async () => {
  const html = renderToStaticMarkup(await Queue({ searchParams: Promise.resolve({}) }));
  expect(html).toContain("No support cases match");
  expect(renderToStaticMarkup(<AdminNav />)).toContain('href="/admin/support"');
});

test("new case rejects malformed or nonexistent prefilled records", async () => {
  await expect(NewCase({ searchParams: Promise.resolve({ accountId: "bad" }) })).rejects.toThrow();
  await expect(NewCase({ searchParams: Promise.resolve({ accountId: id }) })).rejects.toThrow();
  expect(renderToStaticMarkup(await NewCase({ searchParams: Promise.resolve({}) }))).toContain("Open support case");
});

test("every support page denies customers before data reads", async () => {
  requireOwner.mockRejectedValue(new Error("denied"));
  await expect(Queue({ searchParams: Promise.resolve({}) })).rejects.toThrow("denied");
  await expect(Detail({ params: Promise.resolve({ caseId: id }), searchParams: Promise.resolve({}) })).rejects.toThrow("denied");
  await expect(NewCase({ searchParams: Promise.resolve({}) })).rejects.toThrow("denied");
  expect(listCases).not.toHaveBeenCalled();
  expect(getCaseDetail).not.toHaveBeenCalled();
});
