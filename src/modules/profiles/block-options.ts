import { PLATFORMS } from "./platform-registry";
import type { blockType, profileLinkType } from "@/db/schema/enums";

export type LinkKind = (typeof profileLinkType.enumValues)[number];
export const LINK_KINDS = Object.keys(PLATFORMS) as LinkKind[];
export const LINK_KIND_LABELS = Object.fromEntries(Object.entries(PLATFORMS).map(([kind, metadata]) => [kind, metadata.publicLabel ?? metadata.label])) as Record<LinkKind, string>;

// How the scene editor groups blocks.
export const BLOCK_SECTIONS = { links: ["link"], content: ["about", "project"], actions: ["contact", "booking", "form"] } as const satisfies Record<string, readonly (typeof blockType.enumValues)[number][]>;
export type BlockSection = keyof typeof BLOCK_SECTIONS;
