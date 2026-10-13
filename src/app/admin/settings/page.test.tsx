import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const { requireOwner, listProducts, listOwnerAccess } = vi.hoisted(() => ({ requireOwner: vi.fn(), listProducts: vi.fn(), listOwnerAccess: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireOwner }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/modules/orders/products", () => ({ listProducts, listOwnerAccess }));
vi.mock("../inventory/forms", () => ({ ActionForm: ({ children }: { children: React.ReactNode }) => <form>{children}</form> }));
vi.mock("./actions", () => ({ saveProductAction: vi.fn() }));
import SettingsPage from "./page";
beforeEach(() => { vi.clearAllMocks(); listProducts.mockResolvedValue([]); listOwnerAccess.mockResolvedValue([{ email: "owner@example.test", role: "owner", createdAt: new Date("2026-10-13") }]); });

test("Settings has both product forms and readonly Owner Access, no future sections", async () => {
  const html = renderToStaticMarkup(await SettingsPage());
  expect(requireOwner).toHaveBeenCalledOnce();
  expect(html).toContain("Products &amp; Pricing");
  expect(html).toContain("Digital Business Card");
  expect(html).toContain("Google Review Card");
  expect(html).toContain("Owner Access");
  expect(html).toContain("owner@example.test");
  expect(html).not.toContain("Communications");
  expect(html).not.toContain('name="role"');
});

test("page denies customers before reading catalog or owners", async () => {
  requireOwner.mockRejectedValueOnce(new Error("denied"));
  await expect(SettingsPage()).rejects.toThrow("denied");
  expect(listOwnerAccess).not.toHaveBeenCalled();
  expect(listProducts).not.toHaveBeenCalled();
});
