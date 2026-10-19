import { notFound } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { env } from "@/config/env";
import { db } from "@/db";
import { getOwnedCard } from "@/modules/cards/manage";
import { qrSvgDataUri } from "@/modules/cards/qr";
import { cardUrl } from "@/modules/cards/token";
import { ownedProfiles } from "@/modules/profiles/profiles";
import { CardEditor } from "./card-editor";

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
    <CardEditor
      card={card}
      profiles={profiles}
      url={url}
      qr={qr}
    />
  );
}
