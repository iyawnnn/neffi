import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppearanceReview } from "./appearance-review";
import { profileFixture, coverFixture } from "@/dev/profile-fixture";
import { ACCENTS } from "@/modules/profiles/appearance-options";

export const metadata: Metadata = { title: "Appearance editor - development only", robots: { index: false, follow: false } };
export const instant = false;

export default async function AppearancePreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV !== "development" || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "development")) notFound();
  const query = await searchParams;
  const view = structuredClone(profileFixture);
  view.appearance = {
    layout: query.layout === "editorial" || query.layout === "showcase" ? query.layout : "classic",
    mode: query.mode === "dark" ? "dark" : "light",
    accent: (ACCENTS.find(accent => accent.name === query.accent) ?? ACCENTS[0]).hex,
    cover: query.cover === "sample" ? coverFixture : null,
  };
  view.identity.image = { url: "/avatar-example.jpg", isLogo: false };
  return <main data-canvas className="app-type mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-10 md:px-6 md:pt-8 md:pb-12">
    <p className="mb-4 text-meta text-fg-secondary">Synthetic profile. Cover changes last until reload. Appearance saving is disabled.</p>
    <AppearanceReview initialView={view} />
  </main>;
}
