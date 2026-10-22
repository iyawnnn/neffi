import { afterEach, expect, test, vi } from "vitest";
import { checkImage, coverUrls, destroyImage, getImage, imageUrl, isProfileCoverId, isProfileImageId, sign, signImageUpload } from "./cloudinary";

const CONFIG = { cloudName: "demo", apiKey: "123", apiSecret: "abcd" };
const PROFILE = "3f2b8f64-5717-4562-b3fc-2c963f66afa6";
afterEach(() => vi.unstubAllGlobals());

test("cover uploads reuse the signed image limits with disjoint namespaces", () => {
  const ticket = signImageUpload(CONFIG, { profileId: PROFILE, kind: "cover" });
  expect(ticket.fields).toMatchObject({ asset_folder: `neffi/profiles/${PROFILE}/cover`, allowed_formats: "jpg,png,webp,heic", transformation: "c_limit,h_2048,w_2048" });
  const { signature, api_key, ...params } = ticket.fields;
  expect(api_key).toBe(CONFIG.apiKey);
  expect(signature).toBe(sign(params, CONFIG.apiSecret));
  expect(isProfileCoverId(PROFILE, params.public_id)).toBe(true);
  expect(isProfileImageId(PROFILE, params.public_id)).toBe(false);
  const photo = signImageUpload(CONFIG, { profileId: PROFILE, kind: "image" });
  expect(isProfileImageId(PROFILE, photo.fields.public_id)).toBe(true);
  expect(isProfileCoverId(PROFILE, photo.fields.public_id)).toBe(false);
  for (const id of [params.public_id.replace(PROFILE, "other"), `${params.public_id}/extra`, `neffi/profiles/${PROFILE}/cover/../x`, `neffi/profiles/${PROFILE}/cover/${"-".repeat(36)}`]) expect(isProfileCoverId(PROFILE, id)).toBe(false);
});

test("cover delivery crops source pixels before fixed limit widths and optimization", () => {
  const root = "https://res.cloudinary.com/demo/image/upload/c_crop,x_12,y_34,w_601,h_200";
  const url = (width: number) => `${root}/c_limit,w_${width}/f_auto,q_auto/a/b`;
  expect(coverUrls("demo", "a/b", { x: 12, y: 34, width: 601 })).toEqual({ src: url(1080), srcSet: [640, 1080, 1600].map(width => `${url(width)} ${width}w`).join(", ") });
});

test("signature matches Cloudinary's published example", () => {
  expect(sign({ eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: 1315060510 }, "abcd")).toBe(
    "bfd09f95f331f558cbd1320e67aa8d488770583e",
  );
});

test("upload tickets are signed for one profile-scoped id, restricted formats and a size cap, without the secret", () => {
  const ticket = signImageUpload(CONFIG, { profileId: PROFILE, now: new Date("2026-10-11T00:00:00Z") });
  expect(ticket.url).toBe("https://api.cloudinary.com/v1_1/demo/image/upload");
  expect(ticket.fields).toMatchObject({ api_key: "123", allowed_formats: "jpg,png,webp,heic", transformation: "c_limit,h_2048,w_2048", timestamp: "1791676800" });
  expect(isProfileImageId(PROFILE, ticket.fields.public_id)).toBe(true);
  const { signature, api_key: _key, ...signed } = ticket.fields;
  expect(signature).toBe(sign(signed, "abcd"));
  expect(JSON.stringify(ticket)).not.toContain("abcd");
});

test("profile image ids cannot be borrowed from another profile or path", () => {
  expect(isProfileImageId(PROFILE, `neffi/profiles/${PROFILE}/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`)).toBe(true);
  for (const id of [`neffi/profiles/${PROFILE}/../x`, `neffi/profiles/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`, "sample"]) expect(isProfileImageId(PROFILE, id)).toBe(false);
});

test("Dynamic Folders placement is profile-scoped and signed without changing the public id", () => {
  const ticket = signImageUpload(CONFIG, { profileId: PROFILE });
  expect(ticket.fields.asset_folder).toBe(`neffi/profiles/${PROFILE}`);
  expect(ticket.fields.public_id).toMatch(new RegExp(`^neffi/profiles/${PROFILE}/[0-9a-f-]{36}$`));
  expect(isProfileImageId(PROFILE, ticket.fields.public_id)).toBe(true);
  const { signature, api_key, ...params } = ticket.fields;
  expect(api_key).toBe(CONFIG.apiKey);
  expect(signature).toBe(sign(params, CONFIG.apiSecret));
  expect(signature).not.toBe(sign({ ...params, asset_folder: "another-folder" }, CONFIG.apiSecret));
  expect(params).not.toHaveProperty("folder");
  expect(params).not.toHaveProperty("public_id_prefix");
  expect(params).not.toHaveProperty("use_asset_folder_as_public_id_prefix");
});

test("uploaded images must be small, raster and at most 2048px", () => {
  expect(checkImage({ bytes: 1_000_000, width: 800, height: 800, format: "jpg" })).toBe(true);
  for (const bad of [{ bytes: 5_000_001 }, { width: 2049 }, { format: "svg" }, { format: "gif" }]) {
    expect(checkImage({ bytes: 1, width: 1, height: 1, format: "png", ...bad })).toBe(false);
  }
});

test("getImage uses basic auth and returns only size facts; 404 is null", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ bytes: 10, width: 2, height: 3, format: "png", secure_url: "x" })).mockResolvedValueOnce(new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await getImage(CONFIG, "a/b")).toEqual({ bytes: 10, width: 2, height: 3, format: "png" });
  expect(fetchMock.mock.calls[0][0]).toBe("https://api.cloudinary.com/v1_1/demo/resources/image/upload/a/b");
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Basic ${btoa("123:abcd")}`);
  expect(await getImage(CONFIG, "a/c")).toBeNull();
});

test("destroyImage posts a signed request and fails opaquely", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(destroyImage(CONFIG, "a/b")).rejects.toThrow("Media delete failed");
  const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
  expect(body.get("public_id")).toBe("a/b");
  expect(body.get("signature")).toMatch(/^[0-9a-f]{40}$/);
});

test("delivery uses one of two fixed, optimized transformations", () => {
  expect(imageUrl("demo", "a/b", false)).toBe("https://res.cloudinary.com/demo/image/upload/c_fill,g_face,w_256,h_256,f_auto,q_auto/a/b");
  expect(imageUrl("demo", "a/b", true)).toBe("https://res.cloudinary.com/demo/image/upload/c_fit,w_256,h_256,f_auto,q_auto/a/b");
});
