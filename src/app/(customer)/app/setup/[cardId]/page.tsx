import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { ownedCards } from "@/modules/cards/owned";
import { ownedProfiles } from "@/modules/profiles/profiles";
import { isPurpose, PURPOSES } from "@/modules/profiles/starters";
import { chooseProfileAction } from "./actions";
import { EssentialsForm } from "./setup-forms";
import { SetupView } from "./setup-view";

export const instant = false;

export default async function SetupPage({ params, searchParams }: PageProps<"/app/setup/[cardId]">) {
  const viewer = await requireAccount("/app");
  const [{ cardId }, query] = await Promise.all([params, searchParams]);
  const card = (await ownedCards(db, viewer.accountId)).find((owned) => owned.id === cardId);
  if (!card) notFound();
  if (card.profileId) redirect(`/app/profiles/${card.profileId}`);
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const purpose = first(query.purpose);
  const profiles = await ownedProfiles(db, viewer.accountId);

  return (
    <SetupView suffix={card.publicToken.slice(-4)} purpose={purpose}>
      {isPurpose(purpose) ? (
        <EssentialsForm cardId={card.id} purpose={purpose} linkLabel={PURPOSES[purpose].linkLabel} defaultEmail={viewer.email} />
      ) : profiles.length && first(query.step) !== "purpose" ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Show one of your profiles on this card</h1>
          {profiles.map(profile => (
            <form key={profile.id} action={chooseProfileAction}>
              <input type="hidden" name="cardId" value={card.id} />
              <input type="hidden" name="profileId" value={profile.id} />
              <Button type="submit" variant="action" size="touch" className="h-12 w-full">Use {profile.fullName ?? "Untitled profile"}</Button>
            </form>
          ))}
          <Link href="?step=purpose" className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">Create a new profile</Link>
        </>
      ) : null}
    </SetupView>
  );
}
