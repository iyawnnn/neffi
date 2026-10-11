import Link from "next/link";
import { requireAccount } from "@/auth/access";
import { authErrorMessage } from "@/auth/messages";
import { getLinkedMethods } from "@/auth/methods";
import { db } from "@/db";
import { ownedCards } from "@/modules/cards/owned";
import { AccountActions } from "./account-actions";

export const instant = false;

export default async function CustomerHome({ searchParams }: PageProps<"/app">) {
  const viewer = await requireAccount("/app");
  const [methods, params, cards] = await Promise.all([getLinkedMethods(), searchParams, ownedCards(db, viewer.accountId)]);
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
            {/* M6 turns each item into the entry of its guided setup. */}
            {waiting.map((card) => (
              <li key={card.id}>Neffi ending in {card.publicToken.slice(-4)} — waiting for setup</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="flex w-full max-w-sm flex-col gap-2 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Signed in as</h2>
        <p className="break-all">{viewer.email}</p>
        <h2 className="mt-2 text-sm font-medium">Sign-in methods</h2>
        <ul className="text-sm text-muted-foreground">
          <li>Email code</li>
          {methods.google ? <li>Google</li> : null}
        </ul>
      </section>
      <AccountActions googleLinked={methods.google} />
      {cards.length ? null : <p className="max-w-sm text-center text-sm text-muted-foreground">Your cards and profiles will appear here.</p>}
      <Link href="/activate" className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">
        {cards.length ? "Activate another Neffi" : "Activate a Neffi"}
      </Link>
    </main>
  );
}
