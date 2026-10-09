import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry-scrub";

// Deliberately independent of src/config/env.ts: monitoring must start even when app config is invalid.
export function register() {
  Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.VERCEL_ENV ?? "development"));
}

export const onRequestError = Sentry.captureRequestError;
