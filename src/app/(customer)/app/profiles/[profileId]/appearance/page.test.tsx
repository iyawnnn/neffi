import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import { ACCENTS } from "@/modules/profiles/appearance-options";
import { profileFixture, coverFixture } from "@/dev/profile-fixture";
const m = vi.hoisted(() => ({ account: vi.fn(), profile: vi.fn(), view: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.account }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/config/env", () => ({ env: { cloudinaryCloudName: "synthetic" } }));
vi.mock("@/modules/profiles/profiles", () => ({ getOwnedProfile: m.profile }));
vi.mock("@/modules/profiles/view", () => ({ loadOwnerSceneView: m.view }));
vi.mock("../actions", () => ({ updateAppearanceAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), notFound: () => { throw new Error("NOT_FOUND"); } }));
import AppearancePage from "./page";
const render = async () => renderToStaticMarkup(await AppearancePage({ params: Promise.resolve({ profileId: "p1" }), searchParams: Promise.resolve({}) }));
beforeEach(() => {
  vi.clearAllMocks();
  m.account.mockResolvedValue({ accountId: "a1" }); m.profile.mockResolvedValue({ id: "p1", accentColor: "#1F5FAE" });
  const view = structuredClone(profileFixture);
  view.appearance = { layout: "showcase", mode: "dark", accent: "#1F5FAE", cover: coverFixture };
  m.view.mockResolvedValue(view);
});
test("owned appearance loads canonical saved view and exposes layout/mode/accent with real previews", async () => {
  const html = await render();
  expect(m.account).toHaveBeenCalledWith("/app");
  expect(m.profile).toHaveBeenCalledWith({}, "a1", "p1");
  expect(m.view).toHaveBeenCalledWith({}, { accountId: "a1", profileId: "p1" });
  expect(html.match(/name="layout"/g)).toHaveLength(3);
  expect(html.match(/name="colorMode"/g)).toHaveLength(2);
  expect(html.match(/name="accentColor"/g)).toHaveLength(8);
  for (const accent of ACCENTS) { expect(html).toContain(accent.name); expect(html).toContain(`value="${accent.hex}"`); }
  expect(html).toMatch(/checked=""[^>]*value="#1F5FAE"/);
  for (const copy of ["Live profile preview", "Preview changes", "Cancel", "Save changes", "pf-showcase-cover"]) expect(html).toContain(copy);
  for (const copy of ["Recommended", "Goal", "Change image"]) expect(html).not.toContain(copy);
  expect(html).toContain('type="file"');
});
test("unowned appearance is not found before loading preview data", async () => {
  m.profile.mockResolvedValue(null); await expect(render()).rejects.toThrow("NOT_FOUND");
  expect(m.view).not.toHaveBeenCalled();
});

test("owned cover source metadata reaches the editor separately from public delivery data", async () => {
  m.profile.mockResolvedValue({ id: "p1", accentColor: "#1F5FAE", coverAssetId: "neffi/profiles/p1/cover/test", coverWidth: 1200, coverHeight: 400, coverCropX: 30, coverCropY: 10, coverCropWidth: 900 });
  const html = await render();
  expect(html).toContain("https://res.cloudinary.com/synthetic/image/upload/f_auto,q_auto/neffi/profiles/p1/cover/test");
  for (const copy of ["Reposition", "Replace", "Remove cover"]) expect(html).toContain(copy);
  expect(html).toContain("pf-showcase-cover");
});
test("missing owner view fails closed", async () => {
  m.view.mockResolvedValue(null); await expect(render()).rejects.toThrow("NOT_FOUND");
});

test("legacy stored accent is unselected despite the canonical renderer's Ink fallback", async () => {
  m.profile.mockResolvedValue({ id: "p1", accentColor: "#2f6fed" });
  m.view.mockResolvedValue(profileFixture);
  const html = await render();
  expect(html).not.toMatch(/name="accentColor"[^>]*checked/);
  expect(html).toContain("Choose an accent to save your changes.");
});
