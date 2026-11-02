import type { Metadata } from "next";
import { SITE_NAME } from "@/config/site";

// Metadata merges shallowly, so each indexable page declares its own full openGraph/twitter instead of inheriting them.
// Without a title the root default ("Neffi") applies. Paths resolve against metadataBase.
export function pageMetadata({ title, description, path }: { title?: string; description: string; path: string }): Metadata {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  return {
    ...(title && { title }),
    description,
    alternates: { canonical: path },
    openGraph: { title: fullTitle, description, url: path, siteName: SITE_NAME, type: "website", locale: "en_PH" },
    twitter: { card: "summary", title: fullTitle, description },
  };
}
