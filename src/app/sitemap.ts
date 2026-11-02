import type { MetadataRoute } from "next";
import { resolveAppEnv, type AppEnv } from "@/config/isolation";
import { SITE_URL } from "@/config/site";

const INDEXABLE_PATHS = ["", "/product", "/pricing", "/guide", "/help"];

export function sitemapFor(appEnv: AppEnv): MetadataRoute.Sitemap {
  return appEnv === "production" ? INDEXABLE_PATHS.map((path) => ({ url: `${SITE_URL}${path}` })) : [];
}

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapFor(resolveAppEnv(process.env.VERCEL_ENV));
}
