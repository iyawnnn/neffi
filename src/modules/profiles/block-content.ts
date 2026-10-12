import { z } from "zod";
import { profileLinkType } from "@/db/schema/enums";
import { linkSchema } from "./rules";

export type BlockType = "about" | "project" | "link" | "contact" | "booking" | "form";
export const LINK_KINDS = profileLinkType.enumValues;
export type LinkKind = (typeof LINK_KINDS)[number];
export const LINK_KIND_LABELS: Record<LinkKind, string> = {
  facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn", youtube: "YouTube", github: "GitHub",
  messenger: "Messenger", whatsapp: "WhatsApp", viber: "Viber", telegram: "Telegram", x: "X", portfolio: "Portfolio",
  booking: "Booking", shop: "Shop", menu: "Menu", custom: "Other",
};

const text = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const required = linkSchema().refine((value): value is string => value !== null);
const checkbox = z.unknown().transform((value) => value === true || value === "on");

// Content is built only from these schemas: customers fill plain fields, never raw JSON.
const SCHEMAS = {
  about: z.strictObject({ text: text(1000) }),
  // prefault (not default): Zod 4 runs the missing-key value through the transforms, so absent fields become null.
  project: z.strictObject({ title: text(80), description: optional(500).prefault(""), url: linkSchema().prefault("") }),
  link: z.strictObject({ kind: z.enum(LINK_KINDS), label: optional(40).prefault(""), url: required }),
  contact: z.strictObject({ saveContact: checkbox.prefault(false) }),
  booking: z.strictObject({ label: optional(40).prefault(""), url: required }),
  form: z.strictObject({}),
} satisfies Record<BlockType, z.ZodType>;

export function parseBlockContent(type: BlockType, input: Record<string, unknown>): { ok: true; content: Record<string, unknown> } | { ok: false } {
  const result = SCHEMAS[type].safeParse(input);
  return result.success ? { ok: true, content: result.data as Record<string, unknown> } : { ok: false };
}
