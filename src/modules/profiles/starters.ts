import { z } from "zod";
import type { Preset } from "../forms/config";
import type { BlockType } from "./block-content";
import { emailSchema, linkSchema, phoneSchema } from "./rules";
import type { Purpose } from "./purpose-options";

// Onboarding recipes only: they seed the first Scene and are never stored (Locked Plan: Starter Experience is not an object).
export { isPurpose, PURPOSES, type Purpose } from "./purpose-options";

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
