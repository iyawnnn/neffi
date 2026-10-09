import { describe, expect, test } from "vitest";
import { assertDatabaseIsolation, resolveAppEnv } from "./isolation";

const PROD = ["ep-prod-123.ap-southeast-1.aws.neon.tech"];
const url = (host: string) => `postgresql://u:p@${host}/db?sslmode=require`;

describe("resolveAppEnv", () => {
  test("defaults to development when VERCEL_ENV is unset", () => {
    expect(resolveAppEnv(undefined)).toBe("development");
  });

  test("passes through known Vercel environments", () => {
    expect(resolveAppEnv("development")).toBe("development");
    expect(resolveAppEnv("preview")).toBe("preview");
    expect(resolveAppEnv("production")).toBe("production");
  });

  test("rejects unknown values instead of guessing", () => {
    expect(() => resolveAppEnv("staging")).toThrow(/VERCEL_ENV/);
  });
});

describe("assertDatabaseIsolation", () => {
  test("preview may not use a production host", () => {
    expect(() => assertDatabaseIsolation("preview", url(PROD[0]), PROD)).toThrow(/production database/);
  });

  test("the pooled hostname of a production endpoint counts as production", () => {
    expect(() =>
      assertDatabaseIsolation("development", url("ep-prod-123-pooler.ap-southeast-1.aws.neon.tech"), PROD),
    ).toThrow(/production database/);
  });

  test("host comparison ignores case", () => {
    expect(() => assertDatabaseIsolation("preview", url("EP-PROD-123.ap-southeast-1.aws.neon.tech"), PROD)).toThrow();
  });

  test("production must use a listed production host", () => {
    expect(() => assertDatabaseIsolation("production", url("ep-dev-9.aws.neon.tech"), PROD)).toThrow(/production/);
    expect(() => assertDatabaseIsolation("production", url(PROD[0]), PROD)).not.toThrow();
  });

  test("production fails closed while no production host is registered", () => {
    expect(() => assertDatabaseIsolation("production", url(PROD[0]), [])).toThrow();
  });

  test("non-production with a non-production host passes", () => {
    expect(() => assertDatabaseIsolation("development", url("ep-dev-9.aws.neon.tech"), PROD)).not.toThrow();
    expect(() => assertDatabaseIsolation("preview", url("ep-dev-9-pooler.aws.neon.tech"), PROD)).not.toThrow();
  });

  test("a malformed URL fails without echoing it", () => {
    expect(() => assertDatabaseIsolation("development", "not-a-url-secret", PROD)).toThrow(/DATABASE_URL/);
    expect(() => assertDatabaseIsolation("development", "not-a-url-secret", PROD)).not.toThrow(/not-a-url-secret/);
  });
});
