import { describe, expect, test } from "vitest";
import { assertDatabaseIsolation, PRODUCTION_DATABASE_HOSTS, resolveAppEnv } from "./isolation";

const PROD = ["ep-prod-123.ap-southeast-1.aws.neon.tech"];
const url = (host: string) => `postgresql://u:p@${host}/db?sslmode=require`;

describe("registered production database", () => {
  const host = "ep-gentle-cell-aoctmxkt.c-2.ap-southeast-1.aws.neon.tech";
  const pooled = host.replace(".c-2.", "-pooler.c-2.");

  test("registers only the separate neffi-production endpoint", () => {
    expect(PRODUCTION_DATABASE_HOSTS).toEqual([host]);
  });

  test.each([host, pooled])("production accepts its endpoint %s", (endpoint) => {
    expect(() => assertDatabaseIsolation("production", url(endpoint))).not.toThrow();
  });

  test.each(["development", "preview"] as const)("%s cannot use production", (environment) => {
    for (const endpoint of [host, pooled]) {
      expect(() => assertDatabaseIsolation(environment, url(endpoint))).toThrow(/production database/);
    }
  });

  test("production rejects development and unknown endpoints", () => {
    for (const endpoint of [
      "ep-mute-block-azrjzr69.c-3.ap-southeast-1.aws.neon.tech",
      "ep-mute-block-azrjzr69-pooler.c-3.ap-southeast-1.aws.neon.tech",
      "ep-unknown.example.invalid",
    ]) {
      expect(() => assertDatabaseIsolation("production", url(endpoint))).toThrow(/registered production/);
    }
  });
});

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
    let message = "";
    try {
      assertDatabaseIsolation("development", "not-a-url-secret", PROD);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).not.toContain("not-a-url-secret");
  });

  test("a trailing-dot hostname still counts as the production host", () => {
    expect(() => assertDatabaseIsolation("preview", url(`${PROD[0]}.`), PROD)).toThrow(/production database/);
  });

  test("hosts that could hide the real target are rejected", () => {
    expect(() => assertDatabaseIsolation("preview", url("ep%2Dprod-123.ap-southeast-1.aws.neon.tech"), PROD)).toThrow();
    expect(() => assertDatabaseIsolation("preview", url(`ep-dev-9.aws.neon.tech,${PROD[0]}`), PROD)).toThrow();
  });

  test("query parameters may not override the connection host", () => {
    const dev = "postgresql://u:p@ep-dev-9.aws.neon.tech/db";
    expect(() => assertDatabaseIsolation("preview", `${dev}?host=${PROD[0]}`, PROD)).toThrow(/host/);
    expect(() => assertDatabaseIsolation("preview", `${dev}?sslmode=require&hostaddr=10.0.0.1`, PROD)).toThrow(/host/);
  });
});
