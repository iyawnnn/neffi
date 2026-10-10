import { beforeEach, describe, expect, test, vi } from "vitest";

const getSession = vi.fn();
vi.mock("./server", () => ({ auth: { api: { getSession } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: "synthetic" }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
// React's request memoization is irrelevant here; call straight through so each test sees fresh state.
vi.mock("react", () => ({ cache: <T>(fn: T) => fn }));

const { authorize, denialResponse, getViewer, requireAccount, requireOwner } = await import("./access");

const sessionFor = (role: string, extra: object = {}) => ({
  user: { id: "acct-1", email: "a@example.test", emailVerified: true, role, ...extra },
});

beforeEach(() => getSession.mockReset());

describe("getViewer", () => {
  test("reads the session without refreshing it", async () => {
    getSession.mockResolvedValue(sessionFor("customer"));
    expect(await getViewer()).toEqual({ accountId: "acct-1", email: "a@example.test", role: "customer" });
    expect(getSession).toHaveBeenCalledWith(expect.objectContaining({ query: { disableRefresh: true } }));
  });

  test("is null without a session, with an unverified email, or with an unknown role", async () => {
    getSession.mockResolvedValueOnce(null);
    expect(await getViewer()).toBeNull();
    getSession.mockResolvedValueOnce(sessionFor("customer", { emailVerified: false }));
    expect(await getViewer()).toBeNull();
    getSession.mockResolvedValueOnce(sessionFor("superuser"));
    expect(await getViewer()).toBeNull();
  });
});

describe("page gates", () => {
  test("a visitor is sent to sign in and returns to the area they asked for", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireAccount("/app")).rejects.toThrow("REDIRECT /sign-in?next=/app");
    await expect(requireOwner()).rejects.toThrow("REDIRECT /sign-in?next=/admin");
  });

  test("a customer passes the account gate but is shown a 404 at the owner gate", async () => {
    getSession.mockResolvedValue(sessionFor("customer"));
    await expect(requireAccount("/app")).resolves.toMatchObject({ role: "customer" });
    await expect(requireOwner()).rejects.toThrow("NOT_FOUND");
  });

  test("an owner passes both gates", async () => {
    getSession.mockResolvedValue(sessionFor("owner"));
    await expect(requireAccount("/app")).resolves.toMatchObject({ role: "owner" });
    await expect(requireOwner()).resolves.toMatchObject({ role: "owner" });
  });
});

describe("authorize (route handlers and server actions)", () => {
  test("a visitor is unauthenticated (401) for any requirement", async () => {
    getSession.mockResolvedValue(null);
    for (const required of ["account", "owner"] as const) {
      expect(await authorize(required)).toEqual({ ok: false, denial: { status: 401, error: "unauthenticated" } });
    }
  });

  test("a customer may act as an account but is forbidden (403) from owner actions", async () => {
    getSession.mockResolvedValue(sessionFor("customer"));
    expect(await authorize("account")).toMatchObject({ ok: true });
    expect(await authorize("owner")).toEqual({ ok: false, denial: { status: 403, error: "forbidden" } });
  });

  test("an owner may do both", async () => {
    getSession.mockResolvedValue(sessionFor("owner"));
    expect(await authorize("owner")).toMatchObject({ ok: true, viewer: { role: "owner" } });
  });

  test("a denial becomes a JSON response with the same status and no detail", async () => {
    const response = denialResponse({ status: 403, error: "forbidden" });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden" });
  });
});
