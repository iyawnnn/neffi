import { describe, expect, test } from "vitest";
import { isOwner, ownsAccountResource, safeNext, toViewer } from "./policy";

const session = (user: object) => ({ user: { id: "a1", email: "a@example.test", emailVerified: true, role: "customer", ...user } });

describe("toViewer", () => {
  test("narrows a valid session to account, email and role", () => {
    expect(toViewer(session({ role: "owner" }))).toEqual({ accountId: "a1", email: "a@example.test", role: "owner" });
  });

  test.each([
    ["no session", null],
    ["no user", {}],
    ["unverified email", session({ emailVerified: false })],
    ["missing verification flag", session({ emailVerified: undefined })],
    ["unknown role", session({ role: "admin" })],
    ["missing role", session({ role: undefined })],
    ["non-string id", session({ id: 7 })],
    ["missing email", session({ email: undefined })],
  ])("treats %s as signed out", (_name, input) => {
    expect(toViewer(input as never)).toBeNull();
  });
});

describe("policies", () => {
  const customer = { accountId: "a1", email: "a@example.test", role: "customer" as const };
  const owner = { accountId: "o1", email: "o@example.test", role: "owner" as const };

  test("only the owner role is an owner", () => {
    expect(isOwner(owner)).toBe(true);
    expect(isOwner(customer)).toBe(false);
  });

  test("customers cannot reach another customer's resources, and owners get no implicit access either", () => {
    expect(ownsAccountResource(customer, "a1")).toBe(true);
    expect(ownsAccountResource(customer, "a2")).toBe(false);
    expect(ownsAccountResource(owner, "a1")).toBe(false);
  });
});

describe("safeNext", () => {
  test.each([
    ["/app", "/app"],
    ["/app/cards", "/app/cards"],
    ["/admin", "/admin"],
    ["/admin/orders", "/admin/orders"],
    ["/app?x=1", "/app"],
  ])("keeps %s", (raw, expected) => expect(safeNext(raw)).toBe(expected));

  test.each([
    undefined,
    null,
    "",
    42,
    "/",
    "/sign-in",
    "/application",
    "//evil.example",
    "//evil.example/app",
    "https://evil.example/app",
    "https://evil.example/admin/orders",
    "http://localhost:3000/app",
    "/\\evil.example",
    "\\\\evil.example",
    "/%2F%2Fevil.example",
    "/app/../evil",
    "/\t/evil.example",
    "javascript:alert(1)",
    "data:text/html,x",
    "app",
  ])("falls back to /app for %j", (raw) => expect(safeNext(raw)).toBe("/app"));
});
