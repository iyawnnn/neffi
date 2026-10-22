import type { SceneView } from "@/modules/profiles/scene-view";
import { LINK_KINDS, LINK_KIND_LABELS } from "@/modules/profiles/block-options";

// Synthetic data for local visual review; never reads or seeds a database.
export const profileFixture: SceneView = {
  appearance: { layout: "classic", mode: "light", accent: "#0C0C0D", cover: null },
  identity: {
    fullName: "Ana Reyes", initials: "AR", headline: "Independent designer & developer",
    company: "Reyes Studio", location: "Cebu City", bio: "Thoughtful websites for people building something of their own.",
    phone: "+63 917 000 0000", email: "ana@example.invalid", website: "https://example.invalid",
    accent: "#0C0C0D", onAccent: "#FFFFFF", image: null,
  },
  scene: { id: "fixture-scene", name: "Main" },
  blocks: [
    { id: "contact", type: "contact", saveContact: true, phone: "+63 917 000 0000", email: "ana@example.invalid", website: "https://example.invalid", location: "Cebu City" },
    { id: "booking", type: "booking", label: "Let's talk about your project", url: "https://example.invalid/booking" },
    ...(["linkedin", "instagram", "github", "behance"] as const).map(kind => ({ id: kind, type: "link" as const, kind, label: LINK_KIND_LABELS[kind], url: `https://example.invalid/${kind}` })),
    { id: "portfolio", type: "link", kind: "portfolio", label: "Selected work", url: "https://example.invalid/work" },
    { id: "notes", type: "link", kind: "custom", label: "Notes on design & the everyday", url: "https://example.invalid/notes" },
    { id: "project", type: "project", title: "A home for independent ideas", description: "Brand direction and a new website for a small creative studio. Clear, considered, and built to grow.", url: "https://example.invalid/project" },
    { id: "about", type: "about", text: "I partner with independent teams to turn good ideas into useful digital experiences. From the first conversation to the last detail.\n\nBased in Cebu. Working with people everywhere." },
    { id: "form", type: "form", formId: "fixture-form", title: "Have something in mind?", fields: [
      { key: "name", label: "Your name", kind: "text", required: true },
      { key: "email", label: "Email", kind: "email", required: true },
      { key: "message", label: "Message", kind: "long", required: true },
    ] },
  ],
};

export const allLinkFixtures = LINK_KINDS.map(kind => ({ id: kind, type: "link" as const, kind, label: LINK_KIND_LABELS[kind], url: `https://example.invalid/${kind}` }));
