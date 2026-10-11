import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ requireAccount: vi.fn(), ownedProfiles: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.requireAccount }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/profiles/profiles", () => ({ ownedProfiles: m.ownedProfiles }));
import ProfilesPage from "./page";
test("lists owned profile names and status words without a new-profile button", async () => {
  m.requireAccount.mockResolvedValue({ accountId: "a1" });
  m.ownedProfiles.mockResolvedValue([{ id: "p1", fullName: "Ana", status: "draft" }, { id: "p2", fullName: null, status: "published" }, { id: "p3", fullName: "Ben", status: "unpublished" }]);
  const html = renderToStaticMarkup(await ProfilesPage());
  for (const text of ["Ana", "Untitled profile", "Ben", "Draft", "Published", "Unpublished"]) expect(html).toContain(text);
  for (const id of ["p1", "p2", "p3"]) expect(html).toContain(`href="/app/profiles/${id}"`);
  expect(html).not.toContain("New profile");
  expect(m.ownedProfiles).toHaveBeenCalledWith({}, "a1");
});
