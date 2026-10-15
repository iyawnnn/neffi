import { renderToStaticMarkup } from "react-dom/server";
import { useActionState } from "react";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ account: vi.fn(), methods: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.account }));
vi.mock("@/auth/methods", () => ({ getLinkedMethods: m.methods }));
vi.mock("./account-actions", () => ({ AccountActions: ({ googleLinked }: { googleLinked: boolean }) => googleLinked ? null : <button>Connect Google</button> }));
vi.mock("./actions", () => ({ removeGoogleAction: vi.fn(), requestEmailChangeAction: vi.fn(), confirmEmailChangeAction: vi.fn(), signOutEverywhereAction: vi.fn() }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});
import AccountPage from "./page";
import { ChangeEmailForm } from "./account-forms";
const render = async (changed?: string) => renderToStaticMarkup(await AccountPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ changed }) }));
beforeEach(() => { vi.clearAllMocks(); m.account.mockResolvedValue({ accountId: "a1", email: "a@example.test" }); m.methods.mockResolvedValue({ google: true }); });
test("account has sign-in methods, changes, session controls and support deletion", async () => {
  const html = await render("1"); for (const copy of ["Signed in as", "a@example.test", "Sign-in methods", "Email code", "Google", "Remove Google", "You can still sign in with an email code.", "Change sign-in email", "Send code", "Sign out everywhere", "To delete your account, please contact Neffi support.", "Your sign-in email has been changed."]) expect(html).toContain(copy);
  expect(html).toContain('href="/support?topic=recovery"');
});
test("unlinked account offers Connect Google", async () => { m.methods.mockResolvedValue({ google: false }); const html = await render(); expect(html).toContain("Connect Google"); expect(html).not.toContain("Remove Google"); });

test("Account form controls submit rather than silently doing nothing", async () => {
  const html = await render();
  for (const label of ["Remove Google", "Send code", "Sign out everywhere"]) {
    expect(html.match(new RegExp(`<button\\b[^>]*>${label}</button>`))?.[0]).toContain('type="submit"');
  }
});

test("email confirmation submits while switching addresses stays a local action", () => {
  vi.mocked(useActionState).mockReturnValueOnce([{ step: "code", email: "new@example.test" }, vi.fn(), false]).mockReturnValueOnce([undefined, vi.fn(), false]);
  const html = renderToStaticMarkup(<ChangeEmailForm />);
  expect(html.match(/<button\b[^>]*>Change email<\/button>/)?.[0]).toContain('type="submit"');
  expect(html.match(/<button\b[^>]*>Use a different address<\/button>/)?.[0]).toContain('type="button"');
});
