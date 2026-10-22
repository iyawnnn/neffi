import { PLATFORMS } from "./platform-registry";
import type { SceneView, ViewBlock, ViewIdentity } from "./scene-view";

export type LinkItem = Extract<ViewBlock, { type: "link" }>;
export type WorkItem = Extract<ViewBlock, { type: "project" }>;
export type AboutItem = Extract<ViewBlock, { type: "about" }>;
export type FormItem = Extract<ViewBlock, { type: "form" }>;
export type ContactGroup = Pick<ViewIdentity, "phone" | "email" | "website">;
export type PrimaryAction = (
  | { id: string; type: "contact"; label: "Save contact" }
  | Extract<ViewBlock, { type: "booking" }>
) & { filled: boolean };

export type ProfileSections = {
  identity: ViewIdentity;
  intro: string | null;
  primary: PrimaryAction[];
  featured: WorkItem | LinkItem | null;
  socials: LinkItem[];
  links: LinkItem[];
  work: WorkItem[];
  about: AboutItem[];
  contact: ContactGroup | null;
  forms: FormItem[];
};

// Preview overlays can contain unsaved URLs; preserve the same HTTPS-only render boundary.
const https = (value: string | null) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? value : null;
  } catch { return null; }
};

export function profileSections(view: SceneView): ProfileSections {
  const identity = { ...view.identity, website: https(view.identity.website) };
  const sections: ProfileSections = { identity, intro: null, primary: [], featured: null, socials: [], links: [], work: [], about: [], contact: null, forms: [] };
  // SceneView already excludes hidden Blocks and carries stored position order.
  for (const block of view.blocks) {
    switch (block.type) {
      case "about": sections.about.push(block); break;
      case "project": sections.work.push({ ...block, url: https(block.url) }); break;
      case "form": sections.forms.push(block); break;
      case "link": {
        const url = https(block.url);
        if (url) (PLATFORMS[block.kind]?.category === "social" ? sections.socials : sections.links).push({ ...block, url });
        break;
      }
      case "booking": {
        const url = https(block.url);
        if (url) sections.primary.push({ ...block, url, filled: false });
        break;
      }
      case "contact": sections.contact ??= { phone: identity.phone, email: identity.email, website: identity.website }; break;
    }
  }
  const saveContact = view.blocks.find(block => block.type === "contact" && block.saveContact);
  if (saveContact) sections.primary.unshift({ id: saveContact.id, type: "contact", label: "Save contact", filled: false });
  if (sections.primary.length) sections.primary[0].filled = true;
  const bio = identity.bio;
  if (bio?.trim() && !sections.about.some(block => block.text.trim() === bio.trim())) sections.intro = bio;
  if (view.appearance.layout === "showcase") sections.featured = sections.work.shift() ?? sections.links.shift() ?? null;
  return sections;
}
