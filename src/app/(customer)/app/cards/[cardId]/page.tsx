import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { env } from "@/config/env";
import { db } from "@/db";
import { getOwnedCard } from "@/modules/cards/manage";
import { qrSvgDataUri } from "@/modules/cards/qr";
import { cardUrl } from "@/modules/cards/token";
import { ownedProfiles } from "@/modules/profiles/profiles";
import { connectCardAction, setCardDisabledAction } from "../actions";

export const instant = false;

export default async function CardPage({ params }: PageProps<"/app/cards/[cardId]">) {
  const viewer = await requireAccount("/app");
  const { cardId } = await params;
  const card = await getOwnedCard(db, viewer.accountId, cardId);
  if (!card) notFound();
  const profiles = await ownedProfiles(db, viewer.accountId);
  const url = cardUrl(env.cardUrlOrigin, card.publicToken);
  const qr = card.profileId ? qrSvgDataUri(url) : null;
  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-4 py-10"><div className="flex w-full max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Neffi ending in {card.suffix}</h1>
      <Link href={`/support?cardId=${card.id}`} className="flex min-h-11 items-center underline">Get help with this Card</Link>
      {card.profileId ? <form action={async data => { "use server"; await connectCardAction(undefined, data); }} className="flex flex-col gap-3">
        <input type="hidden" name="cardId" value={card.id} />
        <label className="flex flex-col gap-1 text-sm font-medium">Shows<select name="profileId" className={inputClass} defaultValue={card.profileId}>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.fullName ?? "Untitled profile"}</option>)}</select></label>
        <Button type="submit" size="touch">Save</Button>
      </form> : <Link href={`/app/setup/${card.id}`} className="inline-flex min-h-11 items-center underline underline-offset-4">Set up this Neffi</Link>}
      <form action={async data => { "use server"; await setCardDisabledAction(undefined, data); }} className="flex flex-col gap-3">
        <input type="hidden" name="cardId" value={card.id} /><input type="hidden" name="disabled" value={String(!card.disabled)} />
        {!card.disabled ? <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" required />When it&apos;s off, tapping it won&apos;t show your profile.</label> : null}
        <Button type="submit" size="touch" variant="outline">{card.disabled ? "Turn on this card" : "Turn off this card"}</Button>
      </form>
      {qr ? <section className="flex flex-col gap-3"><h2 className="font-semibold">Share your Neffi</h2><img src={qr} alt="QR code for your Neffi link" width={240} height={240} className="size-60" /><Link href={url} className="inline-flex min-h-11 items-center break-all text-sm underline underline-offset-4">{url}</Link><a href={qr} download="neffi-qr.svg" className="inline-flex min-h-11 items-center underline underline-offset-4">Download QR code</a><p className="text-sm text-muted-foreground">Anyone who scans this opens the same page as tapping your card.</p></section> : null}
    </div></main>
  );
}
