import type { SceneView } from "@/modules/profiles/scene-view";
import { demoIdentity, demoLinks } from "../profile-preview";

export const destinations = [
  { kind: "portfolio", label: "Portfolio" },
  { kind: "booking", label: "Book a call" },
] as const;
export const baseMarketingProfile: SceneView = {
  identity: demoIdentity,
  appearance: { layout: "classic", mode: "light", accent: demoIdentity.accent, cover: null },
  scene: { id: "marketing-profile", name: "Main" },
  blocks: [
    { id: "save-contact", type: "contact", saveContact: true, phone: null, email: null, website: null, location: null },
    ...demoLinks.map(({ kind, label }) => ({ id: kind, type: "link" as const, kind, label, url: `https://example.invalid/${kind}` })),
    ...destinations.map(({ kind, label }) => ({ id: kind, type: "link" as const, kind, label, url: `https://example.invalid/${kind}` })),
    { id: "contact", type: "link", kind: "custom", label: "Contact", url: "https://example.invalid/contact" },
  ],
};

export const updatedMarketingProfile: SceneView = {
  ...baseMarketingProfile,
  identity: { ...baseMarketingProfile.identity, headline: "Senior Brand Designer" },
  blocks: baseMarketingProfile.blocks.map(block =>
    block.type === "link" && block.id === "portfolio" ? { ...block, label: "Latest case study" } : block
  ),
};
