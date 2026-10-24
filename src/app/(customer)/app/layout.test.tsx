import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ requireAccount: vi.fn(), name: vi.fn(), unread: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/accounts/directory", () => ({ accountDisplayName: m.name }));
vi.mock("@/modules/forms/submissions", () => ({ unreadCount: m.unread }));
vi.mock("@/components/session-keep-alive", () => ({ SessionKeepAlive: () => <span data-session-keep-alive="" /> }));
vi.mock("@/auth/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));
import Layout from "./layout";

beforeEach(() => {
  vi.clearAllMocks();
  m.requireAccount.mockResolvedValue({ accountId: "test-account", email: "maintainer@example.test" });
  m.name.mockResolvedValue("Maintainer");
  m.unread.mockResolvedValue(2);
});

test("authenticated layout retains account tools, responsive navigation, content and session maintenance without a public footer", async () => {
  const html = renderToStaticMarkup(await Layout({ params: Promise.resolve({}), children: <main>Private account content</main> }));
  expect(m.requireAccount).toHaveBeenCalledWith("/app");
  expect(html).toContain("Private account content");
  expect(html).toContain('aria-label="Main"');
  expect(html).toContain('aria-label="Inbox, 2 unread"');
  expect(html).toContain('aria-label="Account menu for Maintainer"');
  expect(html).toContain("data-session-keep-alive");
  expect(html).not.toContain("marketing-footer");
});

test("the existing auth gate runs before reading account chrome data", async () => {
  m.requireAccount.mockRejectedValue(new Error("auth redirect"));
  await expect(Layout({ params: Promise.resolve({}), children: <main>Private</main> })).rejects.toThrow("auth redirect");
  expect(m.name).not.toHaveBeenCalled();
  expect(m.unread).not.toHaveBeenCalled();
});
