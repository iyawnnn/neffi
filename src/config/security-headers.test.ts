import { afterEach, expect, test, vi } from "vitest";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";
import { imageUrl, signImageUpload } from "@/integrations/media/cloudinary";
import { securityHeaders } from "./security-headers";

vi.mock("@sentry/nextjs/config", () => ({ withSentryConfig: (config: unknown) => config }));
import nextConfig from "../../next.config";
afterEach(() => vi.unstubAllEnvs());

const policy = (dev = false, sentryDsn?: string) => securityHeaders({ dev, sentryDsn })[0].value;

test("production policy is the exact static enforced policy, with nosniff", () => {
  expect(securityHeaders({ dev: false })).toEqual([
    { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://res.cloudinary.com; font-src 'self'; connect-src 'self' https://api.cloudinary.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'" },
    { key: "X-Content-Type-Options", value: "nosniff" },
  ]);
  expect(policy()).not.toMatch(/unsafe-eval|wss?:|\*/);
  expect(policy(true)).toContain("'unsafe-eval'");
});

test("only the configured Sentry origin is allowed, without its key or path", () => {
  const withDsn = policy(false, "https://public-key@ingest.example.test/123");
  expect(withDsn).toContain("connect-src 'self' https://api.cloudinary.com https://ingest.example.test;");
  expect(withDsn).not.toMatch(/public-key|123|\*/);
  expect(policy()).not.toContain("ingest.example.test");
});

test("Next phase alone controls dev allowances even with preset NODE_ENV", async () => {
  vi.stubEnv("NODE_ENV", "development");
  for (const phase of [PHASE_PRODUCTION_BUILD, PHASE_DEVELOPMENT_SERVER]) {
    const config = nextConfig(phase);
    const headers = await config.headers!();
    expect(headers).toHaveLength(1);
    expect(headers[0].source).toBe("/:path*");
    const csp = headers[0].headers.find(header => header.key === "Content-Security-Policy")!.value;
    expect(csp.includes("'unsafe-eval'")).toBe(phase === PHASE_DEVELOPMENT_SERVER);
  }
});

test("the actual Cloudinary upload and delivery origins are covered", () => {
  const ticket = signImageUpload({ cloudName: "demo", apiKey: "synthetic-key", apiSecret: "synthetic-secret" }, { profileId: "synthetic-profile" });
  const directives = new Map(policy().split("; ").map(value => { const [name, ...sources] = value.split(" "); return [name, sources]; }));
  expect(directives.get("connect-src")).toContain(new URL(ticket.url).origin);
  expect(directives.get("img-src")).toContain(new URL(imageUrl("demo", "synthetic-image", false)).origin);
});
