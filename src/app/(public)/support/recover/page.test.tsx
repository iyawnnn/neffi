import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("./actions", () => ({ completeRecoveryAction: vi.fn() }));
import Page, { metadata } from "./page";
import { RECOVERY_INSTRUCTION } from "@/modules/support/domain";
test("public recovery is noindex and accepts only inbox/code proof with early-sign-in guidance", async () => {
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain('name="email"');
  expect(html).toContain('name="code"');
  expect(html).toContain("Do not sign in");
  expect(html).not.toContain('name="accountId"');
  expect(metadata.robots).toMatchObject({ index: false, follow: false });
});

test("renders floating public header, 3-step progress, and contact support link", async () => {
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain('href="/support"');
  expect(html).toContain("Support");
  expect(html).toContain("nav-arrow");
  expect(html).toContain("Verified by support");
  expect(html).toContain("Enter recovery details");
  expect(html).toContain("Access restored");
  expect(html).toContain("Complete recovery");
  expect(html).toContain("Haven’t received a recovery code?");
  expect(html).toContain("Contact support");
  expect(html).toContain(RECOVERY_INSTRUCTION);
  expect(html).toContain("the recovery code emailed to your new address after Neffi support approved your request.");
  expect(html).toContain("It expires after 24 hours.");
  expect(html).toMatch(/aria-current="step"/);
  expect(html).toMatch(/bg-brand text-white[^>]*>02</);
  expect(html).not.toContain("bg-brand/10 text-brand border border-brand/25");
  const cta = html.match(/<button[^>]*>[\s\S]*?Complete recovery[\s\S]*?<\/button>/)?.[0];
  expect(cta).toContain("bg-action text-white");
  expect(cta).not.toContain("bg-primary");
});
