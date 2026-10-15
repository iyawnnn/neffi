import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("./actions", () => ({ completeRecoveryAction: vi.fn() }));
import Page, { metadata } from "./page";
test("public recovery is noindex and accepts only inbox/code proof with early-sign-in guidance", async () => {
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain('name="email"'); expect(html).toContain('name="code"');
  expect(html).toContain("Do not sign in"); expect(html).not.toContain('name="accountId"');
  expect(metadata.robots).toMatchObject({ index: false, follow: false });
});
