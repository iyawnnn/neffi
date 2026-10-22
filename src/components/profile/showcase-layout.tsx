import { ArrowUpRight, Building2, MapPin } from "lucide-react";
import type { ProfileSections } from "@/modules/profiles/profile-sections";
import type { SceneView } from "@/modules/profiles/scene-view";
import { PublicForm } from "@/components/public-form";
import { LinkKindIcon } from "@/components/social-icons";
import type { VisitorActions } from "./profile-renderer";
import { PrimaryActions, Socials, LinkRow, WorkItem, ContactRows, FormPreview } from "./profile-parts";

export function ShowcaseLayout({ sections, visitorActions, cover }: { sections: ProfileSections; visitorActions?: VisitorActions; cover?: SceneView["appearance"]["cover"] }) {
  const { identity, intro, primary, featured, work, links, socials, about, contact, forms } = sections;
  return (
    <div className="pf-showcase">
      <header className="pf-showcase-header">
        {cover ? <div className="pf-showcase-cover" aria-hidden="true"><img src={cover.src} srcSet={cover.srcSet} sizes="(min-width: 560px) 560px, 100vw" width={1200} height={400} alt="" loading="eager" fetchPriority="high" /></div> : <div className="pf-showcase-band" aria-hidden="true" />}
        <div className="pf-showcase-identity">
          {identity.image ? <img src={identity.image.url} alt="" width={88} height={88} decoding="async" className={`pf-showcase-image ${identity.image.isLogo ? "object-contain pf-logo" : "rounded-full object-cover"}`} /> : <div className="pf-initials" aria-hidden="true">{identity.initials}</div>}
          <div className="pf-name-block">
            <h1>{identity.fullName}</h1>
            {identity.headline ? <p className="pf-headline">{identity.headline}</p> : null}
            {identity.company || identity.location ? <div className="pf-metadata pf-showcase-meta">
              {identity.company ? <span><Building2 size={14} strokeWidth={1.6} aria-hidden="true" /><span>{identity.company}</span></span> : null}
              {identity.location ? <span><MapPin size={14} strokeWidth={1.6} aria-hidden="true" /><span>{identity.location}</span></span> : null}
            </div> : null}
          </div>
          {intro ? <p className="pf-intro">{intro}</p> : null}
        </div>
      </header>
      {primary.length ? <PrimaryActions actions={primary} visitorActions={visitorActions} /> : null}
      {featured ? <section className="pf-section" aria-label="Featured"><h2 className="pf-section-title">Featured</h2><div className="pf-showcase-featured">
        {featured.type === "project" ? <WorkItem item={featured} /> : <a href={featured.url} target="_blank" rel="noopener noreferrer" className="pf-showcase-featured-link min-h-11">
          <LinkKindIcon kind={featured.kind} monochrome /><span><span className="pf-showcase-featured-title">{featured.label}</span><span className="pf-muted pf-showcase-host">{new URL(featured.url).host}</span></span><ArrowUpRight className="pf-arrow" size={20} aria-hidden="true" />
        </a>}
      </div></section> : null}
      {work.length ? <section className="pf-section" aria-label="Work"><h2 className="pf-section-title">Work</h2><div className="pf-showcase-work">{work.map(item => <WorkItem key={item.id} item={item} />)}</div></section> : null}
      {links.length ? <nav className="pf-section" aria-label="Links"><h2 className="pf-section-title">Links</h2><div className="pf-links">{links.map(item => <LinkRow key={item.id} item={item} />)}</div></nav> : null}
      {socials.length ? <section className="pf-section" aria-label="Social profiles"><h2 className="pf-section-title">Socials</h2><Socials items={socials} showLabels /></section> : null}
      {about.length ? <section className="pf-section" aria-label="About"><h2 className="pf-section-title">About</h2>{about.map(item => <p key={item.id} className="pf-prose">{item.text}</p>)}</section> : null}
      {contact && (contact.phone || contact.email || contact.website) ? <ContactRows contact={contact} /> : null}
      {forms.map(item => visitorActions ? <PublicForm key={item.id} formId={item.formId} title={item.title} fields={item.fields} /> : <FormPreview key={item.id} item={item} />)}
    </div>
  );
}
