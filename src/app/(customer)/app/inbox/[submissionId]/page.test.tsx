import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ account: vi.fn(), open: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.account }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/forms/submissions", () => ({ openSubmission: m.open }));
vi.mock("../actions", () => ({ deleteSubmissionAction: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import MessagePage from "./page";
const detail = { id: "s1", profileName: "Ana", formTitle: "Contact", answers: [{ label: "Your name", value: "Vic" }], createdAt: new Date("2026-10-11T04:05:00Z"), replyEmail: "vic@e.test" };
const render = async () => renderToStaticMarkup(await MessagePage({ params: Promise.resolve({ submissionId: "s1" }), searchParams: Promise.resolve({}) }));
beforeEach(() => { vi.resetAllMocks(); m.account.mockResolvedValue({ accountId: "a1" }); m.open.mockResolvedValue(detail); });
test("message shows the snapshot, date, reply link and delete confirmation", async () => {
  const html = await render(); for (const copy of ["Your name", "Vic", "Oct 11, 2026, 12:05 PM", "Reply by email", "Delete message"]) expect(html).toContain(copy);
  expect(html).toContain('href="mailto:vic@e.test"'); expect(html).toContain('name="confirm"');
});
test("phone-only messages have no email reply link", async () => { m.open.mockResolvedValue({ ...detail, replyEmail: null }); expect(await render()).not.toContain("Reply by email"); });
test("unknown message is not found", async () => { m.open.mockResolvedValue(null); await expect(render()).rejects.toThrow("NOT_FOUND"); });
