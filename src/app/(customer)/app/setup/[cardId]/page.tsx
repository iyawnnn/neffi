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
    <main className="flex flex-1 flex-col items-center gap-6 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <p className="text-sm text-muted-foreground">Set up your Neffi ending in {card.publicToken.slice(-4)}</p>
        {isPurpose(purpose) ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Your essentials</h1>
            <EssentialsForm cardId={card.id} purpose={purpose} linkLabel={PURPOSES[purpose].linkLabel} defaultEmail={viewer.email} />
          </>
        ) : profiles.length && first(query.step) !== "purpose" ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Show one of your profiles on this card</h1>
            {profiles.map(profile => (
              <form key={profile.id} action={chooseProfileAction}>
                <input type="hidden" name="cardId" value={card.id} />
                <input type="hidden" name="profileId" value={profile.id} />
                <Button type="submit" size="touch" className="w-full">Use {profile.fullName ?? "Untitled profile"}</Button>
              </form>
            ))}
            <Link href="?step=purpose" className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">Create a new profile</Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">What do you want your Neffi to help you do?</h1>
            {Object.entries(PURPOSES).map(([key, option]) => (
              <Link key={key} href={`?purpose=${key}`} className="flex min-h-11 flex-col rounded-lg border p-4">
                <span className="font-medium">{option.label}</span>
                <span className="text-sm text-muted-foreground">{option.description}</span>
              </Link>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
