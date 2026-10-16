import { profileLinkType } from "@/db/schema/enums";

export const LINK_KINDS = profileLinkType.enumValues;
export type LinkKind = (typeof LINK_KINDS)[number];
export const LINK_KIND_LABELS: Record<LinkKind, string> = {
  facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn", youtube: "YouTube", github: "GitHub",
  messenger: "Messenger", whatsapp: "WhatsApp", viber: "Viber", telegram: "Telegram", x: "X", portfolio: "Portfolio",
  booking: "Booking", shop: "Shop", menu: "Menu", custom: "Other",
};
