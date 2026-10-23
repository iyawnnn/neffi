import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST } from "./route";

beforeEach(() => { vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("VERCEL_ENV", ""); });
afterEach(() => vi.unstubAllEnvs());

test("builds a canonical synthetic view from a locally added link", async () => {
  const response = await POST(new Request("http://localhost/dev/setup-preview/items", { method: "POST", body: JSON.stringify({ blocks: [], operation: "add", fields: { type: "link", kind: "custom", label: "Resume", url: "ana.example/resume" } }) }));
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.blocks).toEqual([expect.objectContaining({ type: "link", content: { kind: "custom", label: "Resume", url: "https://ana.example/resume" } })]);
  expect(result.view.blocks).toEqual([expect.objectContaining({ type: "link", label: "Resume", url: "https://ana.example/resume" })]);
});
test("updates and removes synthetic items without persistence", async () => {
  const blocks = [{ id: "b1", type: "link", visible: true, content: { kind: "custom", label: "Old", url: "https://old.example/" }, summary: "Old" }];
  const update = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ blocks, operation: "update", blockId: "b1", fields: { type: "link", kind: "custom", label: "New", url: "new.example" } }) }));
  const changed = await update.json();
  expect(changed.blocks[0].content).toEqual({ kind: "custom", label: "New", url: "https://new.example/" });
  const remove = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ blocks: changed.blocks, operation: "remove", blockId: "b1", fields: {} }) }));
  expect((await remove.json()).blocks).toEqual([]);
});
test.each([["production", ""], ["test", ""], ["development", "preview"]])("refuses %s/%s", async (node, vercel) => {
  vi.stubEnv("NODE_ENV", node); vi.stubEnv("VERCEL_ENV", vercel);
  expect((await POST(new Request("http://localhost", { method: "POST" }))).status).toBe(404);
});
