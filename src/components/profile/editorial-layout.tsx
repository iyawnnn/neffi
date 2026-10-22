import { Building2, MapPin } from "lucide-react";
import type { ProfileSections } from "@/modules/profiles/profile-sections";
import { PublicForm } from "@/components/public-form";
import type { VisitorActions } from "./profile-renderer";
import { PrimaryActions, Socials, LinkRow, WorkItem, ContactRows, FormPreview } from "./profile-parts";

export function EditorialLayout({ sections, visitorActions }: { sections: ProfileSections; visitorActions?: VisitorActions }) {
  const { identity, intro, primary, contact, links, work, about, socials, forms } = sections;
  return (
    <div className="pf-editorial">
      <header className="pf-editorial-header">
        <div className="pf-editorial-identity">
          {identity.image ? <img src={identity.image.url} alt="" width={64} height={64} decoding="async" className={`pf-editorial-image ${identity.image.isLogo ? "object-contain pf-logo" : "rounded-full object-cover"}`} /> : null}
          <div className="pf-name-block">
            <h1>{identity.fullName}</h1>
            {identity.headline ? <p className="pf-headline">{identity.headline}</p> : null}
            {identity.company || identity.location ? <div className="pf-metadata pf-editorial-meta">
              {identity.company ? <span className="pf-editorial-meta-item"><Building2 size={14} strokeWidth={1.6} aria-hidden="true" /><span>{identity.company}</span></span> : null}{" "}
              {identity.location ? <span className="pf-editorial-meta-item"><MapPin size={14} strokeWidth={1.6} aria-hidden="true" /><span>{identity.location}</span></span> : null}
            </div> : null}
          </div>
        </div>
        {intro ? <p className="pf-intro">{intro}</p> : null}
      </header>
      {primary.length ? <PrimaryActions actions={primary} visitorActions={visitorActions} /> : null}
      {contact && (contact.phone || contact.email || contact.website) ? <ContactRows contact={contact} /> : null}
      {links.length ? <nav className="pf-section" aria-label="Links"><h2 className="pf-section-title">Links</h2><div className="pf-links">{links.map(item => <LinkRow key={item.id} item={item} />)}</div></nav> : null}
      {work.length ? <section className="pf-section" aria-label="Work"><h2 className="pf-section-title">Work</h2><div className="pf-work">{work.map(item => <WorkItem key={item.id} item={item} />)}</div></section> : null}
      {about.length ? <section className="pf-section" aria-label="About"><h2 className="pf-section-title">About</h2><div className="pf-editorial-prose">{about.map(item => <p key={item.id} className="pf-prose">{item.text}</p>)}</div></section> : null}
      {socials.length ? <section className="pf-section" aria-label="Social profiles"><h2 className="pf-section-title">Socials</h2><Socials items={socials} showLabels /></section> : null}
      {forms.map(item => visitorActions ? <PublicForm key={item.id} formId={item.formId} title={item.title} fields={item.fields} /> : <FormPreview key={item.id} item={item} />)}
    </div>
  );
}
