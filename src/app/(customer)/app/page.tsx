import Link from "next/link";
import { requireAccount } from "@/auth/access";
import { authErrorMessage } from "@/auth/messages";
import { db } from "@/db";
import { ownedCards } from "@/modules/cards/owned";
import { unreadCount } from "@/modules/forms/submissions";
import { ownedProfiles } from "@/modules/profiles/profiles";

export const instant = false;

export default async function CustomerHome({ searchParams }: PageProps<"/app">) {
  const viewer = await requireAccount("/app");
  const [params, cards, profiles, unread] = await Promise.all([searchParams, ownedCards(db, viewer.accountId), ownedProfiles(db, viewer.accountId), unreadCount(db, viewer.accountId)]);
  const waiting = cards.filter((card) => !card.profileId);
  const added = (Array.isArray(params.added) ? params.added[0] : params.added) === "1";
  const error = authErrorMessage(Array.isArray(params.error) ? params.error[0] : params.error);

  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Your Neffi</h1>
      {error ? (
        <p role="alert" className="max-w-sm rounded-lg bg-muted px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}
      {added ? (
        <p role="status" className="max-w-sm rounded-lg bg-muted px-3 py-2 text-sm">
          Your Neffi has been added to your account. Next, you&apos;ll set it up.
        </p>
      ) : null}
      {waiting.length ? (
        <section className="flex w-full max-w-sm flex-col gap-2 rounded-lg border p-4">
          <h2 className="text-sm font-medium">Ready to set up</h2>
          <ul className="text-sm">
            {waiting.map((card) => (
              <li key={card.id}>
                <Link href={`/app/setup/${card.id}`} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">
                  Set up Neffi ending in {card.publicToken.slice(-4)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {unread ? <Link href="/app/inbox" className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">{unread} new {unread === 1 ? "message" : "messages"}</Link> : null}
      {profiles.length ? <section className="flex w-full max-w-sm flex-col gap-2 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Your profiles</h2>
        <ul className="flex flex-col gap-3 text-sm">{profiles.map(profile => <li key={profile.id}>
          <Link href={`/app/profiles/${profile.id}`} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">{profile.fullName ?? "Your profile"}</Link>
          <p className="text-muted-foreground">{profile.status === "draft" ? "Draft" : profile.status === "published" ? "Published" : "Unpublished"}</p>
          {profile.status === "draft" ? <Link href={`/app/profiles/${profile.id}/publish`} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">Preview and publish {profile.fullName ?? "your profile"}</Link> : null}
        </li>)}</ul>
      </section> : null}
      {cards.length || profiles.length ? null : <p className="max-w-sm text-center text-sm text-muted-foreground">Your cards and profiles will appear here.</p>}
      <Link href="/activate" className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">
        {cards.length ? "Activate another Neffi" : "Activate a Neffi"}
      </Link>
    </main>
  );
}
