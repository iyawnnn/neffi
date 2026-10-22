import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileRenderer } from "@/components/profile/profile-renderer";
import { profileFixture, allLinkFixtures, coverFixture } from "@/dev/profile-fixture";
import { ACCENTS } from "@/modules/profiles/appearance-options";

export const metadata: Metadata = { title: "Profile preview — development only", robots: { index: false, follow: false } };
export const instant = false;

export default async function ProfilePreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV !== "development" || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "development")) notFound();
  const query = await searchParams;
  const mode = query.mode === "dark" ? "dark" : "light";
  const layout = query.layout === "editorial" || query.layout === "showcase" ? query.layout : "classic";
  const accent = ACCENTS.find(accent => accent.name === query.accent) ?? ACCENTS[0];
  const view = structuredClone(profileFixture);
  view.appearance = { layout, mode, accent: accent.hex, cover: query.cover === "sample" ? coverFixture : null };
  if (query.image === "photo") view.identity.image = { url: "/avatar-example.jpg", isLogo: false };
  if (query.image === "logo") view.identity.image = { url: "/neffi-logo-ink.svg", isLogo: true };
  if (query.sample === "all-links") view.blocks = allLinkFixtures;
  if (query.sample === "link-featured") view.blocks = view.blocks.filter(block => block.type !== "project");
  if (layout === "showcase" && query.sample === "full") view.blocks = [...view.blocks, ...["A quieter way to shop", "Space for new conversations"].map((title, index) => ({ id: `work-${index}`, type: "project" as const, title, description: "Design and development for an independent team, from the first idea to a thoughtful launch.", url: `https://example.invalid/work-${index}` }))];
  if (query.sample === "minimal") { view.blocks = []; view.identity.bio = null; view.identity.company = null; view.identity.location = null; view.identity.headline = null; }
  if (query.sample === "long") {
    view.identity.fullName = "Ana Maria Reyes de la Cruz — Independent Design & Development";
    view.identity.email = "averylongpublicemailaddressforcontactreview@example.invalid";
    view.identity.website = "https://example.invalid/averylongunbrokenwebsitepaththatmustwrapwithoutoverflow";
    view.blocks = [...view.blocks, { id: "long-link", type: "link", kind: "custom", label: "Averylongunbrokenlinklabelthatmustwrapatthesmallestphonewidthwithoutoverflow", url: "https://example.invalid/long" }];
  }
  return <main className="flex flex-1 flex-col bg-[var(--pf-bg)]">
    <nav aria-label="Profile preview fixtures" className="flex flex-wrap items-center justify-center gap-x-4 border-b bg-canvas px-4 py-2 text-sm text-foreground [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:underline [&_a]:underline-offset-4 [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-brand">
      <span>Synthetic profile · development only · saving and submissions disabled</span>
      <Link href="?layout=classic">Classic</Link><Link href="?layout=editorial">Editorial</Link><Link href="?layout=showcase">Showcase</Link>
      <Link href={`?layout=${layout}&mode=light&accent=Ink`}>Light / Ink</Link><Link href={`?layout=${layout}&mode=dark&accent=Vermilion`}>Dark / Vermilion</Link>
      <Link href={`?layout=${layout}&mode=light&accent=Ocean`}>Light / Ocean</Link><Link href={`?layout=${layout}&mode=dark&accent=Teal`}>Dark / Teal</Link>
      <Link href={`?layout=${layout}&sample=all-links`}>All 22 links</Link><Link href={`?layout=${layout}&sample=minimal`}>Minimal</Link><Link href={`?layout=${layout}&sample=long`}>Long content</Link>
      {layout === "showcase" ? <><Link href="?layout=showcase&sample=full">Full work</Link><Link href="?layout=showcase&sample=link-featured">Featured link</Link></> : null}
      <Link href={`?layout=${layout}&image=photo`}>Photo</Link><Link href={`?layout=${layout}&image=logo`}>Logo</Link>
      <Link href={`?layout=${layout}&cover=sample&image=photo&mode=${mode}&accent=${accent.name}`}>With cover data</Link><Link href={`?layout=${layout}&mode=${mode}&accent=${accent.name}`}>Without cover</Link>
    </nav>
    <div className="flex flex-1 bg-[var(--pf-bg)]"><ProfileRenderer view={view} /></div>
  </main>;
}
