import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/cards/resolve", () => ({ resolvePublicExperience: m.resolve }));
vi.mock("../cached-view", () => ({ cachedSceneView: "cached" }));
import { GET } from "./route";

const identity = { fullName: "Ana Cruz", initials: "AC", headline: null, company: null, bio: null, phone: "+639171234567", email: "ana@e.test", website: null, location: null, accent: "#0C0C0D", onAccent: "#FFFFFF", image: null };
const published = (saveContact: boolean, visible = true) => ({ status: "published", cardId: "c1", ownerAccountId: "a1", profileId: "p1", view: { identity, scene: { id: "s1", name: "Main" }, blocks: visible ? [{ id: "b", type: "contact", saveContact, phone: identity.phone, email: identity.email, website: null, location: null }] : [] } });
const call = () => GET(new Request("http://localhost:3000/c/TOKEN/contact"), { params: Promise.resolve({ token: "TOKEN" }) });
beforeEach(() => vi.resetAllMocks());

test("serves a private, non-indexed vCard attachment when the shown scene offers Save contact", async () => {
  m.resolve.mockResolvedValue(published(true));
  const response = await call();
  expect(response.status).toBe(200);
  expect(m.resolve).toHaveBeenCalledWith({}, "TOKEN", "cached");
  expect(response.headers.get("content-type")).toBe("text/vcard; charset=utf-8");
  expect(response.headers.get("content-disposition")).toBe('attachment; filename="Ana-Cruz.vcf"');
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await response.text()).toContain("FN:Ana Cruz");
});
test.each([
  ["an unavailable card", { status: "unavailable", cardId: "c1", ownerAccountId: "a1" }],
  ["a scene without Save contact", published(false)],
  ["a scene without a contact block", published(true, false)],
])("answers the same private 404 for %s", async (_name, experience) => {
  m.resolve.mockResolvedValue(experience);
  const response = await call();
  expect(response.status).toBe(404);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.text()).toBe("Not found");
});
