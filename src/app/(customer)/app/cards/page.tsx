import Link from "next/link";
import { requireAccount } from "@/auth/access";
import { db } from "@/db";
import { cardSummaries } from "@/modules/cards/manage";

export const instant = false;

export default async function CardsPage() {
  const viewer = await requireAccount("/app");
  const cards = await cardSummaries(db, viewer.accountId);
  return <main className="flex flex-1 flex-col items-center gap-6 px-4 py-10"><div className="flex w-full max-w-sm flex-col gap-4"><h1 className="text-2xl font-semibold tracking-tight">Cards</h1><ul className="flex flex-col gap-3">{cards.map(card => <li key={card.id}><Link href={`/app/cards/${card.id}`} className="flex min-h-11 flex-col gap-1 rounded-xl border p-4"><span className="font-medium">Neffi ending in {card.suffix}</span><span className="text-sm text-muted-foreground">{card.profileId ? `Shows ${card.profileName ?? "Untitled profile"}` : "Not set up yet"}</span>{card.disabled ? <span className="text-sm">Turned off</span> : null}</Link></li>)}</ul></div></main>;
}
