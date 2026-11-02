import type { MetadataRoute } from "next";
import { resolveAppEnv, type AppEnv } from "@/config/isolation";
import { SITE_URL } from "@/config/site";

// noindex pages (/c, /activate, /sign-in, /support, /privacy, /terms) stay crawlable so crawlers can see their noindex.
export function robotsFor(appEnv: AppEnv): MetadataRoute.Robots {
  if (appEnv !== "production") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/app/", "/api/", "/dev/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

export default function robots(): MetadataRoute.Robots {
  return robotsFor(resolveAppEnv(process.env.VERCEL_ENV));
}
