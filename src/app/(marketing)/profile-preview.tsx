import Image from "next/image";
import { ArrowUpRight, Mail, MapPin, UserRound, UserRoundPlus } from "lucide-react";
import { LinkKindIcon } from "@/components/social-icons";
import type { LinkKind } from "@/modules/profiles/block-options";
import type { ViewIdentity } from "@/modules/profiles/scene-view";

export const demoIdentity: ViewIdentity = {
  fullName: "Mika Santos",
  initials: "MS",
  headline: "Brand Designer",
  company: null,
  location: "Manila, Philippines",
  email: null,
  phone: null,
  website: null,
  bio: null,
  accent: "#E64A35",
  onAccent: "#0C0C0D",
  image: { url: "/avatar-example.jpg", isLogo: false },
};

type PreviewLink = { kind: LinkKind | "contact"; label: string };

export const demoLinks = [
  { kind: "linkedin", label: "LinkedIn" },
  { kind: "instagram", label: "Instagram" },
  { kind: "dribbble", label: "Dribbble" },
  { kind: "behance", label: "Behance" },
] as const satisfies readonly { kind: LinkKind; label: string }[];

const profileLinks: readonly PreviewLink[] = [
  { kind: "portfolio", label: "Portfolio" },
  { kind: "booking", label: "Book a call" },
  { kind: "contact", label: "Contact" },
];

export function DemoAvatar({ name = demoIdentity.fullName, image = demoIdentity.image }: { name?: string; image?: ViewIdentity["image"] } = {}) {
  return (
    <span className="pe-avatar">
      {image ? <Image src={image.url} alt={`${name}, sample profile portrait`} width={80} height={80} sizes="80px" /> : <UserRound size={28} strokeWidth={1.3} aria-hidden="true" />}
    </span>
  );
}

export function DigitalProfilePreview({ identity, links, quickLinks, contactAction }: {
  identity: Pick<ViewIdentity, "fullName" | "headline" | "company" | "location" | "image">;
  links: readonly PreviewLink[];
  quickLinks: readonly { kind: LinkKind; label: string }[];
  contactAction: { label: string };
}) {
  return (
    <article className="pe-digital-profile" aria-label={`${identity.fullName}, sample digital profile`}>
      <header>
        <DemoAvatar name={identity.fullName} image={identity.image} />
        <h3>{identity.fullName}</h3>
        {identity.headline ? <p>{identity.headline}</p> : null}
        {identity.company ? <p>{identity.company}</p> : null}
        {identity.location ? <span className="pe-profile-location"><MapPin size={12} aria-hidden="true" />{identity.location}</span> : null}
      </header>
      <button type="button" className="pe-save-action"><UserRoundPlus size={16} aria-hidden="true" />{contactAction.label}</button>
      <div className="pe-quick-actions" role="group" aria-label="Sample social destinations">
        {quickLinks.map(({ kind, label }) => <button key={kind} type="button" aria-label={label}><LinkKindIcon kind={kind} className="pe-link-icon" /></button>)}
      </div>
      <div className="pe-profile-links">
        {links.map(({ kind, label }) => (
          <button key={kind} type="button">{kind === "contact" ? <span className="pe-link-icon"><Mail size={13} strokeWidth={1.6} aria-hidden="true" /></span> : <LinkKindIcon kind={kind} className="pe-link-icon" />}<span>{label}</span><ArrowUpRight size={14} aria-hidden="true" /></button>
        ))}
      </div>
    </article>
  );
}

export function ProfileScene() {
  return (
    <div className="pe-profile-scene">
      <DigitalProfilePreview identity={demoIdentity} links={profileLinks} quickLinks={demoLinks} contactAction={{
        label: "Save contact",
      }} />
    </div>
  );
}
