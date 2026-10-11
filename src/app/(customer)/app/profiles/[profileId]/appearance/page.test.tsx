import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { ACCENTS } from "@/modules/profiles/rules";
const m = vi.hoisted(() => ({ account: vi.fn(), profile: vi.fn() }));
vi.mock("@/auth/access", () => ({ requireAccount: m.account }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/config/env", () => ({ env: { cloudinaryCloudName: "demo" } }));
vi.mock("@/modules/profiles/profiles", () => ({ getOwnedProfile: m.profile }));
vi.mock("../actions", () => ({ updateAppearanceAction: vi.fn() }));
vi.mock("../image-upload", async importOriginal => ({ ...await importOriginal<typeof import("../image-upload")>(), ImageUpload: () => <button>Upload image</button> }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import AppearancePage from "./page";
const render = async () => renderToStaticMarkup(await AppearancePage({ params: Promise.resolve({ profileId: "p1" }), searchParams: Promise.resolve({}) }));
test("appearance shows named swatches, current choice, photo/logo and image upload", async () => {
  m.account.mockResolvedValue({ accountId: "a1" });
  m.profile.mockResolvedValue({ id: "p1", fullName: "Ana", accentColor: "#1F5FAE", imageIsLogo: false, imageAssetId: "a/b" });
  const html = await render();
  expect(html.match(/name="accentColor"/g)).toHaveLength(8);
  for (const accent of ACCENTS) { expect(html).toContain(accent.name); expect(html).toContain(`value="${accent.hex}"`); }
  expect(html).toMatch(/checked=""[^>]*value="#1F5FAE"/);
  for (const copy of ["Show my image as", "Photo", "Logo", "Upload image"]) expect(html).toContain(copy);
  expect(html).toContain("https://res.cloudinary.com/demo/image/upload/c_fill,g_face,w_256,h_256,f_auto,q_auto/a/b");
});
test("unowned appearance is not found", async () => {
  m.profile.mockResolvedValue(null); await expect(render()).rejects.toThrow("NOT_FOUND");
});
