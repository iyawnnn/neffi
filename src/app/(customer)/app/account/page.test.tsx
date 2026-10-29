import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useActionState } from "react";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ account: vi.fn(), methods: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.account }));
vi.mock("@/auth/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("@/auth/methods", () => ({ getLinkedMethods: m.methods }));
vi.mock("./account-actions", () => ({ AccountActions: ({ googleLinked }: { googleLinked: boolean }) => googleLinked ? null : <button>Connect Google</button> }));
vi.mock("./actions", () => ({ removeGoogleAction: vi.fn(), requestEmailChangeAction: vi.fn(), confirmEmailChangeAction: vi.fn(), signOutEverywhereAction: vi.fn() }));
vi.mock("@base-ui/react/alert-dialog", () => {
  const content = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    AlertDialog: {
      Root: content,
      Portal: content,
      Backdrop: () => null,
      Popup: content,
      Title: ({ children, className }: { children?: ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
      Description: ({ children, className }: { children?: ReactNode; className?: string }) => <p className={className}>{children}</p>,
      Close: ({ children, render }: { children?: ReactNode; render?: React.ReactElement }) => render ?? <button type="button">{children}</button>,
      Trigger: ({ children, render }: { children?: ReactNode; render?: React.ReactElement }) => render ?? <button type="button">{children}</button>,
    },
  };
});
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useActionState: vi.fn(actual.useActionState) };
});
import AccountPage from "./page";
import { ChangeEmailForm, RemoveGoogleForm } from "./account-forms";
const render = async (changed?: string) => renderToStaticMarkup(await AccountPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ changed }) }));
const button = (html: string, label: string, type?: string) => [...html.matchAll(/<button\b[\s\S]*?<\/button>/g)].map(match => match[0]).find(markup => markup.includes(label) && (!type || markup.includes(type)))!;
beforeEach(() => { vi.clearAllMocks(); m.account.mockResolvedValue({ accountId: "a1", email: "a@example.test" }); m.methods.mockResolvedValue({ google: true }); });
test("account has sign-in methods, changes, session controls and support deletion", async () => {
  const html = await render("1"); for (const copy of ["Signed in as", "a@example.test", "Sign-in methods", "Email code", "Always available", "Google", "Disconnect Google", "Email code remains available as a backup.", "Change sign-in email", "Send code", "Sign out", "Sign out of all devices", "To delete your account, please contact Neffi support.", "Your sign-in email has been changed."]) expect(html).toContain(copy);
  expect(html).toContain('href="/support?topic=recovery"');
});
test("unlinked account offers Connect Google", async () => { m.methods.mockResolvedValue({ google: false }); const html = await render(); expect(html).toContain("Connect Google"); expect(html).not.toContain("Disconnect Google"); });

test("Account form controls submit rather than silently doing nothing", async () => {
  const html = await render();
  for (const label of ["Send code", "Sign out", "Sign out of all devices"]) {
    expect(button(html, label)).toContain('type="submit"');
  }
});

test("Google disconnect trigger requires confirmation and does not immediately call unlink action", () => {
  const actionMock = vi.fn();
  vi.mocked(useActionState).mockReturnValueOnce([undefined, actionMock, false]);
  const html = renderToStaticMarkup(<RemoveGoogleForm />);
  expect(actionMock).not.toHaveBeenCalled();
  expect(html).toContain("Disconnect Google?");
  expect(html).toContain("Google will be removed as a sign-in method for your Neffi account.");
  expect(html).toContain("You can still sign in using an email verification code, and you can reconnect Google later.");
  expect(button(html, "Cancel")).toContain('type="button"');
  expect(button(html, "Disconnect Google", 'type="submit"')).toContain("bg-destructive");
});

test("Google disconnect pending state shows Disconnecting and disables actions to prevent duplicate submission", () => {
  vi.mocked(useActionState).mockReturnValueOnce([undefined, vi.fn(), true]);
  const html = renderToStaticMarkup(<RemoveGoogleForm />);
  expect(html).toContain("Disconnecting…");
  expect(html.match(/<button\b[^>]*disabled=""[^>]*>Cancel<\/button>/)).not.toBeNull();
  expect(html.match(/<button\b[^>]*disabled=""[^>]*>[\s\S]*Disconnecting…[\s\S]*<\/button>/)).not.toBeNull();
});

test("Google disconnect failure retains dialog with concise safe error and allows retry", () => {
  vi.mocked(useActionState).mockReturnValueOnce([{ error: "Google couldn't be disconnected. Please try again." }, vi.fn(), false]);
  const html = renderToStaticMarkup(<RemoveGoogleForm />);
  expect(html).toContain("Google couldn&#x27;t be disconnected. Please try again.");
  expect(html).toContain("Disconnect Google?");
  expect(button(html, "Disconnect Google", 'type="submit"')).toContain('type="submit"');
});

test("email confirmation submits while switching addresses stays a local action", () => {
  vi.mocked(useActionState).mockReturnValueOnce([{ step: "code", email: "new@example.test" }, vi.fn(), false]).mockReturnValueOnce([undefined, vi.fn(), false]);
  const html = renderToStaticMarkup(<ChangeEmailForm />);
  expect(button(html, "Change email")).toContain('type="submit"');
  expect(button(html, "Use a different address")).toContain('type="button"');
});

test.each(["request", "confirmation"])("stale %s shows an actionable sign-in-again path", step => {
  vi.mocked(useActionState)
    .mockReturnValueOnce([step === "request" ? { stale: true, error: "Sign in again" } : { step: "code", email: "new@example.test" }, vi.fn(), false])
    .mockReturnValueOnce([step === "confirmation" ? { stale: true, error: "Sign in again" } : undefined, vi.fn(), false]);
  const html = renderToStaticMarkup(<ChangeEmailForm />);
  expect(html).toContain('href="/sign-in?next=/app/account"');
  expect(html).toContain("Other devices will be signed out after your email changes.");
});

test("a completed change with revoke failure cannot resubmit the consumed code", () => {
  vi.mocked(useActionState)
    .mockReturnValueOnce([{ step: "code", email: "new@example.test" }, vi.fn(), false])
    .mockReturnValueOnce([{ changed: true, error: "Your email changed. Use Sign out everywhere below." }, vi.fn(), false]);
  const html = renderToStaticMarkup(<ChangeEmailForm />);
  expect(html).toContain("Your email changed");
  expect(html).not.toContain('name="code"');
});
