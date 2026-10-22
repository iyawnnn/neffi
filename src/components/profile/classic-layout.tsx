import type { ProfileSections } from "@/modules/profiles/profile-sections";
import { PublicForm } from "@/components/public-form";
import type { VisitorActions } from "./profile-renderer";
import { Identity, PrimaryActions, Socials, LinkRow, WorkItem, ContactRows, FormPreview } from "./profile-parts";

export function ClassicLayout({ sections, visitorActions }: { sections: ProfileSections; visitorActions?: VisitorActions }) {
  const { identity, intro, primary, featured, socials, links, work, about, contact, forms } = sections;
  // T4 extracts Showcase's first item; keep it in the Classic fallback's ordinary group.
  const classicLinks = featured?.type === "link" ? [featured, ...links] : links;
  const classicWork = featured?.type === "project" ? [featured, ...work] : work;
  return (
    <div className="pf-classic">
      <Identity identity={identity} intro={intro} />
      {primary.length ? <PrimaryActions actions={primary} visitorActions={visitorActions} /> : null}
      {socials.length ? <Socials items={socials} /> : null}
      {classicLinks.length ? <nav aria-label="Links" className="pf-links">{classicLinks.map(item => <LinkRow key={item.id} item={item} />)}</nav> : null}
      {classicWork.length ? <section className="pf-section" aria-label="Work"><h2 className="pf-section-title">Work</h2><div className="pf-work">{classicWork.map(item => <WorkItem key={item.id} item={item} />)}</div></section> : null}
      {about.length ? <section className="pf-section" aria-label="About"><h2 className="pf-section-title">About</h2>{about.map(item => <p key={item.id} className="pf-prose">{item.text}</p>)}</section> : null}
      {contact && (contact.phone || contact.email || contact.website) ? <ContactRows contact={contact} /> : null}
      {forms.map(item => visitorActions ? <PublicForm key={item.id} formId={item.formId} title={item.title} fields={item.fields} /> : <FormPreview key={item.id} item={item} />)}
    </div>
  );
}
