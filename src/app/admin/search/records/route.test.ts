import { beforeEach, expect, test, vi } from "vitest";
const m = vi.hoisted(() => ({ authorize: vi.fn(), search: vi.fn() }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/auth/access", () => ({ authorize: m.authorize, denialResponse: ({ status, error }: { status: number; error: string }) => Response.json({ error }, { status }) }));
vi.mock("@/modules/search", () => ({ searchRecords: m.search }));
import { GET } from "./route";

beforeEach(() => { vi.resetAllMocks(); });

test("signed-out and non-owner callers get a status and never reach the search", async () => {
  m.authorize.mockResolvedValue({ ok: false, denial: { status: 401, error: "unauthenticated" } });
  expect((await GET(new Request("http://x.test/admin/search/records?q=abc"))).status).toBe(401);
  m.authorize.mockResolvedValue({ ok: false, denial: { status: 403, error: "forbidden" } });
  expect((await GET(new Request("http://x.test/admin/search/records?q=abc"))).status).toBe(403);
  expect(m.search).not.toHaveBeenCalled();
});

test("owners get capped, uncached hits", async () => {
  m.authorize.mockResolvedValue({ ok: true, viewer: {} });
  m.search.mockResolvedValue({ hits: [{ type: "order", id: "1", title: "Order 1001", subtitle: "Buyer", status: "in_progress", matched: "Order number" }], total: 1 });
  const response = await GET(new Request("http://x.test/admin/search/records?q=1001"));
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toMatchObject({ total: 1, hits: [{ title: "Order 1001" }] });
  expect(m.authorize).toHaveBeenCalledWith("owner");
  expect(m.search).toHaveBeenCalledWith({}, "1001", { perType: 4, limit: 20 });
});
