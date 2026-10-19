import { z } from "zod";
import { LINK_KINDS } from "./block-options";
import { linkSchema } from "./rules";

export type BlockType = "about" | "project" | "link" | "contact" | "booking" | "form";
export { LINK_KINDS, LINK_KIND_LABELS, type LinkKind } from "./block-options";

const text = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const required = linkSchema().refine((value): value is string => value !== null);
const checkbox = z.unknown().transform((value) => value === true || value === "on");

// Content is built only from these schemas: customers fill plain fields, never raw JSON.
export const BLOCK_CONTENT_SCHEMAS = {
  about: z.strictObject({ text: text(1000) }),
  // prefault (not default): Zod 4 runs the missing-key value through the transforms, so absent fields become null.
  project: z.strictObject({ title: text(80), description: optional(500).prefault(""), url: linkSchema().prefault("") }),
  link: z.strictObject({ kind: z.enum(LINK_KINDS), label: optional(40).prefault(""), url: required }),
  contact: z.strictObject({ saveContact: checkbox.prefault(false) }),
  booking: z.strictObject({ label: optional(40).prefault(""), url: required }),
  form: z.strictObject({}),
} satisfies Record<BlockType, z.ZodType>;

export function parseBlockContent(type: BlockType, input: Record<string, unknown>): { ok: true; content: Record<string, unknown> } | { ok: false } {
  const result = BLOCK_CONTENT_SCHEMAS[type].safeParse(input);
  return result.success ? { ok: true, content: result.data as Record<string, unknown> } : { ok: false };
}
