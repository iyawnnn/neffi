import type { SceneView, ViewIdentity } from "@/modules/profiles/scene-view";
import { GOALS, NO_GOAL, type Goal } from "@/modules/profiles/goals";
import { normalizeLink } from "@/lib/safe-url";
import { identityPhone, type DetailValues } from "../../profiles/[profileId]/identity/identity-values";

export type SetupDraft = Partial<DetailValues> & { imageIsLogo?: boolean; saveContact?: boolean };
export type SetupImageUrls = { photo: string; logo: string } | null;

export function setupDraft(saved: SceneView | null, draft: SetupDraft, goal: Goal | null = null, images?: SetupImageUrls): SceneView {
  const recommendation = goal ? GOALS[goal] : NO_GOAL;
  const base: SceneView = saved ?? {
    identity: { fullName: "", initials: "", headline: null, company: null, bio: null, phone: null, email: null, website: null, location: null, accent: "#0C0C0D", onAccent: "#FFFFFF", image: null },
    appearance: { layout: recommendation.layout, mode: "light", accent: "#0C0C0D", cover: null },
    scene: { id: "setup-draft", name: recommendation.sceneName }, blocks: [],
  };
  const identity: ViewIdentity = { ...base.identity };
  for (const key of ["fullName", "headline", "company", "bio", "location", "email"] as const) {
    if (draft[key] !== undefined) Object.assign(identity, { [key]: draft[key].trim() || (key === "fullName" ? "" : null) });
  }
  const words = identity.fullName.split(/\s+/).filter(Boolean);
  identity.initials = words.length ? (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase() : "";
  if (draft.website !== undefined) identity.website = normalizeLink(draft.website);
  if (draft.phone !== undefined) identity.phone = identityPhone(draft.phone, base.identity.phone) || null;
  if (images) {
    const isLogo = draft.imageIsLogo ?? base.identity.image?.isLogo ?? false;
    identity.image = { url: isLogo ? images.logo : images.photo, isLogo };
  }
  const contact = { phone: identity.phone, email: identity.email, website: identity.website, location: identity.location };
  const blocks = base.blocks.map(block => block.type === "contact" ? { ...block, ...contact, saveContact: draft.saveContact ?? block.saveContact } : block);
  if (draft.saveContact !== undefined && !blocks.some(block => block.type === "contact")) blocks.push({ id: "setup-contact-draft", type: "contact", ...contact, saveContact: draft.saveContact });
  return { ...base, identity, blocks };
}
