import { expect, test, vi } from "vitest";
vi.mock("@/config/env", () => ({ env: { betterAuthSecret: "synthetic-request-signing-secret" } }));
import { createCardRequest, readCardRequest, signCardRequest } from "./request";

const route = { status: "published" as const, cardId: "c1", ownerAccountId: "a1", profileId: "p1", sceneId: "s1", version: 2 };
const owner = { accountId: "a1", email: "private@example.test", role: "customer" as const };
test("request snapshot contains no account identity and authorizes only the Card owner", () => {
  expect(createCardRequest(route, null)).toEqual({ status: "published", profileId: "p1", sceneId: "s1", version: 2 });
  expect(createCardRequest(route, owner)).toEqual({ status: "published", profileId: "p1", sceneId: "s1", version: 2, owner: true });
  expect(JSON.stringify(createCardRequest(route, owner))).not.toMatch(/a1|private@example/);
  expect(createCardRequest(route, { ...owner, accountId: "other", role: "owner" })).toEqual(createCardRequest(route, null));
});
test("only an authorized owner can receive an unavailable management decision", () => {
  const unavailable = { status: "unavailable" as const, cardId: "c1", ownerAccountId: "a1" };
  expect(createCardRequest(unavailable, null)).toBeNull();
  expect(createCardRequest(unavailable, owner)).toEqual({ status: "unavailable", ownerCardId: "c1" });
  expect(createCardRequest({ ...unavailable, cardId: null }, owner)).toBeNull();
});
test("snapshot is authenticated, bound to the path, and rejects forged input", () => {
  const snapshot = createCardRequest(route, null)!;
  const signed = signCardRequest("TOKEN", snapshot);
  expect(readCardRequest("TOKEN", signed)).toEqual(snapshot);
  expect(readCardRequest("OTHER", signed)).toBeNull();
  expect(readCardRequest("TOKEN", signed + "x")).toBeNull();
  expect(readCardRequest("TOKEN", JSON.stringify(snapshot))).toBeNull();
  expect(readCardRequest("TOKEN", null)).toBeNull();
});
