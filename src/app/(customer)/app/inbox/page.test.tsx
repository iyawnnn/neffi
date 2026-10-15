import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ account: vi.fn(), list: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.account }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/forms/submissions", () => ({ listInbox: m.list }));
import InboxPage from "./page";
const ID = "11111111-1111-4111-8111-111111111111";
const date = new Date("2026-10-11T04:05:00Z");
const cursorAt = "2026-10-11 04:05:00.123456+00";
const cursor = `${cursorAt}|${ID}`;
const render = async (before?: string) => renderToStaticMarkup(await InboxPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ before }) }));
beforeEach(() => { vi.resetAllMocks(); m.account.mockResolvedValue({ accountId: "a1" }); m.list.mockResolvedValue({ items: [{ id: ID, profileName: "Ana", formTitle: "Contact", preview: "Vic", createdAt: date, unread: true }], next: { createdAt: cursorAt, id: ID } }); });
test("inbox shows message summary, date, unread status and older cursor", async () => {
  const html = await render(); for (const text of ["Vic", "Ana", "Contact", "Oct 11, 2026, 12:05 PM", "New", "Show older"]) expect(html).toContain(text);
  expect(html).toContain(`?before=${encodeURIComponent(cursor)}`);
});
test("valid cursor is parsed and malformed cursor is ignored", async () => {
  await render(cursor); expect(m.list).toHaveBeenLastCalledWith({}, { accountId: "a1", before: { createdAt: cursorAt, id: ID } });
  for (const before of ["bad", `not-date|${ID}`, `${cursorAt}|bad`, `${date.toISOString()}_${ID}`, `2026-10-11 04:05:00.1234567+00|${ID}`]) { await render(before); expect(m.list).toHaveBeenLastCalledWith({}, { accountId: "a1", before: undefined }); }
});

test("ignores shaped cursors with impossible calendar, clock or timezone values", async () => {
  for (const timestamp of [
    "2026-99-11 04:05:00.123456+00", "2026-02-30 04:05:00+00", "2026-02-29 04:05:00+00",
    "2026-10-00 04:05:00+00", "0000-01-01 04:05:00+00", "2026-10-11 24:00:00+00",
    "2026-10-11 04:60:00+00", "2026-10-11 04:05:60+00", "2026-10-11 04:05:00+16:00", "2026-10-11 04:05:00+00:99",
  ]) {
    await render(`${timestamp}|${ID}`);
    expect(m.list).toHaveBeenLastCalledWith({}, { accountId: "a1", before: undefined });
  }
});

test("preserves leap-day microseconds and a timezone offset through the encoded cursor", async () => {
  const timestamp = "2024-02-29 23:59:59.123456+05:30";
  const before = `${timestamp}|${ID}`;
  m.list.mockResolvedValue({ items: [], next: { createdAt: timestamp, id: ID } });
  const html = await render(decodeURIComponent(encodeURIComponent(before)));
  expect(m.list).toHaveBeenLastCalledWith({}, { accountId: "a1", before: { createdAt: timestamp, id: ID } });
  expect(html).toContain(`?before=${encodeURIComponent(before)}`);
});
test("empty inbox explains where messages will appear", async () => {
  m.list.mockResolvedValue({ items: [], next: null }); const html = await render();
  expect(html).toContain("No messages yet. Messages people send from your Neffi appear here."); expect(html).not.toContain("Show older");
});
