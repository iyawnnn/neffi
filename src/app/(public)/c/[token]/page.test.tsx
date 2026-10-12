import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ header: vi.fn(), load: vi.fn() }));
vi.mock("@/config/env", () => ({ env: { betterAuthSecret: "synthetic-request-signing-secret" } }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("next/headers", () => ({ headers: async () => ({ get: m.header }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/modules/profiles/view", () => ({ loadCurrentPublicSceneView: m.load }));
vi.mock("./cached-view", () => ({ cachedSceneView: "cached" }));
vi.mock("@/components/scene-view", () => ({ SceneViewPreview: ({ visitorActions }: { visitorActions: { saveContactHref: string } }) => <article data-save={visitorActions.saveContactHref}>Ana</article> }));
import CardPage, { metadata, prefetch } from "./page";
import { Unavailable } from "./unavailable";
import { signCardRequest } from "@/modules/cards/request";

const view = { identity: { fullName: "Ana" }, scene: { id: "s1", name: "Main" }, blocks: [] };
const published = { status: "published" as const, profileId: "p1", sceneId: "s1", version: 2 };
const render = async () => renderToStaticMarkup(await CardPage({ params: Promise.resolve({ token: "TOKEN" }), searchParams: Promise.resolve({}) }));
beforeEach(() => { vi.resetAllMocks(); m.header.mockReturnValue(signCardRequest("TOKEN", published)); m.load.mockResolvedValue(view); });

test("a Published card uses the authoritative request snapshot before the version-keyed loader", async () => {
  const html = await render();
  expect(m.load).toHaveBeenCalledWith({}, published, "cached");
  expect(html).toContain('data-save="/c/TOKEN/contact"');
  expect(html).not.toContain("/app/");
});
test.each([null, "forged"])("missing or forged availability decisions fail closed", async value => {
  m.header.mockReturnValue(value);
  await expect(render()).rejects.toThrow("NOT_FOUND");
  expect(m.load).not.toHaveBeenCalled();
});
test("the authorized unavailable owner gets generic copy and management only", async () => {
  m.header.mockReturnValue(signCardRequest("TOKEN", { status: "unavailable", ownerCardId: "c1" }));
  const html = await render();
  expect(html).toContain('href="/app/cards/c1"');
  expect(html).not.toContain("data-save");
  expect(m.load).not.toHaveBeenCalled();
});
test("a revision changed during content resolution cannot render stale data", async () => {
  m.load.mockResolvedValue(null);
  await expect(render()).rejects.toThrow("NOT_FOUND");
});
test("only this segment disables prefetch and its metadata carries no profile data", () => {
  expect(prefetch).toBe("force-disabled");
  expect(metadata).toEqual({ title: "Neffi", robots: { index: false, follow: false } });
});
test("unavailable copy names no reason and no internal state", () => {
  const text = renderToStaticMarkup(<Unavailable />).replace(/<[^>]+>/g, " ");
  expect(text).toContain("This Neffi isn’t available right now");
  expect(text).not.toMatch(/disabled|draft|unpublish|claim|activat|token|profile|account|owner|error|404/i);
});
