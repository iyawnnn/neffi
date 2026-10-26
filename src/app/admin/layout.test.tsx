import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ getViewer: vi.fn(), requireOwner: vi.fn(), notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("@/auth/access", () => ({ getViewer: m.getViewer, requireOwner: m.requireOwner }));
vi.mock("next/navigation", () => ({ notFound: m.notFound, usePathname: () => "/admin" }));
vi.mock("@/auth/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("./shell", () => ({ AdminShell: ({ email, children }: { email: string; children: React.ReactNode }) => <div data-shell={email}>{children}</div> }));
import AdminLayout from "./layout";

const render = async () => renderToStaticMarkup(await AdminLayout({ params: Promise.resolve({}), children: <p>child</p> }));
beforeEach(() => vi.clearAllMocks());

test("a signed-out visitor is not redirected by the layout, so the page can preserve its exact destination", async () => {
  m.getViewer.mockResolvedValue(null);
  const html = await render();
  expect(html).toBe("<p>child</p>");
  expect(m.requireOwner).not.toHaveBeenCalled();
});

test("a signed-in customer gets a 404 from the layout", async () => {
  m.getViewer.mockResolvedValue({ accountId: "a", email: "c@example.test", role: "customer" });
  await expect(render()).rejects.toThrow("NOT_FOUND");
});

test("an OWNER gets the Admin shell", async () => {
  m.getViewer.mockResolvedValue({ accountId: "a", email: "o@example.test", role: "owner" });
  expect(await render()).toBe('<div data-shell="o@example.test"><p>child</p></div>');
});
