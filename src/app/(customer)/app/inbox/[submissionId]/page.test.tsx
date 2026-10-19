import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ account: vi.fn(), open: vi.fn(), unread: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.account }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/forms/submissions", () => ({ openSubmission: m.open, unreadCount: m.unread }));
vi.mock("./message-actions", () => ({ MessageActions: ({ sender }: { sender: string }) => <button aria-label={`Message actions for ${sender}`}>Actions</button> }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import MessagePage from "./page";
const detail = { id: "s1", profileName: "Ana", formTitle: "Contact", answers: [{ label: "Your name", value: "Vic" }, { label: "Email", value: "vic@e.test" }, { label: "Phone", value: "0917 555 0123" }, { label: "Company", value: "Test studio" }, { label: "Message", value: "A project inquiry.\nAre you available?" }, { label: "Budget", value: "50000" }, { label: "Timeline", value: "Next month" }], createdAt: new Date("2026-10-11T04:05:00Z"), replyEmail: "vic@e.test" };
const render = async () => renderToStaticMarkup(await MessagePage({ params: Promise.resolve({ submissionId: "s1" }), searchParams: Promise.resolve({}) }));
beforeEach(() => { vi.resetAllMocks(); m.unread.mockResolvedValue(0); m.account.mockResolvedValue({ accountId: "a1" }); m.open.mockResolvedValue(detail); });
test("sender-first header has email, form context, date, reply button and management menu", async () => {
  const html = await render();
  expect(html).toMatch(/<h1[^>]*>Vic<\/h1>/);
  const header = html.match(/<header\b[\s\S]*?<\/header>/)![0];
  for (const copy of ["vic@e.test", "Contact", "Oct 11, 2026, 12:05 PM", "Reply by email"]) expect(header).toContain(copy);
  expect(html).not.toContain("Ana"); expect(html).not.toContain("Your name");
  expect(html).toContain('href="mailto:vic@e.test"'); expect(html).not.toContain('type="checkbox"');
  const reply = header.match(/<a\b[^>]*href="mailto:vic@e.test"[^>]*>[\s\S]*?<\/a>/)![0];
  expect(reply).toContain("lucide-mail"); expect(reply).toContain("border-border"); expect(reply).toContain("h-11");
  expect(html).not.toContain("I understand"); expect(html).toContain("Back to Inbox");
  expect(html).toContain('aria-label="Message actions for Vic"');
  expect(m.open).toHaveBeenCalledWith({}, { accountId: "a1", submissionId: "s1" });
  expect(m.unread).toHaveBeenCalledWith({}, "a1");
  expect(m.open.mock.invocationCallOrder[0]).toBeLessThan(m.unread.mock.invocationCallOrder[0]);
});
test("phone-only messages have no email reply link", async () => { m.open.mockResolvedValue({ ...detail, replyEmail: null }); expect(await render()).not.toContain("Reply by email"); });
test("unknown message is not found", async () => { m.open.mockResolvedValue(null); await expect(render()).rejects.toThrow("NOT_FOUND"); });

test("message is prioritized, preserves line breaks and contact/custom answers retain their groups", async () => {
  const html = await render();
  const message = html.match(/<section aria-labelledby="message-title"[\s\S]*?<\/section>/)![0];
  expect(message).toContain("A project inquiry.\nAre you available?"); expect(message).toContain("whitespace-pre-wrap"); expect(message).toContain("wrap-anywhere");
  expect(message).toContain("leading-7");
  for (const token of ["bg-canvas", "rounded-lg", "p-4", "sm:p-5", "max-w-prose"]) expect(message).toContain(token);
  expect(message).not.toContain("shadow");
  const contact = html.match(/<section aria-labelledby="contact-title"[\s\S]*?<\/section>/)![0];
  for (const value of ["Email", "vic@e.test", "Phone", "0917 555 0123", "Company", "Test studio"]) expect(contact).toContain(value);
  expect(contact).toContain('href="tel:09175550123"'); expect(contact).toContain("sm:grid-cols-2");
  for (const icon of ["lucide-mail", "lucide-phone", "lucide-building-2"]) expect(contact).toContain(icon);
  expect(contact.match(/aria-hidden="true"/g)).toHaveLength(3);
  expect(contact).toContain("font-medium"); expect(contact).not.toContain("rounded-panel");
  expect(contact.match(/class="(?:group )?flex min-h-11 min-w-0 items-start gap-2/g)).toHaveLength(3);
  expect(contact.match(/<dl class="min-w-0 flex-1">/g)).toHaveLength(3);
  expect(contact).toContain("gap-y-3"); expect(contact).not.toContain("mt-0.5");
  for (const value of contact.matchAll(/<dd\b[^>]*>/g)) expect(value[0]).not.toMatch(/min-h-|\bmt-/);
  for (const link of contact.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)) {
    expect(link[0]).toContain("min-h-11");
    expect(link[0]).toContain("<dt"); expect(link[0]).toContain("<dd");
  }
  expect(contact).not.toContain("pl-7");
  const additional = html.match(/<section aria-labelledby="additional-title"[\s\S]*?<\/section>/)![0];
  expect(additional).toContain("Budget"); expect(additional).toContain("50000"); expect(additional).toContain("Next month");
  expect(additional.indexOf("Budget")).toBeLessThan(additional.indexOf("Timeline")); expect(additional).not.toContain("vic@e.test");
});

test("missing optional fields omit empty sections and use a safe sender fallback", async () => {
  m.open.mockResolvedValue({ ...detail, answers: [], replyEmail: null });
  const html = await render(); expect(html).toContain("Unknown sender");
  expect(html).not.toContain("<section"); expect(html).not.toContain("Reply by email");
  m.open.mockResolvedValue({ ...detail, answers: [{ label: "Email", value: "vic@e.test" }] });
  expect(await render()).toMatch(/<h1[^>]*>vic@e.test<\/h1>/);
});

test("label matching ignores case/whitespace, promotes Name and preserves duplicate/custom answers", async () => {
  m.open.mockResolvedValue({ ...detail, answers: [{ label: " NAME ", value: "Sender" }, { label: "Name", value: "Extra name" }, { label: " message ", value: "First message" }, { label: "Message", value: "Second message" }, { label: " email ", value: "vic@e.test" }] });
  const html = await render(); expect(html).toMatch(/<h1[^>]*>Sender<\/h1>/);
  for (const value of ["Extra name", "First message", "Second message", "vic@e.test"]) expect(html).toContain(value);
});

test("shared width and responsive actions preserve mobile gutters and touch targets", async () => {
  const html = await render();
  for (const token of ["max-w-6xl", "px-4", "md:px-6", "flex-wrap", "sm:flex-row", "min-h-11"]) expect(html).toContain(token);
  expect(html).not.toContain("sticky"); expect(html).not.toContain("fixed");
});

test("access is checked before opening the submission", async () => {
  m.account.mockRejectedValue(new Error("SIGN_IN"));
  await expect(render()).rejects.toThrow("SIGN_IN"); expect(m.open).not.toHaveBeenCalled();
});
