import { renderToReadableStream } from "react-dom/server";
import { expect, test, vi } from "vitest";
const getViewer = vi.hoisted(() => vi.fn());
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
  expect(html).toContain("Do not sign in");
  expect(html).not.toContain("recovery link");
  expect(html).toContain("I can still access my current email");
  expect(html).toContain("I no longer have access to my current email");
  expect(html).toContain('href="/sign-in?next=/app/account"');
  expect(html).toContain('href="/support?topic=recovery#support-request"');
  expect(html).toContain('href="/support/recover"');
  expect(html).toContain("Already have a recovery code?");
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
