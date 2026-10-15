import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { securityHeaders } from "./src/config/security-headers";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The /c-only Proxy must distinguish Flight requests before Next strips their headers.
  skipProxyUrlNormalize: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default (phase: string): NextConfig => withSentryConfig({
  ...nextConfig,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders({ dev: phase === PHASE_DEVELOPMENT_SERVER, sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN }) }];
  },
}, {
  silent: true,
  telemetry: false,
  // Source-map upload needs SENTRY_AUTH_TOKEN; deferred to Production setup / M12.
  sourcemaps: { disable: true },
  release: { create: false },
});
