import { z } from "zod";
import { type AppEnv, assertDatabaseIsolation, resolveAppEnv } from "./isolation";

type RawEnv = Record<string, string | undefined>;

export type ServerEnv = {
  appEnv: AppEnv;
  databaseUrl: string;
  betterAuthSecret: string;
  authBaseUrl: string;
  sentryDsn?: string;
  googleClientId: string;
  googleClientSecret: string;
  resendApiKey: string;
  authEmailFrom: string;
  supportReplyTo?: string;
  activationCodeSecret: string;
  activationCodeEncryptionActiveKeyId: string;
  activationCodeEncryptionKeys: ReadonlyMap<string, Buffer>;
  cardUrlOrigin: string;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
};

// Platforms often set unused variables to "", which should count as missing.
const blankAsMissing = <T extends z.ZodType>(schema: T) => z.preprocess((value) => (value === "" ? undefined : value), schema);

// Custom messages only: validation errors must never echo secret values.
const url = (name: string) => z.url({ error: `${name} must be a valid URL` });

const required = (name: string) => blankAsMissing(z.string({ error: `${name} is required` }).min(1, { error: `${name} is required` }));

function parseEncryptionKeys(value: string): ReadonlyMap<string, Buffer> {
  const fail = (): never => { throw new Error("ACTIVATION_CODE_ENCRYPTION_KEYS must be a flat JSON object of unique IDs and 32-byte base64 keys"); };
  const keys = new Map<string, Buffer>();
  let position = 0;
  const spaces = () => { while (/\s/.test(value[position] ?? "")) position++; };
  spaces();
  if (value[position++] !== "{") fail();
  spaces();
  if (value[position] === "}") fail();
  while (position < value.length) {
    const match = /^"([A-Za-z0-9_-]+)"\s*:\s*"([A-Za-z0-9+/]+={0,2})"/.exec(value.slice(position)) ?? fail();
    const [, id, encoded] = match;
    const decoded = Buffer.from(encoded, "base64");
    if (keys.has(id) || decoded.length !== 32 || decoded.toString("base64") !== encoded) fail();
    keys.set(id, decoded);
    position += match[0].length;
    spaces();
    if (value[position] === "}") {
      position++;
      spaces();
      if (position !== value.length) fail();
      return keys;
    }
    if (value[position++] !== ",") fail();
    spaces();
  }
  return fail();
}

// The origin written into physical cards. It is bare (no path, query or hash) so `${origin}/c/${token}` is exact.
const cardUrlOrigin = blankAsMissing(
  z
    .string({ error: "CARD_URL_ORIGIN is required" })
    .transform((value, ctx) => {
      try {
        const parsed = new URL(value);
        if (["http:", "https:"].includes(parsed.protocol) && parsed.pathname === "/" && !parsed.search && !parsed.hash) return parsed.origin;
      } catch {}
      ctx.addIssue({ code: "custom", message: "CARD_URL_ORIGIN must be an http(s) origin with no path, query or hash" });
      return z.NEVER;
    }),
);

const serverSchema = z.object({
  DATABASE_URL: blankAsMissing(url("DATABASE_URL")),
  BETTER_AUTH_SECRET: blankAsMissing(
    z.string({ error: "BETTER_AUTH_SECRET is required" }).min(32, { error: "BETTER_AUTH_SECRET must be at least 32 characters" }),
  ),
  // .optional() must sit inside the preprocess so "" becomes undefined before it is checked.
  BETTER_AUTH_URL: blankAsMissing(url("BETTER_AUTH_URL").optional()),
  VERCEL_BRANCH_URL: blankAsMissing(z.string().optional()),
  NEXT_PUBLIC_SENTRY_DSN: blankAsMissing(url("NEXT_PUBLIC_SENTRY_DSN").optional()),
  GOOGLE_CLIENT_ID: required("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: required("GOOGLE_CLIENT_SECRET"),
  RESEND_API_KEY: required("RESEND_API_KEY"),
  AUTH_EMAIL_FROM: required("AUTH_EMAIL_FROM"),
  SUPPORT_REPLY_TO: blankAsMissing(z.email({ error: "SUPPORT_REPLY_TO must be a valid email" }).optional()),
  ACTIVATION_CODE_SECRET: blankAsMissing(
    z.string({ error: "ACTIVATION_CODE_SECRET is required" }).min(32, { error: "ACTIVATION_CODE_SECRET must be at least 32 characters" }),
  ),
  ACTIVATION_CODE_ENCRYPTION_ACTIVE_KEY_ID: required("ACTIVATION_CODE_ENCRYPTION_ACTIVE_KEY_ID"),
  ACTIVATION_CODE_ENCRYPTION_KEYS: required("ACTIVATION_CODE_ENCRYPTION_KEYS"),
  CARD_URL_ORIGIN: cardUrlOrigin,
  CLOUDINARY_CLOUD_NAME: required("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: required("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: required("CLOUDINARY_API_SECRET"),
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
  if (!/^[A-Za-z0-9_-]+$/.test(env.ACTIVATION_CODE_ENCRYPTION_ACTIVE_KEY_ID)) {
    throw new Error("ACTIVATION_CODE_ENCRYPTION_ACTIVE_KEY_ID must be a valid key ID");
  }
  const encryptionKeys = parseEncryptionKeys(env.ACTIVATION_CODE_ENCRYPTION_KEYS);
  if (!encryptionKeys.has(env.ACTIVATION_CODE_ENCRYPTION_ACTIVE_KEY_ID)) {
    throw new Error("ACTIVATION_CODE_ENCRYPTION_ACTIVE_KEY_ID must identify a configured key");
  }
  assertDatabaseIsolation(appEnv, env.DATABASE_URL);
  if (appEnv !== "development" && !env.CARD_URL_ORIGIN.startsWith("https://")) {
    throw new Error(`Invalid environment configuration:
- CARD_URL_ORIGIN: must be https in ${appEnv}`);
  }

  return {
    appEnv,
    databaseUrl: env.DATABASE_URL,
    betterAuthSecret: env.BETTER_AUTH_SECRET,
    authBaseUrl: resolveAuthBaseUrl(appEnv, env.BETTER_AUTH_URL, env.VERCEL_BRANCH_URL),
    sentryDsn: env.NEXT_PUBLIC_SENTRY_DSN,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    resendApiKey: env.RESEND_API_KEY,
    authEmailFrom: env.AUTH_EMAIL_FROM,
    supportReplyTo: env.SUPPORT_REPLY_TO,
    activationCodeSecret: env.ACTIVATION_CODE_SECRET,
    activationCodeEncryptionActiveKeyId: env.ACTIVATION_CODE_ENCRYPTION_ACTIVE_KEY_ID,
    activationCodeEncryptionKeys: encryptionKeys,
    cardUrlOrigin: env.CARD_URL_ORIGIN,
    cloudinaryCloudName: env.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: env.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: env.CLOUDINARY_API_SECRET,
  };
}

export function parseMigrationEnv(raw: RawEnv): { appEnv: AppEnv; migrationDatabaseUrl: string } {
  const appEnv = resolveAppEnv(raw.VERCEL_ENV || undefined);
  const { DATABASE_URL_UNPOOLED } = parse(migrationSchema, raw);
  assertDatabaseIsolation(appEnv, DATABASE_URL_UNPOOLED);
  return { appEnv, migrationDatabaseUrl: DATABASE_URL_UNPOOLED };
}

export function parseSeedEnv(raw: RawEnv): { appEnv: AppEnv; migrationDatabaseUrl: string } {
  // Destructive resets must never inherit resolveAppEnv's development default.
  if (raw.VERCEL_ENV !== "development" || (raw.NODE_ENV !== undefined && raw.NODE_ENV !== "development")) {
    throw new Error("db:seed resets data and requires VERCEL_ENV=development and NODE_ENV unset or development");
  }
  return parseMigrationEnv(raw);
}
