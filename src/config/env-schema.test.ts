import { describe, expect, test } from "vitest";
import { parseMigrationEnv, parseSeedEnv, parseServerEnv } from "./env-schema";

const DEV_POOLED = "postgresql://dev:devpass@ep-dev-1-pooler.ap-southeast-1.aws.neon.tech/tapcard?sslmode=require";
const DEV_DIRECT = "postgresql://dev:devpass@ep-dev-1.ap-southeast-1.aws.neon.tech/tapcard?sslmode=require";

const base = {
  DATABASE_URL: DEV_POOLED,
  BETTER_AUTH_SECRET: "s".repeat(40),
  BETTER_AUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "synthetic-google-client-id.apps.example.test",
  GOOGLE_CLIENT_SECRET: "synthetic-google-client-secret",
  RESEND_API_KEY: "re_synthetic_key_not_real",
  AUTH_EMAIL_FROM: "Neffi <auth@example.test>",
  ACTIVATION_CODE_SECRET: "a".repeat(40),
  CARD_URL_ORIGIN: "http://localhost:3000",
  CLOUDINARY_CLOUD_NAME: "demo",
  CLOUDINARY_API_KEY: "synthetic-cloudinary-key",
  CLOUDINARY_API_SECRET: "synthetic-cloudinary-secret",
};

function errorMessage(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected function to throw");
}

describe("parseServerEnv", () => {
  test("support reply-to is optional and rejects header injection without echoing it", () => {
    expect(parseServerEnv({ ...base, SUPPORT_REPLY_TO: "help@example.test" }).supportReplyTo).toBe("help@example.test");
    expect(parseServerEnv({ ...base, SUPPORT_REPLY_TO: "" }).supportReplyTo).toBeUndefined();
    const message = errorMessage(() => parseServerEnv({ ...base, SUPPORT_REPLY_TO: "help@example.test\r\nBcc: stolen@example.test" }));
    expect(message).toContain("SUPPORT_REPLY_TO");
    expect(message).not.toContain("stolen@example.test");
  });
  test("requires the Cloudinary secret without echoing values", () => {
    const message = errorMessage(() => parseServerEnv({ ...base, CLOUDINARY_API_SECRET: undefined }));
    expect(message).toContain("CLOUDINARY_API_SECRET is required");
    expect(message).not.toContain(base.CLOUDINARY_API_KEY);
  });
  test("parses a valid development environment", () => {
    expect(parseServerEnv(base)).toEqual({
      appEnv: "development",
      databaseUrl: DEV_POOLED,
      betterAuthSecret: "s".repeat(40),
      authBaseUrl: "http://localhost:3000",
      sentryDsn: undefined,
      googleClientId: base.GOOGLE_CLIENT_ID,
      googleClientSecret: base.GOOGLE_CLIENT_SECRET,
      resendApiKey: base.RESEND_API_KEY,
      authEmailFrom: base.AUTH_EMAIL_FROM,
      supportReplyTo: undefined,
      activationCodeSecret: "a".repeat(40),
      cardUrlOrigin: "http://localhost:3000",
      cloudinaryCloudName: base.CLOUDINARY_CLOUD_NAME,
      cloudinaryApiKey: base.CLOUDINARY_API_KEY,
      cloudinaryApiSecret: base.CLOUDINARY_API_SECRET,
    });
  });

  test("requires a 32+ character activation code secret and never echoes it", () => {
    for (const value of [undefined, "", "short-secret"]) {
      const message = errorMessage(() => parseServerEnv({ ...base, ACTIVATION_CODE_SECRET: value }));
      expect(message).toContain("ACTIVATION_CODE_SECRET");
      expect(message).not.toContain("short-secret");
    }
  });

  test.each([
    ["http://localhost:3000/", "http://localhost:3000"],
    ["https://tap.example.test", "https://tap.example.test"],
  ])("normalizes CARD_URL_ORIGIN %s", (value, expected) => {
    expect(parseServerEnv({ ...base, CARD_URL_ORIGIN: value }).cardUrlOrigin).toBe(expected);
  });

  test.each([undefined, "", "not-a-url", "https://tap.example.test/c", "https://tap.example.test/?x=1", "https://tap.example.test/#f", "ftp://tap.example.test"])(
    "rejects CARD_URL_ORIGIN %s",
    (value) => {
      expect(errorMessage(() => parseServerEnv({ ...base, CARD_URL_ORIGIN: value }))).toContain("CARD_URL_ORIGIN");
    },
  );

  test("CARD_URL_ORIGIN must be https outside development", () => {
    const preview = { ...base, VERCEL_ENV: "preview", BETTER_AUTH_URL: "https://x.example.test" };
    expect(errorMessage(() => parseServerEnv({ ...preview, CARD_URL_ORIGIN: "http://tap.example.test" }))).toContain("CARD_URL_ORIGIN");
    expect(parseServerEnv({ ...preview, CARD_URL_ORIGIN: "https://tap.example.test" }).cardUrlOrigin).toBe("https://tap.example.test");
  });

  test.each(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "RESEND_API_KEY", "AUTH_EMAIL_FROM"] as const)(
    "requires %s and never echoes the other sign-in secrets",
    (name) => {
      for (const value of [undefined, ""]) {
        const message = errorMessage(() => parseServerEnv({ ...base, [name]: value }));
        expect(message).toContain(name);
        for (const secret of [base.GOOGLE_CLIENT_SECRET, base.RESEND_API_KEY]) expect(message).not.toContain(secret);
      }
    },
  );

  test("names a missing required variable", () => {
    expect(errorMessage(() => parseServerEnv({ ...base, DATABASE_URL: undefined }))).toMatch(/DATABASE_URL/);
  });

  test("treats an empty string as missing", () => {
    expect(errorMessage(() => parseServerEnv({ ...base, DATABASE_URL: "" }))).toMatch(/DATABASE_URL/);
  });

  test("rejects a short secret without echoing it", () => {
    const message = errorMessage(() => parseServerEnv({ ...base, BETTER_AUTH_SECRET: "leakyvalue" }));
    expect(message).toMatch(/BETTER_AUTH_SECRET/);
    expect(message).not.toContain("leakyvalue");
  });

  test("rejects an invalid database URL without echoing it", () => {
    const message = errorMessage(() => parseServerEnv({ ...base, DATABASE_URL: "postgres-secret-xyz" }));
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).not.toContain("postgres-secret-xyz");
  });

  test("development requires BETTER_AUTH_URL", () => {
    expect(errorMessage(() => parseServerEnv({ ...base, BETTER_AUTH_URL: undefined }))).toMatch(/BETTER_AUTH_URL/);
  });

  test("preview derives the auth URL from the branch URL", () => {
    const env = parseServerEnv({
      ...base,
      BETTER_AUTH_URL: undefined,
      VERCEL_ENV: "preview",
      CARD_URL_ORIGIN: "https://tap.example.test",
      VERCEL_BRANCH_URL: "tapcard-git-x.vercel.app",
    });
    expect(env.appEnv).toBe("preview");
    expect(env.authBaseUrl).toBe("https://tapcard-git-x.vercel.app");
  });

  test("an explicit BETTER_AUTH_URL wins in preview", () => {
    const env = parseServerEnv({
      ...base,
      CARD_URL_ORIGIN: "https://tap.example.test",
      BETTER_AUTH_URL: "https://preview.example.dev",
      VERCEL_ENV: "preview",
      VERCEL_BRANCH_URL: "tapcard-git-x.vercel.app",
    });
    expect(env.authBaseUrl).toBe("https://preview.example.dev");
  });

  test("a blank BETTER_AUTH_URL in preview falls back to the branch URL", () => {
    const env = parseServerEnv({
      ...base,
      CARD_URL_ORIGIN: "https://tap.example.test",
      BETTER_AUTH_URL: "",
      VERCEL_ENV: "preview",
      VERCEL_BRANCH_URL: "tapcard-git-x.vercel.app",
    });
    expect(env.authBaseUrl).toBe("https://tapcard-git-x.vercel.app");
  });

  test("a blank optional Sentry DSN is treated as absent", () => {
    expect(parseServerEnv({ ...base, NEXT_PUBLIC_SENTRY_DSN: "" }).sentryDsn).toBeUndefined();
  });

  test("preview without any auth URL fails clearly", () => {
    const message = errorMessage(() => parseServerEnv({ ...base, CARD_URL_ORIGIN: "https://tap.example.test", BETTER_AUTH_URL: undefined, VERCEL_ENV: "preview" }));
    expect(message).toMatch(/BETTER_AUTH_URL/);
  });

  test("production fails closed while no production database is registered", () => {
    expect(() => parseServerEnv({ ...base, VERCEL_ENV: "production" })).toThrow(/production/);
  });

  test("passes through an optional Sentry DSN", () => {
    const dsn = "https://public@o1.ingest.sentry.io/1";
    expect(parseServerEnv({ ...base, NEXT_PUBLIC_SENTRY_DSN: dsn }).sentryDsn).toBe(dsn);
  });
});

describe("parseMigrationEnv", () => {
  test("uses the unpooled URL for migrations", () => {
    expect(parseMigrationEnv({ DATABASE_URL_UNPOOLED: DEV_DIRECT })).toEqual({
      appEnv: "development",
      migrationDatabaseUrl: DEV_DIRECT,
    });
  });

  test("requires DATABASE_URL_UNPOOLED", () => {
    expect(errorMessage(() => parseMigrationEnv({ DATABASE_URL: DEV_POOLED }))).toMatch(/DATABASE_URL_UNPOOLED/);
  });

  test("applies the isolation guard to the migration URL", () => {
    expect(() => parseMigrationEnv({ DATABASE_URL_UNPOOLED: DEV_DIRECT, VERCEL_ENV: "production" })).toThrow(
      /production/,
    );
  });
});

describe("parseSeedEnv", () => {
  test("requires explicit development even when the runtime defaults to development", () => {
    expect(() => parseSeedEnv({ DATABASE_URL_UNPOOLED: DEV_DIRECT })).toThrow(/development/);
  });

  test("rejects a production runtime even with an explicit development app environment", () => {
    expect(() => parseSeedEnv({ DATABASE_URL_UNPOOLED: DEV_DIRECT, VERCEL_ENV: "development", NODE_ENV: "production" }))
      .toThrow(/development/);
  });

  test("accepts explicit development in a standalone CLI with NODE_ENV unset", () => {
    expect(parseSeedEnv({ DATABASE_URL_UNPOOLED: DEV_DIRECT, VERCEL_ENV: "development" })).toEqual({
      appEnv: "development",
      migrationDatabaseUrl: DEV_DIRECT,
    });
  });
});
