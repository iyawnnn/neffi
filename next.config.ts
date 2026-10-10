import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  // Source-map upload needs SENTRY_AUTH_TOKEN; deferred to Security & Performance Hardening (Milestone 10).
  sourcemaps: { disable: true },
  release: { create: false },
});
