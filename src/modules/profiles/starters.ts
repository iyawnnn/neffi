import { z } from "zod";
import type { Preset } from "../forms/config";
import type { BlockType } from "./block-content";
import { emailSchema, linkSchema, phoneSchema } from "./rules";

// Onboarding recipes only: they seed the first Scene and are never stored (Locked Plan: Starter Experience is not an object).
export type Purpose = "network" | "get_clients" | "show_my_work";
export const PURPOSES: Record<Purpose, { label: string; description: string; sceneName: string; linkLabel: string }> = {
  network: { label: "Network", description: "Share your contact details and stay in touch.", sceneName: "Networking", linkLabel: "LinkedIn or main profile link" },
  get_clients: { label: "Get Clients", description: "Show what you offer and make it easy to reach you.", sceneName: "Clients", linkLabel: "Booking link" },
  show_my_work: { label: "Show My Work", description: "Show your projects and where to see more.", sceneName: "My work", linkLabel: "Portfolio link" },
};
export const isPurpose = (value: unknown): value is Purpose => typeof value === "string" && Object.hasOwn(PURPOSES, value);

const optional = (max: number) => z.string().trim().max(max).transform((value) => value || null);
export const essentialsSchema = z.object({
  fullName: z.string().trim().min(1).max(80),
  headline: optional(80),
  bio: optional(300),
  email: emailSchema,
  phone: phoneSchema,
  link: linkSchema(),
});
export type Essentials = z.infer<typeof essentialsSchema>;

export type BlockSeed = { type: BlockType; content: Record<string, unknown>; preset?: Preset };

const contact: BlockSeed = { type: "contact", content: { saveContact: true } };
const about = (e: Essentials): BlockSeed[] => (e.bio ? [{ type: "about", content: { text: e.bio } }] : []);
const linkTo = (kind: string, url: string | null): BlockSeed[] => (url ? [{ type: "link", content: { kind, label: null, url } }] : []);

// No empty placeholder blocks: anything the customer did not provide is suggested later in the Scene editor.
export function starterBlocks(purpose: Purpose, e: Essentials): BlockSeed[] {
  if (purpose === "network") {
    const kind = e.link && new URL(e.link).hostname.endsWith("linkedin.com") ? "linkedin" : "custom";
    return [contact, ...linkTo(kind, e.link), ...about(e), { type: "form", content: {}, preset: "connect" }];
  }
  if (purpose === "get_clients") {
    const booking: BlockSeed[] = e.link ? [{ type: "booking", content: { label: null, url: e.link } }] : [];
    return [...about(e), ...booking, { type: "form", content: {}, preset: "project_inquiry" }, contact];
  }
  return [...about(e), ...linkTo("portfolio", e.link), contact];
}
