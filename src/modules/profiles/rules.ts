import { z } from "zod";
import { normalizeLink } from "@/lib/safe-url";

export const LIMITS = { profilesPerAccount: 10, scenesPerProfile: 5, blocksPerScene: 20, formsPerProfile: 5 } as const;

// Neffi-maintained accent swatches (Brand Identity: customer profiles keep their own colours).
export const ACCENTS = [
  { name: "Ink", hex: "#0C0C0D" },
  { name: "Ocean", hex: "#1F5FAE" },
  { name: "Teal", hex: "#0E7C86" },
  { name: "Forest", hex: "#2E6B4F" },
  { name: "Amber", hex: "#B86E00" },
  { name: "Vermilion", hex: "#E64A35" },
  { name: "Rose", hex: "#B83A6B" },
  { name: "Plum", hex: "#6B3FA0" },
] as const;

const optional = (max: number) => z.string().trim().max(max).transform((value) => value || null);
export const phoneSchema = optional(30).refine((value) => value === null || /^\+?[0-9 ()-]{7,20}$/.test(value));
export const emailSchema = optional(254)
  .transform((value) => value?.toLowerCase() ?? null)
  .refine((value) => value === null || z.email().safeParse(value).success);
export const linkSchema = (max = 2048) =>
  optional(max).transform((value, ctx) => {
    if (value === null) return null;
    const link = normalizeLink(value);
    if (!link) ctx.addIssue({ code: "custom", message: "link" });
    return link;
  });

export const identitySchema = z.object({
  fullName: z.string().trim().min(1).max(80),
  headline: optional(80),
  company: optional(80),
  bio: optional(300),
  phone: phoneSchema,
  email: emailSchema,
  website: linkSchema(),
  location: optional(80),
});
export type Identity = z.infer<typeof identitySchema>;

export type PublishGap = "name" | "contact" | "content";
export const PUBLISH_GAP_COPY: Record<PublishGap, string> = {
  name: "Add your full name.",
  contact: "Add a phone number, email or website so people can reach you.",
  content: "Show at least one item in your main scene.",
};

export function publishGaps(p: { fullName: string | null; phone: string | null; email: string | null; website: string | null; visibleDefaultBlocks: number }): PublishGap[] {
  const gaps: PublishGap[] = [];
  if (!p.fullName) gaps.push("name");
  if (!p.phone && !p.email && !p.website) gaps.push("contact");
  if (p.visibleDefaultBlocks < 1) gaps.push("content");
  return gaps;
}
