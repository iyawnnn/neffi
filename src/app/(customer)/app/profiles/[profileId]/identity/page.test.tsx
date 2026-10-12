import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ requireAccount: vi.fn(), profile: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/profiles/profiles", () => ({ getOwnedProfile: m.profile }));
vi.mock("../actions", () => ({ publishAction: vi.fn(), createSceneAction: vi.fn(), deleteProfileAction: vi.fn(), updateIdentityAction: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import IdentityPage from "./page";
const render = async () => renderToStaticMarkup(await IdentityPage({ params: Promise.resolve({ profileId: "p1" }), searchParams: Promise.resolve({}) }));
test("identity shows all eight fields prefilled and Save", async () => {
  m.requireAccount.mockResolvedValue({ accountId: "a1" });
  m.profile.mockResolvedValue({ id: "p1", fullName: "Ana", headline: "Designer", company: "Neffi", bio: "Hello", phone: "+639171234567", email: "ana@e.test", website: "https://ana.example/", location: "Manila" });
  const html = await render();
  for (const label of ["Full name", "What you do", "Company", "Short intro", "Phone", "Email", "Website", "Location"]) expect(html).toContain(label);
  for (const value of ["Ana", "Designer", "Neffi", "Hello", "+639171234567", "ana@e.test", "https://ana.example/", "Manila"]) expect(html).toContain(value);
  expect(html).toContain(">Save<");
});
test("unowned identity is not found", async () => {
  m.profile.mockResolvedValue(null);
  await expect(render()).rejects.toThrow("NOT_FOUND");
});
