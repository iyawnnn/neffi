import Link from "next/link";
import { connection } from "next/server";
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

function Section({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "next" | "danger" }) {
  return (
    <section className={`flex flex-col gap-3 ${tone === "next" ? "rounded-lg border border-primary p-5" : tone === "danger" ? "rounded-lg border border-destructive p-4" : "border-t pt-5"}`}>
      <h2 className={`text-base font-semibold ${tone === "danger" ? "text-destructive" : ""}`}>{title}</h2>
      {children}
    </section>
  );
}

export default async function CardPage({ params }: PageProps<"/admin/inventory/cards/[cardId]">) {
  await requireOwner();
  await connection();
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
    <main data-admin-section="inventory" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/admin/inventory" className="text-sm underline">
        ← Inventory
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{KIND_LABEL[card.kind ?? "none"]}</h1>
        <p className="text-lg font-medium">{blank && card.publicToken ? "In provisioning" : STATE_LABEL[card.state]}</p>
        <p className="break-all font-mono text-xs text-muted-foreground">Card ID: {card.id}</p>
      </header>

      {card.kind === "dbc" ? (
        <Section title="Provisioning progress">
          <ol className="grid gap-2 text-sm sm:grid-cols-2">
            {[
              { label: "Card provisioned", complete: Boolean(card.publicToken) },
              { label: "NFC written/tested", complete: Boolean(card.nfcVerifiedAt) },
              { label: "Activation package matched", complete: Boolean(card.packageMatchedAt) },
              { label: "Ready for sale", complete: ["ready", "reserved", "released"].includes(card.state) },
            ].map((step) => (
              <li key={step.label} className="flex items-start justify-between gap-3">
                <span>{step.label}</span>
                <span className={step.complete ? "font-medium" : "text-muted-foreground"}>
                  {step.complete ? "Complete" : card.state === "retired" ? "Not applicable" : "Pending"}
                </span>
              </li>
            ))}
          </ol>
          {card.state === "retired" ? <p className="text-sm text-muted-foreground">This card is retired and cannot be sold.</p> : null}
        </Section>
      ) : null}

      <ProvisionForm key={card.id} cardId={card.id} available={canProvision} />

      {isDbc && blank && dbcUri && !card.nfcVerifiedAt ? (
        <Section title="Next step" tone="next">
          <h3 className="font-medium">Physical NFC check</h3>
          <div className="text-sm">
            <p className="font-medium">Waiting for physical card</p>
            <p>You can leave this card here and continue when the NFC card is available.</p>
          </div>
          <NfcCheckForm cardId={card.id} expectedUri={dbcUri} />
        </Section>
      ) : null}

      {isDbc && blank && card.nfcVerifiedAt ? (
        <Section title="Next step" tone="next">
          <h3 className="font-medium">Match the activation package</h3>
          <MatchPackageForm cardId={card.id} />
        </Section>
      ) : null}

      {reservedGrc && card.orderContext?.reviewUrl ? (
        <Section title="Next step" tone="next">
          <h3 className="font-medium">Physical NFC check</h3>
          <NfcCheckForm cardId={card.id} expectedUri={card.orderContext.reviewUrl} />
        </Section>
      ) : null}

      {canReserve ? (
        <Section title="Next step" tone="next">
          <h3 className="font-medium">Reserve for an order</h3>
          {eligibleItems.length > 0 ? (
            <ReserveForm cardId={card.id} items={eligibleItems} />
          ) : (
            <p className="text-sm text-muted-foreground">No open Google Review Card order item needs a card right now.</p>
          )}
        </Section>
      ) : null}

      <Section title="Card details">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Added</dt>
          <dd>{dateTime(card.createdAt)}</dd>
          {card.purchaser ? <><dt className="text-muted-foreground">Purchaser</dt><dd><Link className="underline" href={`/admin/customers/purchasers/${card.purchaser.id}`}>{card.purchaser.name}</Link></dd></> : null}
          {card.owningAccount ? <><dt className="text-muted-foreground">Owning Account</dt><dd className="break-all"><Link className="underline" href={`/admin/customers/accounts/${card.owningAccountId}`}>{card.owningAccount.email}</Link></dd></> : null}
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
                {card.orderContext.orderId ? <Link className="underline" href={`/admin/orders/${card.orderContext.orderId}`}>{card.orderContext.orderNumber}</Link> : card.orderContext.orderNumber}
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
      {isDbc && card.usableCredentialId && (blank || card.state === "ready") ? (
        <Section title="Credential recovery">
          <ReplaceForm cardId={card.id} credentialId={card.usableCredentialId} />
        </Section>
      ) : null}

      {retirable ? (
        <Section title="Danger zone" tone="danger">
          <RetireForm cardId={card.id} />
        </Section>
      ) : null}

    </main>
  );
}
