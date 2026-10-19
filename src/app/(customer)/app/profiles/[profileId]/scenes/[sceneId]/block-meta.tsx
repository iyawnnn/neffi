import { BriefcaseBusiness, CalendarDays, FileText, Link2, MessageSquareText, UserRound, type LucideIcon } from "lucide-react";
import type { BlockType } from "@/modules/profiles/block-content";

// Block types the editor offers, with the label and icon an owner recognises.
export const BLOCK_META: Record<BlockType, { label: string; description: string; icon: LucideIcon }> = {
  about: { label: "About", description: "A short introduction about yourself.", icon: FileText },
  project: { label: "Project", description: "Show something you've made.", icon: BriefcaseBusiness },
  link: { label: "Link", description: "Any page you want to share.", icon: Link2 },
  contact: { label: "Save contact", description: "Let visitors save your details.", icon: UserRound },
  booking: { label: "Book a meeting", description: "Add your booking link.", icon: CalendarDays },
  form: { label: "Contact form", description: "Let visitors send you a message.", icon: MessageSquareText },
};
export function BlockTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-canvas">
      <Icon className="size-[1.125rem] text-foreground" strokeWidth={1.6} />
    </span>
  );
}
