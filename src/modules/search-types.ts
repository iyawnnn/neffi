// Plain types shared by the server search and the owner UI that renders it (no server-only code here).
export const searchTypes = ["order", "customer", "account", "card", "support", "tracking"] as const;
export type SearchType = (typeof searchTypes)[number];
export type SearchHit = { type: SearchType; id: string; title: string; subtitle: string; status: string | null; matched: string };
