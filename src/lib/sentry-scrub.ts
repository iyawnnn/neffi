import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

// Shared by server, edge and browser Sentry init. Activation codes, OTPs, cookies and auth tokens
// must never reach Sentry, so collection is off at the source and events are scrubbed again before send.

const SAFE_HEADERS = new Set(["user-agent", "accept-language", "content-type"]);

const stripQuery = (value: unknown) => (typeof value === "string" ? value.split(/[?#]/)[0] : value);

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    const request = { ...event.request };
    delete request.cookies;
    delete request.data;
    delete request.query_string;
    if (request.url) request.url = stripQuery(request.url) as string;
    if (request.headers) {
      request.headers = Object.fromEntries(
        Object.entries(request.headers).filter(([name]) => SAFE_HEADERS.has(name.toLowerCase())),
      );
    }
    event.request = request;
  }
  // onRequestError copies the raw request path (including its query) into this context.
  const nextjs = event.contexts?.nextjs;
  if (nextjs && "request_path" in nextjs) {
    event.contexts = { ...event.contexts, nextjs: { ...nextjs, request_path: stripQuery(nextjs.request_path) } };
  }
  if (event.user) {
    event.user = event.user.id === undefined ? {} : { id: event.user.id };
  }
  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (!breadcrumb.data) return breadcrumb;
  const data = { ...breadcrumb.data };
  for (const key of ["url", "from", "to"]) {
    if (key in data) data[key] = stripQuery(data[key]);
  }
  return { ...breadcrumb, data };
}

type SentryInitOptions = NonNullable<Parameters<typeof import("@sentry/nextjs").init>[0]>;

export function sentryOptions(dsn: string | undefined, environment: string): SentryInitOptions {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment,
    // Errors only: no tracing, replay or logs in the Foundation baseline.
    dataCollection: {
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
    },
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}
