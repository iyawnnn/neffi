import { ArrowUpRight, Globe, Mail, Phone, UserRoundPlus } from "lucide-react";
import { LinkKindIcon } from "@/components/social-icons";
import { Input, Textarea } from "@/components/ui/input";
import { PUBLIC_FORM_PLACEHOLDERS } from "@/components/public-form-placeholders";
import type { ViewIdentity } from "@/modules/profiles/scene-view";
import type { ContactGroup, FormItem, LinkItem, PrimaryAction, WorkItem as Work } from "@/modules/profiles/profile-sections";
import { LINK_KIND_LABELS } from "@/modules/profiles/block-options";
import type { VisitorActions } from "./profile-renderer";

export function Identity({ identity, intro }: { identity: ViewIdentity; intro: string | null }) {
  return (
    <header className="pf-identity">
      {identity.image ? (
        <img src={identity.image.url} alt="" width={96} height={96} decoding="async" className={`pf-image ${identity.image.isLogo ? "object-contain pf-logo" : "rounded-full object-cover"}`} />
      ) : <div className="pf-initials" aria-hidden="true">{identity.initials}</div>}
      <div className="pf-name-block">
        <h1>{identity.fullName}</h1>
        {identity.headline ? <p className="pf-headline">{identity.headline}</p> : null}
        {identity.company || identity.location ? <p className="pf-metadata">{[identity.company, identity.location].filter(Boolean).join(" · ")}</p> : null}
      </div>
      {intro ? <p className="pf-intro">{intro}</p> : null}
    </header>
  );
}

const actionClass = (action: PrimaryAction) => `pf-action min-h-12${action.filled ? " neffi-cta" : ""}${action.type === "contact" ? " pf-save-contact" : ""}`;
const actionLabel = (action: PrimaryAction) => action.type === "contact" ? <><UserRoundPlus aria-hidden className="pf-action-icon" size={18} />{action.label}</> : action.label;

export function PrimaryActions({ actions, visitorActions }: { actions: PrimaryAction[]; visitorActions?: VisitorActions }) {
  return <div className="pf-primary">{actions.map(action => action.type === "contact" && !visitorActions ? (
    <button key={action.id} disabled className={actionClass(action)} data-filled={action.filled}>{actionLabel(action)}</button>
  ) : (
    <a key={action.id} href={action.type === "contact" ? visitorActions!.saveContactHref : action.url}
      target={action.type === "booking" ? "_blank" : undefined} rel={action.type === "booking" ? "noopener noreferrer" : undefined}
      className={actionClass(action)} data-filled={action.filled}>{actionLabel(action)}</a>
  ))}</div>;
}

export function Socials({ items, showLabels = false }: { items: LinkItem[]; showLabels?: boolean }) {
  return <nav aria-label="Social profiles" className="pf-socials">{items.map(item => (
    <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" aria-label={item.label === LINK_KIND_LABELS[item.kind] ? item.label : `${item.label} (${LINK_KIND_LABELS[item.kind]})`} className="pf-social min-h-11">
      <LinkKindIcon kind={item.kind} monochrome />
      {showLabels ? <span className="pf-social-label">{item.label}</span> : null}
    </a>
  ))}</nav>;
}

export function LinkRow({ item }: { item: LinkItem }) {
  return <a href={item.url} target="_blank" rel="noopener noreferrer" className="pf-link-row min-h-11">
    <LinkKindIcon kind={item.kind} monochrome />
    <span>{item.label}</span><ArrowUpRight className="pf-arrow" size={18} aria-hidden="true" />
  </a>;
}

export function WorkItem({ item }: { item: Work }) {
  return <div className="pf-work-item">
    <h3>{item.title}</h3>
    {item.description ? <p className="pf-prose pf-muted">{item.description}</p> : null}
    {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="pf-project-link min-h-11">View project<span className="sr-only">: {item.title}</span><ArrowUpRight size={16} aria-hidden="true" /></a> : null}
  </div>;
}

export function ContactRows({ contact }: { contact: ContactGroup }) {
  const rows = [
    { label: "Mobile", value: contact.phone, href: contact.phone ? `tel:${contact.phone.replace(/[^+\d]/g, "")}` : null, icon: Phone },
    { label: "Email", value: contact.email, href: `mailto:${contact.email}`, icon: Mail },
    { label: "Website", value: contact.website?.replace(/^https:\/\//, ""), href: contact.website, icon: Globe },
  ];
  return <section className="pf-section" aria-label="Contact"><h2 className="pf-section-title">Contact</h2><dl className="pf-contact">
    {rows.map(row => row.value && row.href ? <div key={row.label}><dt><row.icon size={16} strokeWidth={1.6} aria-hidden="true" className="shrink-0" /><span>{row.label}</span></dt><dd><a href={row.href} className="pf-contact-value min-h-11" target={row.label === "Website" ? "_blank" : undefined} rel={row.label === "Website" ? "noopener noreferrer" : undefined}><span>{row.value}</span></a></dd></div> : null)}
  </dl></section>;
}

export function FormPreview({ item }: { item: FormItem }) {
  return <section className="pf-form">
    <h2 className="pf-section-title">{item.title}</h2>
    {item.fields.map(field => <label key={field.key} className="pf-field-label">
      {field.label}{field.required ? " (required)" : ""}
      {field.kind === "long" ? <Textarea disabled placeholder={PUBLIC_FORM_PLACEHOLDERS[field.key]} className="pf-field" /> : <Input disabled type={field.kind} placeholder={PUBLIC_FORM_PLACEHOLDERS[field.key]} className="pf-field" />}
    </label>)}
    <button disabled className="pf-action min-h-12">Send</button>
    <p className="pf-form-note">Visitors can send you a message here.</p>
  </section>;
}
