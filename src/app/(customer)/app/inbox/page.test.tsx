import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ account: vi.fn(), list: vi.fn(), unread: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.account }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/forms/submissions", () => ({ listInbox: m.list, unreadCount: m.unread }));
import InboxPage from "./page";
const ID = "11111111-1111-4111-8111-111111111111";
const date = new Date("2026-10-11T04:05:00Z");
const cursorAt = "2026-10-11 04:05:00.123456+00";
const cursor = `${cursorAt}|${ID}`;
const render = async (before?: string, filter?: string) => renderToStaticMarkup(await InboxPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ before, filter }) }));
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-11T05:00:00Z")); m.account.mockResolvedValue({ accountId: "a1" }); m.unread.mockResolvedValue(1); m.list.mockResolvedValue({ items: [{ id: ID, profileName: "Ana", formTitle: "Contact", senderName: "Test Sender", senderEmail: "sender@example.test", messagePreview: "A website inquiry", createdAt: date, unread: true }], next: { createdAt: cursorAt, id: ID } }); });
afterEach(() => vi.useRealTimers());
test("inbox shows message summary, date, unread status and older cursor", async () => {
  const html = await render(); for (const text of ["Test Sender", "A website inquiry", "Contact", "12:05 PM", "Unread message", "Show older"]) expect(html).toContain(text);
  const row = html.match(/<li\b[^>]*>[\s\S]*?<\/li>/)![0];
  expect(row).not.toContain("Ana");
  expect(row).not.toContain("Untitled profile");
  expect(row).toMatch(/<span class="[^"]*truncate[^"]*">Contact<\/span>/);
  expect(row).not.toContain("via Contact");
  expect(html).toMatch(/datetime="2026-10-11T04:05:00.000Z"/i);
  expect(html).not.toContain(">New<");
  expect(html).toContain(`?before=${encodeURIComponent(cursor)}`);
  expect(html).toContain(`href="/app/inbox/${ID}"`);
  expect(html).not.toContain("No messages yet");
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
  m.unread.mockResolvedValue(0); m.list.mockResolvedValue({ items: [], next: null }); const html = await render();
  expect(html).toMatch(/<h1\b[^>]*>Inbox<\/h1>/);
  expect(html).toContain("Messages people send through your Neffi profiles appear here.");
  expect(html).toContain("No messages yet");
  expect(html).toContain("When someone sends you a message through one of your Neffi contact forms, it will appear here.");
  expect(html).toContain('aria-label="Messages"');
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain("<svg");
  expect(html.match(/<section\b[\s\S]*?<\/section>/)![0]).not.toMatch(/<(?:a|button|ul)\b/);
  for (const text of ["Vic", "Ana", "Contact", "Show older", "Create contact form", "Set up messages"]) expect(html).not.toContain(text);
  expect(m.account).toHaveBeenCalledWith("/app");
  expect(m.list).toHaveBeenCalledOnce();
  expect(m.list).toHaveBeenCalledWith({}, { accountId: "a1", before: undefined });
});

test("empty inbox uses the shared canvas and a restrained responsive content surface", async () => {
  m.list.mockResolvedValue({ items: [], next: null }); const html = await render();
  expect(html).toMatch(/<main\b[^>]*data-canvas/);
  const shell = readFileSync("src/app/(customer)/app/app-nav.tsx", "utf8").match(/<header className="([^"]+)"/)![1];
  for (const token of ["mx-auto", "w-full", "max-w-6xl", "px-4", "md:px-6"]) { expect(shell).toContain(token); expect(html).toContain(token); }
  expect(html).toContain("sm:min-h-[300px]");
  expect(html).toContain("rounded-panel border bg-background");
  expect(html).not.toMatch(/(?:^|\s)(?:sticky|fixed|h-screen|min-h-screen)(?:\s|$)/);
});

test("requires an account before loading any messages", async () => {
  m.account.mockRejectedValue(new Error("SIGN_IN_REQUIRED"));
  await expect(render()).rejects.toThrow("SIGN_IN_REQUIRED");
  expect(m.list).not.toHaveBeenCalled();
  expect(m.unread).not.toHaveBeenCalled();
});

test("read and unread rows share one divided surface and fall back without invented initials", async () => {
  const item = (await m.list()).items[0]; m.list.mockClear();
  m.list.mockResolvedValue({ items: [item, { ...item, id: "second", senderName: null, senderEmail: "unknown@example.test", unread: false }], next: null });
  const html = await render();
  expect(html.match(/<section\b/g)).toHaveLength(1);
  expect(html).toMatch(/<ul[^>]*class="divide-y"/);
  expect(html.match(/<li\b/g)).toHaveLength(2);
  expect(html.match(/Unread message/g)).toHaveLength(1);
  expect(html).toContain("unknown@example.test");
  expect(html).not.toContain(">TS<");
  expect(html).not.toMatch(/lucide-(?:chevron-right|user-round)/);
  expect(html).not.toContain('aria-label="Message actions');
  expect(html).not.toMatch(/lucide-(?:ellipsis|more-horizontal)/);
  const rows = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)];
  for (const row of rows) {
    expect(row[1]).toMatch(/^<a\b[\s\S]*<\/a>$/);
    expect(row[1]).not.toMatch(/<(?:button|img)\b/);
    expect(row[1]).toContain("cursor-pointer");
    expect(row[1]).toContain("focus-visible:outline-2");
    expect(row[1]).toContain("line-clamp-2");
    expect(row[1]).not.toContain("sm:line-clamp-1");
    expect(row[1]).toContain("gap-y-1");
  }
  for (const anchor of html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)) expect(anchor[0]).not.toContain("<button");
  expect(html).toContain("truncate");
  expect(html).toContain("min-h-11");
});

test("full message text reaches the two-line preview without a fixed width or timestamp overlap", async () => {
  const item = (await m.list()).items[0]; m.list.mockClear();
  const message = "Hello! I found your profile and wanted to ask whether you are available for a website project next month.";
  m.list.mockResolvedValue({ items: [{ ...item, messagePreview: message }], next: null });
  const html = await render();
  expect(html).toContain(message);
  const preview = html.match(/<span class="[^"]*line-clamp-2[^"]*">[^<]*<\/span>/)![0];
  expect(preview).toContain("col-start-2"); expect(preview).toContain("wrap-anywhere");
  expect(preview).not.toMatch(/(?:max-)?w-\[/);
  expect(preview).not.toContain("<time");
  expect(html).toMatch(/<time[^>]*class="[^"]*shrink-0/);
});

test("header keeps filters beside the title when space allows and description on its own line", async () => {
  const html = await render();
  const header = html.match(/<header\b[^>]*>[\s\S]*?<\/header>/)![0];
  expect(header).toContain('aria-label="Inbox filters"');
  expect(header.indexOf("Inbox filters")).toBeLessThan(header.indexOf("Messages people send"));
  expect(header).toContain("flex-wrap"); expect(header).toContain("justify-between");
  const nav = header.match(/<nav\b[^>]*>/)![0];
  expect(nav).toContain("ml-auto"); expect(nav).toContain("shrink-0");
  expect(nav).toContain("order-3"); expect(nav).toContain("min-[375px]:order-2");
  const description = header.match(/<p\b[^>]*>/)![0];
  expect(description).toContain("basis-full"); expect(description).toContain("order-2");
  expect(description).toContain("min-[375px]:order-3");
  for (const filter of header.matchAll(/<a\b[^>]*>/g)) expect(filter[0]).toContain("min-h-11");
});

test("All is the default and invalid filters fall back to All", async () => {
  for (const filter of [undefined, "invalid"]) {
    const html = await render(undefined, filter);
    expect(html).toMatch(/id="inbox-all"[^>]*aria-current="page"/);
    expect(m.list).toHaveBeenLastCalledWith({}, { accountId: "a1", before: undefined });
    expect(html).toMatch(/Unread<span[^>]*>1<\/span>/);
  }
});

test("Unread queries unread-only data and preserves the filter through pagination", async () => {
  const html = await render(cursor, "unread");
  expect(m.list).toHaveBeenLastCalledWith({}, { accountId: "a1", before: { createdAt: cursorAt, id: ID }, unreadOnly: true });
  expect(html).toMatch(/<a\b[^>]*aria-current="page"[^>]*href="\/app\/inbox\?filter=unread"/);
  expect(html).toContain(`?filter=unread&amp;before=${encodeURIComponent(cursor)}`);
});

test("empty unread filter shows caught-up copy instead of the zero-Inbox state", async () => {
  m.unread.mockResolvedValue(0); m.list.mockResolvedValue({ items: [], next: null });
  const html = await render(undefined, "unread");
  expect(html).toContain("You&#x27;re all caught up");
  expect(html).toContain("You have no unread messages.");
  expect(html).not.toContain("No messages yet");
  expect(html).not.toContain("Show older");
});

test("missing sender identity falls back to Unknown sender and zero unread count is quiet", async () => {
  const item = (await m.list()).items[0]; m.list.mockClear();
  m.unread.mockResolvedValue(0); m.list.mockResolvedValue({ items: [{ ...item, senderName: null, senderEmail: null, unread: false }], next: null });
  const html = await render();
  expect(html).toContain("Unknown sender");
  expect(html).not.toContain("Unread message");
  expect(html).not.toMatch(/\d+ unread/);
  expect(html).toContain("font-normal");
});
