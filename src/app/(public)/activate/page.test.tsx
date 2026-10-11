import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ getViewer: vi.fn(), readChallenge: vi.fn(), ownedCards: vi.fn() }));
vi.mock("@/auth/access", () => ({ getViewer: m.getViewer }));
vi.mock("./challenge-cookie", () => ({ readChallenge: m.readChallenge }));
vi.mock("@/modules/cards/owned", () => ({ ownedCards: m.ownedCards }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("./activate-forms", () => ({
  CodeForm: () => <form data-code-form="" />,
  ClaimForm: () => <button>Add to my account</button>,
  SwitchAccountButton: () => <button>Use a different account</button>,
  StartOverButton: () => <button>Enter a different code</button>,
}));
vi.mock("../sign-in/sign-in-form", () => ({ SignInForm: ({ next }: { next: string }) => <div data-sign-in={next} /> }));

import ActivatePage from "./page";

const VIEWER = { accountId: "11111111-1111-4111-8111-111111111111", email: "a@example.test", role: "customer" };
const CARD = { id: "c1", publicToken: "A".repeat(22) + "WXYZ", profileId: null };
const render = async (search: Record<string, string> = {}) =>
  renderToStaticMarkup(await ActivatePage({ params: Promise.resolve({}), searchParams: Promise.resolve(search) } as Parameters<typeof ActivatePage>[0]));
const text = (html: string) => html.replace(/<[^>]+>/g, " ");

beforeEach(() => {
  vi.clearAllMocks();
  m.getViewer.mockResolvedValue(null);
  m.readChallenge.mockResolvedValue(null);
  m.ownedCards.mockResolvedValue([]);
});

test("signed out: code entry with a way to sign in", async () => {
  const html = await render();
  expect(html).toContain("Activate your Neffi");
  expect(html).toContain("Enter the activation code inside your package.");
  expect(html).toContain("data-code-form");
  expect(html).toContain('href="/sign-in?next=/activate"');
  expect(html).not.toContain("Go to my Neffi");
});

test("signed in without cards: activate your Neffi, identity shown, easy way home", async () => {
  m.getViewer.mockResolvedValue(VIEWER);
  const html = await render();
  expect(html).toContain("Activate your Neffi");
  expect(html).toContain("Signed in as");
  expect(html).toContain("a@example.test");
  expect(html).toContain("Go to my Neffi");
  expect(html).toContain('href="/app"');
});

test("signed in with a card: repeat scan offers another activation, no auto-redirect", async () => {
  m.getViewer.mockResolvedValue(VIEWER);
  m.ownedCards.mockResolvedValue([CARD]);
  const html = await render();
  expect(html).toContain("Activate another Neffi");
  expect(html).toContain("data-code-form");
  expect(html).not.toContain("WXYZ");
});

test("signed out with an accepted code: sign in and come back here", async () => {
  m.readChallenge.mockResolvedValue("cred-1");
  const html = await render();
  expect(html).toContain("Code accepted");
  expect(html).toContain('data-sign-in="/activate"');
  expect(html).toContain("Enter a different code");
  expect(html).not.toContain("data-code-form");
  expect(m.ownedCards).not.toHaveBeenCalled();
});

test("signed in with an accepted code: confirm the account that will own it", async () => {
  m.getViewer.mockResolvedValue(VIEWER);
  m.readChallenge.mockResolvedValue("cred-1");
  const html = await render();
  expect(html).toContain("Add this Neffi to your account");
  expect(html).toContain("a@example.test");
  expect(html).toContain("Add to my account");
  expect(html).toContain("Use a different account");
  expect(html).toContain("Enter a different code");
  expect(m.ownedCards).not.toHaveBeenCalled();
});

test.each([
  ["expired", null, "For your security, please enter your code again."],
  ["unavailable", null, "If you already added this Neffi, sign in to find it."],
  ["unavailable", VIEWER, "This code can't be used. Please contact Neffi support for help."],
])("notice %s is shown in a status region", async (notice, viewer, copy) => {
  m.getViewer.mockResolvedValue(viewer);
  const html = await render({ notice });
  expect(html).toMatch(/role="status"/);
  expect(text(html)).toContain(copy.replaceAll("'", "&#x27;"));
});

test("unknown notices render nothing extra", async () => {
  const html = await render({ notice: "<script>alert(1)</script>" });
  expect(html).not.toMatch(/role="status"/);
  expect(html).not.toContain("<script>");
});

test("no technical vocabulary on any screen", async () => {
  const states: [unknown, string | null][] = [[null, null], [VIEWER, null], [null, "cred-1"], [VIEWER, "cred-1"]];
  for (const [viewer, challenge] of states) {
    m.getViewer.mockResolvedValue(viewer);
    m.readChallenge.mockResolvedValue(challenge);
    expect(text(await render())).not.toMatch(/token|challenge|hmac|oauth|credential|transaction/i);
  }
});
