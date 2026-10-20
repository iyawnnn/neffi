import { ClipboardList, IdCard, LifeBuoy, Truck, UserRound, Users, type LucideIcon } from "lucide-react";
import type { SearchHit, SearchType } from "@/modules/search-types";
import { KIND_LABEL } from "../inventory/format";
import { label } from "../ui";

// How a search hit looks and where it leads. Shared by the command palette and the /admin/search results page, so
// both describe the same record the same way.

export const hitGroups = [
  { key: "orders", heading: "Orders", types: ["order", "tracking"] as SearchType[], icon: ClipboardList },
  { key: "customers", heading: "Customers", types: ["customer", "account"] as SearchType[], icon: Users },
  { key: "cards", heading: "Cards", types: ["card"] as SearchType[], icon: IdCard },
  { key: "support", heading: "Support", types: ["support"] as SearchType[], icon: LifeBuoy },
] as const;

const icons: Record<SearchType, LucideIcon> = { order: ClipboardList, customer: UserRound, account: Users, card: IdCard, support: LifeBuoy, tracking: Truck };

export function HitIcon({ type, className }: { type: SearchType; className?: string }) {
  const Icon = icons[type];
  return <Icon aria-hidden className={className} />;
}

export function hitKey(hit: SearchHit) {
  return JSON.stringify([hit.type, hit.id, hit.title]);
}

export function hitHref({ type, id }: Pick<SearchHit, "type" | "id">) {
  switch (type) {
    case "order":
    case "tracking": return `/admin/orders/${id}`;
    case "customer": return `/admin/customers/purchasers/${id}`;
    case "account": return `/admin/customers/accounts/${id}`;
    case "card": return `/admin/inventory/cards/${id}`;
    case "support": return `/admin/support/${id}`;
  }
}

/** Two display lines and the status word for a hit. Card references show only the last four characters. */
export function describeHit(hit: SearchHit): { title: string; subtitle: string; status: string | null } {
  switch (hit.type) {
    case "card": return { title: `•••• ${hit.title}`, subtitle: KIND_LABEL[hit.subtitle as keyof typeof KIND_LABEL] ?? "Card", status: hit.status ? label(hit.status) : null };
    case "support": return { title: hit.title, subtitle: label(hit.subtitle), status: hit.status ? label(hit.status) : null };
    case "account": return { title: hit.title, subtitle: `Neffi account · ${label(hit.subtitle)}`, status: null };
    case "order": return { title: hit.title, subtitle: hit.subtitle, status: hit.status ? label(hit.status) : null };
    default: return { title: hit.title, subtitle: hit.subtitle, status: null };
  }
}
