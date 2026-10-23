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

test("renders recovery progress and contact support within the shared public shell", async () => {
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain('href="/support"');
  expect(html).toContain("nav-arrow");
  expect(html).toContain("Verified by support");
  expect(html).toContain("Your recovery request has been approved.");
  expect(html).toContain("Enter your recovery details");
  expect(html).toContain("Use the new email and code sent by Neffi support.");
  expect(html).toContain("Access your account");
  expect(html).toContain("After recovery, sign in using your new email.");
  expect(html).toContain("Recover your account");
  expect(html).toContain("Complete recovery");
  expect(html).toContain("Didn’t receive a recovery code?");
  expect(html).toContain("Contact support");
  expect(html).toContain(RECOVERY_INSTRUCTION);
  expect(html).toContain("the new email and recovery code sent after Neffi support approved your request.");
  expect(html).toContain("Sent to your new email. This code expires after 24 hours.");
  expect(html).toContain("Three incorrect attempts cancel recovery.");
  // All three steps use uniform 01, 02, 03 subtle brand-tinted markers without a connector line
  expect(html).toMatch(/01/);
  expect(html).toMatch(/02/);
  expect(html).toMatch(/03/);
  expect(html).toContain("text-brand");
  expect(html).toContain("border-brand/25");
  expect(html).not.toContain("w-px bg-border");
  expect(html).not.toContain("aria-current");
  expect(html).not.toContain("emerald");
  expect(html).not.toContain("bg-brand text-white border border-brand");
  const cta = html.match(/<button[^>]*>[\s\S]*?Complete recovery[\s\S]*?<\/button>/)?.[0];
  expect(cta).toContain("bg-action text-white");
  expect(cta).not.toContain("bg-primary");
});

test("mobile layout presents header, eyebrow, description, form, warning, and contact support without desktop timeline", async () => {
  const html = renderToStaticMarkup(await Page());
  // The 3-step timeline is contained within the desktop-only left panel (hidden md:flex)
  expect(html).toMatch(/hidden md:flex[^>]*>[^<]*<div[^>]*>[^<]*<span[^>]*>ACCOUNT RECOVERY/);
  // Mobile intro is present with flex md:hidden
  expect(html).toMatch(/flex md:hidden flex-col text-left/);
  // Mobile security warning is present below form card with md:hidden
  expect(html).toMatch(/mt-5 md:hidden/);
});
