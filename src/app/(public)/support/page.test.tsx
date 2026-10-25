import { renderToReadableStream } from "react-dom/server";
import { expect, test, vi } from "vitest";
const getViewer = vi.hoisted(() => vi.fn());
const calls = vi.hoisted(() => [] as string[]);
vi.mock("next/server", () => ({ connection: vi.fn(async () => { calls.push("connection"); }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/support" }));
vi.mock("@/auth/access", () => ({ getViewer }));
vi.mock("./actions", () => ({ submitSupportAction: vi.fn() }));
import Page from "./page";

test("support streams a usable signed-out form with privacy and recovery guidance", async () => {
  getViewer.mockResolvedValue(null);
  const stream = await renderToReadableStream(<Page params={Promise.resolve({})} searchParams={Promise.resolve({ topic: "activation" })} />);
  await stream.allReady;
  const html = await new Response(stream).text();
  expect(html).toContain('name="email"');
  expect(html).toContain('name="message"');
  expect(html).toContain('value="activation" selected');
  expect(html).toContain("unverified");
  expect(html).not.toContain("recovery link");
  expect(html).not.toContain("Do not sign in with the new address");
  expect(html).toContain("Need help with your sign-in email?");
  expect(html).toContain("Still have access to your current email?");
  expect(html).toContain("Lost access to your current email?");
  expect(html).toContain('href="/sign-in?next=/app/account"');
  expect(html).toContain('href="/support?topic=recovery#support-request"');
  expect(html).toContain('href="/support/recover"');
  expect(html).toContain("Already have a recovery code?");
  expect(html).toContain("Complete recovery");
});

test("the per-visitor client key is generated at request time, never while prerendering", async () => {
  getViewer.mockResolvedValue(null);
  calls.length = 0;
  const uuid = vi.spyOn(crypto, "randomUUID").mockImplementation(() => { calls.push("randomUUID"); return "00000000-0000-4000-8000-000000000000"; });
  try {
    const stream = await renderToReadableStream(<Page params={Promise.resolve({})} searchParams={Promise.resolve({})} />);
    await stream.allReady;
    // Next.js 16 logs blocking-prerender-crypto on every request unless connection() precedes the random value.
    expect(calls.indexOf("connection")).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf("connection")).toBeLessThan(calls.indexOf("randomUUID"));
  } finally {
    uuid.mockRestore();
  }
});

test("lost-inbox action selects the recovery support topic", async () => {
  getViewer.mockResolvedValue(null);
  const stream = await renderToReadableStream(<Page params={Promise.resolve({})} searchParams={Promise.resolve({ topic: "recovery" })} />);
  await stream.allReady;
  const html = await new Response(stream).text();
  expect(html).toContain('value="recovery" selected');
  expect(html).toContain('id="support-request"');
});
test("signed-in form uses verified contact and drops malformed card identifiers", async () => {
  getViewer.mockResolvedValue({ email: "verified@example.test" });
  const stream = await renderToReadableStream(<Page params={Promise.resolve({})} searchParams={Promise.resolve({ topic: "bad", cardId: "bad" })} />);
  await stream.allReady;
  const html = await new Response(stream).text();
  expect(html).toContain("verified@example.test");
  expect(html).not.toContain('name="cardId"');
  expect(html).toContain('value="other" selected');
});
