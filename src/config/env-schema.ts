import { z } from "zod";
import { type AppEnv, assertDatabaseIsolation, resolveAppEnv } from "./isolation";

type RawEnv = Record<string, string | undefined>;

export type ServerEnv = {
  appEnv: AppEnv;
  databaseUrl: string;
  betterAuthSecret: string;
  authBaseUrl: string;
  sentryDsn?: string;
};

// Platforms often set unused variables to "", which should count as missing.
const blankAsMissing = <T extends z.ZodType>(schema: T) => z.preprocess((value) => (value === "" ? undefined : value), schema);

// Custom messages only: validation errors must never echo secret values.
const url = (name: string) => z.url({ error: `${name} must be a valid URL` });

const serverSchema = z.object({
  DATABASE_URL: blankAsMissing(url("DATABASE_URL")),
  BETTER_AUTH_SECRET: blankAsMissing(
    z.string({ error: "BETTER_AUTH_SECRET is required" }).min(32, { error: "BETTER_AUTH_SECRET must be at least 32 characters" }),
  ),
  // .optional() must sit inside the preprocess so "" becomes undefined before it is checked.
  BETTER_AUTH_URL: blankAsMissing(url("BETTER_AUTH_URL").optional()),
  VERCEL_BRANCH_URL: blankAsMissing(z.string().optional()),
  NEXT_PUBLIC_SENTRY_DSN: blankAsMissing(url("NEXT_PUBLIC_SENTRY_DSN").optional()),
});

const migrationSchema = z.object({
  DATABASE_URL_UNPOOLED: blankAsMissing(url("DATABASE_URL_UNPOOLED")),
});

function parse<T extends z.ZodType>(schema: T, raw: RawEnv): z.infer<T> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n- ${problems.join("\n- ")}`);
  }
  return result.data;
}

function resolveAuthBaseUrl(appEnv: AppEnv, explicit: string | undefined, branchHost: string | undefined): string {
  if (explicit) return explicit;
  // Preview URLs change per branch, so Vercel's branch URL is the trusted origin there.
  if (appEnv === "preview" && branchHost) return `https://${branchHost}`;
  throw new Error(`Invalid environment configuration:\n- BETTER_AUTH_URL: required in ${appEnv}`);
}

export function parseServerEnv(raw: RawEnv): ServerEnv {
  const appEnv = resolveAppEnv(raw.VERCEL_ENV || undefined);
  const env = parse(serverSchema, raw);
  assertDatabaseIsolation(appEnv, env.DATABASE_URL);

  return {
    appEnv,
    databaseUrl: env.DATABASE_URL,
    betterAuthSecret: env.BETTER_AUTH_SECRET,
    authBaseUrl: resolveAuthBaseUrl(appEnv, env.BETTER_AUTH_URL, env.VERCEL_BRANCH_URL),
    sentryDsn: env.NEXT_PUBLIC_SENTRY_DSN,
  };
}

export function parseMigrationEnv(raw: RawEnv): { appEnv: AppEnv; migrationDatabaseUrl: string } {
  const appEnv = resolveAppEnv(raw.VERCEL_ENV || undefined);
  const { DATABASE_URL_UNPOOLED } = parse(migrationSchema, raw);
  assertDatabaseIsolation(appEnv, DATABASE_URL_UNPOOLED);
  return { appEnv, migrationDatabaseUrl: DATABASE_URL_UNPOOLED };
}
