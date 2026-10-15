import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, test } from "vitest";
import { scrubBreadcrumb, scrubEvent, sentryOptions } from "./sentry-scrub";

describe("scrubEvent", () => {
  test("strips SQL parameters from every exception, including linked causes", () => {
    const scrubbed = scrubEvent({ type: undefined, exception: { values: [
      { type: "DrizzleQueryError", value: "Failed query: select * from accounts where email = $1\nparams: a@b.test,private\nmore private values" },
      { type: "Error", value: "cause params: another@b.test" },
      { type: "Error" },
    ] } });
    expect(scrubbed.exception?.values).toEqual([
      { type: "DrizzleQueryError", value: "Failed query: select * from accounts where email = $1\nparams: [scrubbed]" },
      { type: "Error", value: "cause params: [scrubbed]" },
      { type: "Error" },
    ]);
  });
  const event = (): ErrorEvent => ({
    type: undefined,
    message: "boom",
    request: {
      url: "https://tapcard.test/activate?code=ABC",
      cookies: { session: "1" },
      data: "activationCode=ABC",
      query_string: "code=ABC",
      headers: { cookie: "x", authorization: "Bearer t", "set-cookie": "y", "user-agent": "ua" },
    },
    user: { id: "1", email: "e@x.test", ip_address: "1.2.3.4" },
  });

  test("removes request cookies, body and query string", () => {
    const { request } = scrubEvent(event());
    expect(request).not.toHaveProperty("cookies");
    expect(request).not.toHaveProperty("data");
    expect(request).not.toHaveProperty("query_string");
  });

  test("strips query strings from the request URL", () => {
    expect(scrubEvent(event()).request?.url).toBe("https://tapcard.test/activate");
  });

  test("keeps only non-credential headers", () => {
    expect(scrubEvent(event()).request?.headers).toEqual({ "user-agent": "ua" });
  });

  test("drops the user's email and IP but keeps the id", () => {
    expect(scrubEvent(event()).user).toEqual({ id: "1" });
  });

  test("keeps the error message", () => {
    expect(scrubEvent(event()).message).toBe("boom");
  });

  test("strips the query from the Next.js request path context", () => {
    const scrubbed = scrubEvent({
      ...event(),
      contexts: { nextjs: { request_path: "/activate?code=ABC", router_kind: "App Router" } },
    });
    expect(scrubbed.contexts?.nextjs).toEqual({ request_path: "/activate", router_kind: "App Router" });
  });

  test("handles events without request or user", () => {
    expect(scrubEvent({ type: undefined, message: "plain" })).toEqual({ type: undefined, message: "plain" });
  });
});

describe("scrubBreadcrumb", () => {
  test("strips console SQL parameters and drops raw logged arguments", () => {
    const message = "Failed query: select * from accounts where email = $1\nparams: a@b.test,private\nmore private values";
    const crumb = scrubBreadcrumb({ category: "console", message, data: { arguments: [message, { email: "a@b.test" }], logger: "console", url: "/support?secret=hidden" } });
    expect(crumb.message).toBe("Failed query: select * from accounts where email = $1\nparams: [scrubbed]");
    expect(crumb.data).toEqual({ logger: "console", url: "/support" });
    expect(JSON.stringify(crumb)).not.toContain("a@b.test");
  });

  test("strips a breadcrumb message even without data", () => {
    expect(scrubBreadcrumb({ message: "query params: a@b.test" }).message).toBe("query params: [scrubbed]");
  });
  test("drops query strings from fetch/xhr breadcrumb URLs", () => {
    const crumb = scrubBreadcrumb({ category: "fetch", data: { url: "/api/x?code=ABC", method: "POST" } });
    expect(crumb.data).toEqual({ url: "/api/x", method: "POST" });
  });

  test("drops query strings from navigation breadcrumbs", () => {
    const crumb = scrubBreadcrumb({ category: "navigation", data: { from: "/a?x=1", to: "/activate?code=ABC" } });
    expect(crumb.data).toEqual({ from: "/a", to: "/activate" });
  });

  test("leaves other breadcrumbs untouched", () => {
    expect(scrubBreadcrumb({ category: "console", message: "hi" })).toEqual({ category: "console", message: "hi" });
  });
});

describe("sentryOptions", () => {
  test("is disabled without a DSN", () => {
    expect(sentryOptions(undefined, "development").enabled).toBe(false);
    expect(sentryOptions("https://k@o1.ingest.sentry.io/1", "preview").enabled).toBe(true);
  });

  test("turns off every personal-data collection category", () => {
    expect(sentryOptions(undefined, "development").dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      queues: false,
    });
  });

  test("does not enable tracing and wires the scrubbers", () => {
    const options = sentryOptions(undefined, "development");
    expect(options.tracesSampleRate).toBeUndefined();
    expect(options.beforeSend).toBe(scrubEvent);
    expect(options.beforeBreadcrumb).toBe(scrubBreadcrumb);
  });
});
