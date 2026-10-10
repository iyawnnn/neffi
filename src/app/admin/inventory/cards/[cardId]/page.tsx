import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { env } from "@/config/env";
import { db } from "@/db";
import { eligibleGrcItems } from "@/modules/cards/grc";
import { cardUrl } from "@/modules/cards/token";
import { getCardDetail } from "@/modules/inventory/queries";
import { MatchPackageForm, NfcCheckForm, ProvisionForm, ReplaceForm, ReserveForm, RetireForm } from "../../forms";
import { dateTime, KIND_LABEL, STATE_LABEL } from "../../format";

export const instant = false;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

export default async function CardPage({ params }: PageProps<"/admin/inventory/cards/[cardId]">) {
  await requireOwner();
  const { cardId } = await params;
  if (!z.uuid().safeParse(cardId).success) notFound();
  const card = await getCardDetail(db, cardId);
  if (!card) notFound();

  const isDbc = card.kind === "dbc" && card.publicToken;
  const blank = card.state === "blank";
  const dbcUri = card.publicToken ? cardUrl(env.cardUrlOrigin, card.publicToken) : null;
  const canProvision = blank && card.kind !== "grc" && !card.publicToken;
  const canReserve = blank && card.kind !== "dbc";
  const reservedGrc = card.kind === "grc" && card.state === "reserved";
  const retirable = blank || card.state === "ready" || reservedGrc;
  const eligibleItems = canReserve ? await eligibleGrcItems(db) : [];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/admin/inventory" className="text-sm underline">
        ← Inventory
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">
        {KIND_LABEL[card.kind ?? "none"]} · {STATE_LABEL[card.state]}
        {blank && card.publicToken ? " · in provisioning" : ""}
      </h1>

      <Section title="Details">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Added</dt>
          <dd>{dateTime(card.createdAt)}</dd>
          {dbcUri ? (
            <>
              <dt className="text-muted-foreground">Card URL</dt>
              <dd className="break-all font-mono text-xs">{dbcUri}</dd>
            </>
          ) : null}
          {card.orderContext ? (
            <>
              <dt className="text-muted-foreground">Order</dt>
              <dd>
                {card.orderContext.orderNumber}
                {card.orderContext.label ? ` · ${card.orderContext.label}` : ""}
              </dd>
              <dt className="text-muted-foreground">Review URL</dt>
              <dd className="break-all font-mono text-xs">{card.orderContext.reviewUrl}</dd>
            </>
          ) : null}
          {isDbc || reservedGrc ? (
            <>
              <dt className="text-muted-foreground">NFC check</dt>
              <dd>{card.nfcVerifiedAt ? dateTime(card.nfcVerifiedAt) : "Not done"}</dd>
            </>
          ) : null}
          {isDbc ? (
            <>
              <dt className="text-muted-foreground">Package match</dt>
              <dd>{card.packageMatchedAt ? dateTime(card.packageMatchedAt) : "Not done"}</dd>
              <dt className="text-muted-foreground">Credential</dt>
              <dd>
                {card.usableCredentialId ? "One unused credential" : "No usable credential"} · {card.credentialCount} issued
              </dd>
            </>
          ) : null}
        </dl>
      </Section>

      {canProvision ? (
        <Section title="Provision">
          <ProvisionForm cardId={card.id} />
        </Section>
      ) : null}

      {isDbc && blank && dbcUri && !card.nfcVerifiedAt ? (
        <Section title="Write and test the NFC tag">
          <NfcCheckForm cardId={card.id} expectedUri={dbcUri} />
        </Section>
      ) : null}

      {isDbc && blank && card.nfcVerifiedAt ? (
        <Section title="Match the package">
          <MatchPackageForm cardId={card.id} />
        </Section>
      ) : null}

      {reservedGrc && card.orderContext?.reviewUrl ? (
        <Section title="Encode and test the review link">
          <NfcCheckForm cardId={card.id} expectedUri={card.orderContext.reviewUrl} />
        </Section>
      ) : null}

      {canReserve ? (
        <Section title="Reserve for an order">
          {eligibleItems.length > 0 ? (
            <ReserveForm cardId={card.id} items={eligibleItems} />
          ) : (
            <p className="text-sm text-muted-foreground">No open Google Review Card order item needs a card right now.</p>
          )}
        </Section>
      ) : null}

      {isDbc && card.usableCredentialId && (blank || card.state === "ready") ? (
        <Section title="Replace credential">
          <ReplaceForm cardId={card.id} credentialId={card.usableCredentialId} />
        </Section>
      ) : null}

      {retirable ? (
        <Section title="Retire">
          <RetireForm cardId={card.id} />
        </Section>
      ) : null}

      <Section title="Recent activity">
        <ul className="flex flex-col gap-2 text-sm">
          {card.activity.map((event, index) => (
            <li key={index} className="flex flex-col">
              <span>
                {event.type.replaceAll("_", " ")} <span className="text-muted-foreground">· {dateTime(event.createdAt)}</span>
              </span>
              {event.note ? <span className="break-words text-xs text-muted-foreground">{event.note}</span> : null}
            </li>
          ))}
          {card.activity.length === 0 ? <li className="text-muted-foreground">Nothing recorded yet.</li> : null}
        </ul>
      </Section>
    </main>
  );
}
