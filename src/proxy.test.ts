import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ resolve: vi.fn(), viewer: vi.fn() }));
vi.mock("@/config/env", () => ({ env: { betterAuthSecret: "synthetic-request-signing-secret" } }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/auth/access", () => ({ getViewerFromHeaders: m.viewer }));
vi.mock("@/modules/cards/resolve", () => ({ resolveCard: m.resolve }));
import { proxy } from "./proxy";
import { CARD_REQUEST_HEADER, readCardRequest } from "./modules/cards/request";
beforeEach(() => { vi.resetAllMocks(); m.viewer.mockResolvedValue(null); });
const request = () => new NextRequest("http://localhost:3000/c/TOKEN", { headers: { [CARD_REQUEST_HEADER]: "forged" } });
test("unavailable visitor response has 404 before route rendering", async () => {
  m.resolve.mockResolvedValue({ status: "unavailable", cardId: null, ownerAccountId: null });
  const response = await proxy(request());
  expect(response.status).toBe(404);
  expect(response.headers.get("x-middleware-rewrite")).toContain("/c-unavailable");
  expect(response.headers.get(CARD_REQUEST_HEADER)).toBeNull();
});
test("unavailable rewrites preserve Next navigation cache-busting parameters", async () => {
  m.resolve.mockResolvedValue({ status: "unavailable", cardId: null, ownerAccountId: null });
  const response = await proxy(new NextRequest("http://localhost:3000/c/TOKEN?_rsc=abc"));
  expect(new URL(response.headers.get("x-middleware-rewrite")!).search).toBe("?_rsc=abc");
});
test("unavailable Flight requests fail before rendering and let Next load the same document URL", async () => {
  m.resolve.mockResolvedValue({ status: "unavailable", cardId: null, ownerAccountId: null });
  const response = await proxy(new NextRequest("http://localhost:3000/c/TOKEN?_rsc=abc", { headers: { rsc: "1" } }));
  expect(response.status).toBe(404);
  expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("cache-control")).toBe("no-store");
});
test("Published requests overwrite client snapshots with a private authenticated request header", async () => {
  m.resolve.mockResolvedValue({ status: "published", cardId: "c1", ownerAccountId: "a1", profileId: "p1", sceneId: "s1", version: 2 });
  const response = await proxy(request());
  expect(response.status).toBe(200);
  const snapshot = response.headers.get(`x-middleware-request-${CARD_REQUEST_HEADER}`);
  expect(readCardRequest("TOKEN", snapshot)).toEqual({ status: "published", profileId: "p1", sceneId: "s1", version: 2 });
  expect(JSON.stringify(readCardRequest("TOKEN", snapshot))).not.toContain("a1");
  expect(response.headers.get(CARD_REQUEST_HEADER)).toBeNull();
  expect(m.resolve).toHaveBeenCalledTimes(1);
});
