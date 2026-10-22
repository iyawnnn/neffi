import { LINK_KIND_LABELS, type LinkKind } from "./block-content";
import { ACCENTS } from "./appearance-options";
import { onAccent } from "./color-contrast";
import { parseFormConfig, visibleFields } from "../forms/config";

export { contrast, onAccent } from "./color-contrast";

export type ViewIdentity = {
  fullName: string; initials: string; headline: string | null; company: string | null; bio: string | null;
  phone: string | null; email: string | null; website: string | null; location: string | null;
  accent: string; onAccent: "#0C0C0D" | "#FFFFFF"; image: { url: string; isLogo: boolean } | null;
};
export type ViewBlock =
  | { id: string; type: "about"; text: string }
  | { id: string; type: "project"; title: string; description: string | null; url: string | null }
  | { id: string; type: "link"; kind: LinkKind; label: string; url: string }
  | { id: string; type: "contact"; saveContact: boolean; phone: string | null; email: string | null; website: string | null; location: string | null }
  | { id: string; type: "booking"; label: string; url: string }
  | { id: string; type: "form"; formId: string; title: string; fields: ReturnType<typeof visibleFields> };
export type SceneView = {
  identity: ViewIdentity;
  appearance: { layout: "classic" | "editorial" | "showcase"; mode: "light" | "dark"; accent: string; cover: { src: string; srcSet: string } | null };
  scene: { id: string; name: string }; blocks: ViewBlock[];
};
export type SceneViewInput = {
  profile: { fullName: string | null; headline: string | null; company: string | null; bio: string | null; phone: string | null; email: string | null; website: string | null; location: string | null; accentColor: string | null; imageIsLogo: boolean; layout: SceneView["appearance"]["layout"]; colorMode: SceneView["appearance"]["mode"] };
  imageUrl: string | null;
  cover?: SceneView["appearance"]["cover"];
  scene: { id: string; name: string };
  blocks: { id: string; type: string; position: number; visible: boolean; content: unknown; formId: string | null }[];
  forms: { id: string; title: string; config: unknown }[];
};

const initials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length ? (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase() : "N";
};

// Stored links are validated https on write; this keeps any older or hand-edited row from ever reaching a visitor.
const https = (value: unknown) => {
  if (typeof value !== "string") return null;
  try { return new URL(value).protocol === "https:" ? value : null; } catch { return null; }
};
// The one mapping from stored rows to what a viewer sees. Owner preview uses it now; M7's public page reuses it.
export function buildSceneView({ profile, imageUrl, cover = null, scene, blocks, forms }: SceneViewInput): SceneView {
  const accent = profile.accentColor ?? "#0C0C0D";
  const identity: ViewIdentity = {
    fullName: profile.fullName ?? "", initials: initials(profile.fullName ?? ""), headline: profile.headline, company: profile.company,
    bio: profile.bio, phone: profile.phone, email: profile.email, website: https(profile.website), location: profile.location,
    accent, onAccent: onAccent(accent), image: imageUrl ? { url: imageUrl, isLogo: profile.imageIsLogo } : null,
  };
  const view: ViewBlock[] = [];
  for (const block of [...blocks].sort((a, b) => a.position - b.position)) {
    if (!block.visible) continue;
    const c = block.content as Record<string, unknown>;
    if (block.type === "about") view.push({ id: block.id, type: "about", text: String(c.text) });
    else if (block.type === "project") view.push({ id: block.id, type: "project", title: String(c.title), description: (c.description as string | null) ?? null, url: https(c.url) });
    else if (block.type === "link") {
      const url = https(c.url);
      if (url) view.push({ id: block.id, type: "link", kind: c.kind as LinkKind, label: (c.label as string | null) ?? LINK_KIND_LABELS[c.kind as LinkKind], url });
    }
    else if (block.type === "booking") {
      const url = https(c.url);
      if (url) view.push({ id: block.id, type: "booking", label: (c.label as string | null) ?? "Book a time", url });
    }
    else if (block.type === "contact") {
      const { phone, email, website, location } = identity;
      if (c.saveContact || phone || email || website || location) view.push({ id: block.id, type: "contact", saveContact: Boolean(c.saveContact), phone, email, website, location });
    } else if (block.type === "form") {
      const form = forms.find((f) => f.id === block.formId);
      const parsed = form ? parseFormConfig(form.config) : { ok: false as const };
      if (form && parsed.ok) view.push({ id: block.id, type: "form", formId: form.id, title: form.title, fields: visibleFields(parsed.config) });
    }
  }
  return {
    identity, scene, blocks: view,
    appearance: { layout: profile.layout, mode: profile.colorMode, accent: ACCENTS.find(a => a.hex === profile.accentColor)?.hex ?? "#0C0C0D", cover },
  };
}
