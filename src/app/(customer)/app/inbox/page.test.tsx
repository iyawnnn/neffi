import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ account: vi.fn(), list: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.account }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/forms/submissions", () => ({ listInbox: m.list }));
import InboxPage from "./page";
const ID = "11111111-1111-4111-8111-111111111111";
const date = new Date("2026-10-11T04:05:00Z");
const cursor = `${date.toISOString()}_${ID}`;
const render = async (before?: string) => renderToStaticMarkup(await InboxPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ before }) }));
beforeEach(() => { vi.resetAllMocks(); m.account.mockResolvedValue({ accountId: "a1" }); m.list.mockResolvedValue({ items: [{ id: ID, profileName: "Ana", formTitle: "Contact", preview: "Vic", createdAt: date, unread: true }], next: { createdAt: date, id: ID } }); });
test("inbox shows message summary, date, unread status and older cursor", async () => {
  const html = await render(); for (const text of ["Vic", "Ana", "Contact", "Oct 11, 2026, 12:05 PM", "New", "Show older"]) expect(html).toContain(text);
  expect(decodeURIComponent(html)).toContain(`?before=${cursor}`);
});
test("valid cursor is parsed and malformed cursor is ignored", async () => {
  await render(cursor); expect(m.list).toHaveBeenLastCalledWith({}, { accountId: "a1", before: { createdAt: date, id: ID } });
  for (const before of ["bad", `not-date_${ID}`, `${date.toISOString()}_bad`]) { await render(before); expect(m.list).toHaveBeenLastCalledWith({}, { accountId: "a1", before: undefined }); }
});
test("empty inbox explains where messages will appear", async () => {
  m.list.mockResolvedValue({ items: [], next: null }); const html = await render();
  expect(html).toContain("No messages yet. Messages people send from your Neffi appear here."); expect(html).not.toContain("Show older");
});
