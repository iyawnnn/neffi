import { APIError, createAuthMiddleware } from "better-auth/api";
import type { BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { accounts, authIdentities, authRateLimits, authSessions, authVerifications } from "@/db/schema";
import { consumeOtpQuota, hmacHex } from "./otp-quota";

type AuthOptionsInput = {
  db: Parameters<typeof drizzleAdapter>[0];
  secret: string;
  baseURL: string;
  google: { clientId: string; clientSecret: string };
  // Delivers a one-time sign-in code. Injected so tests can capture it and production can use Resend.
  sendAuthCode: (message: { email: string; code: string }) => Promise<void>;
};

const THIRTY_DAYS = 60 * 60 * 24 * 30;
const OTP_LIFETIME_SECONDS = 300;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const keepRateLimit = (_request: Request, rule: { window: number; max: number }) => rule;

// Every HTTP route Better Auth could expose that M3 does not use is switched off. Server code can still call the
// matching `auth.api.*` function (disabledPaths only guards the HTTP router), so session reads stay available to the app.
// `/reset-password/:token` carries a parameter and cannot be listed here; the hook below handles it.
const DISABLED_PATHS = [
  "/get-session",
  "/list-accounts",
  "/error",
  "/sign-up/email",
  "/sign-in/email",
  "/verify-password",
  "/verify-email",
  "/send-verification-email",
  "/change-email",
  "/change-password",
  "/set-password",
  "/update-session",
  "/update-user",
  "/delete-user",
  "/delete-user/callback",
  "/request-password-reset",
  "/reset-password",
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
  "/unlink-account",
  "/refresh-token",
  "/get-access-token",
  "/account-info",
  "/email-otp/check-verification-otp",
  "/email-otp/verify-email",
  "/email-otp/request-password-reset",
  "/email-otp/reset-password",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
  "/forget-password/email-otp",
];

const withoutProviderTokens = <T extends object>(identity: T) => ({
  ...identity,
  accessToken: null,
  refreshToken: null,
  idToken: null,
});

const GENERIC_RATE_LIMIT_MESSAGE = "Too many requests. Please try again later.";

// Shared by the server instance and the database tests, so tests exercise the real persistence and security wiring.
export function authOptions({ db, secret, baseURL, google, sendAuthCode }: AuthOptionsInput) {
  // First match wins. Unknown paths must not create IP/path counters before Better Auth returns 404.
  const rateLimitRules = {
    "/email-otp/send-verification-otp": { window: RATE_LIMIT_WINDOW_SECONDS, max: 10 },
    "/sign-in/email-otp": { window: RATE_LIMIT_WINDOW_SECONDS, max: 10 },
    "/ok": keepRateLimit,
    "/sign-in/social": keepRateLimit,
    "/callback/google": keepRateLimit,
    "/link-social": keepRateLimit,
    "/sign-out": keepRateLimit,
    "/**": false as const,
  };
  return {
    secret,
    baseURL,
    trustedOrigins: [baseURL],
    database: drizzleAdapter(db, {
      provider: "pg",
      // Account + identity creation during a first Google sign-in must commit together.
      transaction: true,
      schema: {
        user: accounts,
        account: authIdentities,
        session: authSessions,
        verification: authVerifications,
        rateLimit: authRateLimits,
      },
    }),
    socialProviders: { google: { clientId: google.clientId, clientSecret: google.clientSecret } },
    emailAndPassword: { enabled: false },
    user: { additionalFields: { role: { type: "string", input: false, defaultValue: "customer" } } },
    account: {
      // M3 never calls Google's APIs, so provider tokens are not kept (see databaseHooks below).
      updateAccountOnSignIn: false,
      accountLinking: {
        enabled: true,
        // A new Google identity never attaches itself to an existing Account by email. Linking happens only
        // through the signed-in "Connect Google" action, and only for the Account's own email.
        disableImplicitLinking: true,
        allowDifferentEmails: false,
        trustedProviders: [],
      },
    },
    session: {
      expiresIn: THIRTY_DAYS,
      updateAge: 60 * 60 * 24,
      // No cookie cache: every read checks auth_sessions, so sign-out and revocation apply on the next request.
      cookieCache: { enabled: false },
    },
    verification: { storeIdentifier: "hashed" },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: RATE_LIMIT_WINDOW_SECONDS,
      max: 100,
      // OTP uses 10/min per IP; all other allowed paths preserve Better Auth's existing limits.
      customRules: rateLimitRules,
    },
    disabledPaths: DISABLED_PATHS,
    onAPIError: { errorURL: "/sign-in" },
    telemetry: { enabled: false },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path?.startsWith("/reset-password")) throw new APIError("NOT_FOUND", { message: "Not Found" });
        if (ctx.path !== "/email-otp/send-verification-otp") return;

        const body = (ctx.body ?? {}) as { email?: unknown; type?: unknown };
        // Only sign-in codes exist: no verification, password-reset or change-email mail can ever be triggered.
        if (body.type !== "sign-in") throw new APIError("BAD_REQUEST", { message: "Invalid request" });
        const email = typeof body.email === "string" ? body.email.toLowerCase() : "";
        // Malformed addresses are rejected by Better Auth itself; counting them would only grow the table.
        if (!z.email().safeParse(email).success) return;
        if (!(await consumeOtpQuota(db as Parameters<typeof consumeOtpQuota>[0], secret, email))) {
          throw new APIError("TOO_MANY_REQUESTS", { message: GENERIC_RATE_LIMIT_MESSAGE });
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            // Defense in depth: nothing may create an Account with an unverified email, or with a chosen role.
            if (user.emailVerified !== true) return false;
            return { data: { ...user, role: "customer" } };
          },
        },
      },
      account: {
        create: { before: async (identity) => ({ data: withoutProviderTokens(identity) }) },
        // Connecting Google a second time updates the stored identity instead of creating one.
        update: { before: async (identity) => ({ data: withoutProviderTokens(identity) }) },
      },
    },
    plugins: [
      {
        id: "prune-auth-rate-limits",
        onRequest: async (request, context) => {
          const path = new URL(request.url).pathname.slice(new URL(context.baseURL).pathname.length);
          if (path === "/**" || !Object.hasOwn(rateLimitRules, path)) return;
          // Better Auth only prunes when a stale key is reused. Also expire abandoned keys on new traffic.
          // Every configured/special/plugin window is at most 60s; keep this bound aligned with future rules.
          await db.execute(sql`delete from ${authRateLimits} where ${authRateLimits.lastRequest} < ${Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000}`);
        },
      },
      emailOTP({
        otpLength: 6,
        expiresIn: OTP_LIFETIME_SECONDS,
        allowedAttempts: 3,
        // Keyed hash, never the code: a database leak alone cannot reveal or replay a code.
        storeOTP: { hash: async (code: string) => hmacHex(secret, "otp", code) },
        sendVerificationOTP: async ({ email, otp }) => sendAuthCode({ email, code: otp }),
      }),
      // Must stay last: it forwards Set-Cookie to Next.js when a Server Action or route handler signs in.
      nextCookies(),
    ],
    advanced: {
      // The client IP keys every rate limit. Vercel overwrites both headers, so a caller cannot spoof them; without
      // a trustworthy single-value header Better Auth falls back to one shared bucket for everybody.
      ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for", "x-forwarded-for"] },
      // Better Auth silently skips origin checks when it detects a test runner; pin production behavior.
      disableOriginCheck: false,
      // Postgres generates UUID primary keys, like every other Neffi table.
      database: { generateId: "uuid" },
    },
  } satisfies BetterAuthOptions;
}
