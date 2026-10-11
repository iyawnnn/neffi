// Test-only harness: the real auth options on a fresh PGlite database, a capturing mailer and a mocked Google
// token endpoint. Requests go through `auth.handler`, so origin checks, rate limits and hooks all run.
import { betterAuth } from "better-auth/minimal";
import { vi } from "vitest";
import { createTestDb } from "@/db/testing";
import { authOptions } from "./options";

export const TEST_BASE_URL = "http://localhost:3000";
export const TEST_SECRET = "test-only-secret-not-used-anywhere-0123456789";

export type GoogleProfile = { sub: string; email: string; email_verified: boolean; name?: string; picture?: string };

let ipCounter = 0;
const nextIp = () => `10.${(++ipCounter >> 8) & 255}.${ipCounter & 255}.1`;

const base64Url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

// decodeJwt only reads the payload on the code-flow path, so an unsigned token is enough for tests.
export function fakeGoogleIdToken(profile: GoogleProfile) {
  return `${base64Url({ alg: "none", typ: "JWT" })}.${base64Url({ iss: "https://accounts.google.com", aud: "test", ...profile })}.sig`;
}

export async function createTestAuth({ baseURL = TEST_BASE_URL }: { baseURL?: string } = {}) {
  const db = await createTestDb();
  const sent: { email: string; code: string; type: string }[] = [];
  const auth = betterAuth(
    authOptions({
      db,
      secret: TEST_SECRET,
      baseURL,
      google: { clientId: "test-google-client-id", clientSecret: "test-google-client-secret" },
      sendAuthCode: async (message) => {
        sent.push(message);
      },
    }),
  );
  return { auth, db, sent, baseURL, client: () => createClient(auth, baseURL) };
}
export type TestAuth = Awaited<ReturnType<typeof createTestAuth>>;

type CallOptions = { body?: unknown; ip?: string; origin?: string | null; headers?: Record<string, string> };

// A tiny browser: keeps a cookie jar and never follows redirects, so tests can read Location headers.
export function createClient(auth: { handler: (request: Request) => Promise<Response> }, baseURL: string) {
  const jar = new Map<string, string>();
  const ip = nextIp();

  async function call(method: string, path: string, options: CallOptions = {}) {
    const headers = new Headers({ "x-forwarded-for": options.ip ?? ip, ...options.headers });
    if (options.origin !== null) headers.set("origin", options.origin ?? baseURL);
    if (options.body !== undefined) headers.set("content-type", "application/json");
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    if (cookie && !headers.has("cookie")) headers.set("cookie", cookie);
    const response = await auth.handler(
      new Request(`${baseURL}/api/auth${path}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        redirect: "manual",
      }),
    );
    for (const setCookie of response.headers.getSetCookie()) {
      const [pair] = setCookie.split(";");
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (value === "" || /max-age=0/i.test(setCookie)) jar.delete(name);
      else jar.set(name, value);
    }
    return response;
  }

  return {
    jar,
    get: (path: string, options?: CallOptions) => call("GET", path, options),
    post: (path: string, options?: CallOptions) => call("POST", path, options),
    call,
    cookieHeader: () => [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
    hasSession: () => [...jar.keys()].some((name) => name.endsWith("better-auth.session_token")),
    async json(response: Response) {
      return (await response.clone().json()) as Record<string, unknown>;
    },
  };
}
export type TestClient = ReturnType<typeof createClient>;

// Email OTP end to end: request a code, read it from the capturing mailer, sign in with it.
export async function signInWithEmail(test: TestAuth, client: TestClient, email: string) {
  const before = test.sent.length;
  const send = await client.post("/email-otp/send-verification-otp", { body: { email, type: "sign-in" } });
  if (send.status !== 200) throw new Error(`send failed: ${send.status}`);
  const message = test.sent[before];
  const response = await client.post("/sign-in/email-otp", { body: { email, otp: message.code } });
  return { response, code: message.code };
}

// Google code flow: authorize -> (mocked) token exchange -> callback. `path` is /sign-in/social or /link-social.
export async function googleFlow(
  client: TestClient,
  profile: GoogleProfile,
  { path = "/sign-in/social", errorCallbackURL = "/sign-in" }: { path?: string; errorCallbackURL?: string } = {},
) {
  const start = await client.post(path, {
    body: { provider: "google", callbackURL: "/app", errorCallbackURL, newUserCallbackURL: "/app" },
  });
  if (start.status !== 200) return { start, callback: start };
  const { url } = (await client.json(start)) as { url: string };
  const state = new URL(url).searchParams.get("state");

  const realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (target.startsWith("https://oauth2.googleapis.com/token")) {
      return new Response(
        JSON.stringify({
          access_token: "synthetic-access-token",
          refresh_token: "synthetic-refresh-token",
          id_token: fakeGoogleIdToken(profile),
          expires_in: 3600,
          scope: "openid email profile",
          token_type: "Bearer",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return realFetch(input, init);
  });
  try {
    const callback = await client.get(`/callback/google?code=synthetic-code&state=${state}`, { origin: null });
    return { start, callback, url };
  } finally {
    vi.unstubAllGlobals();
  }
}
