import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Circle, CircleCheck, Download, LifeBuoy, Minus } from "lucide-react";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { buttonVariants } from "@/components/ui/button";
import { env } from "@/config/env";
import { db } from "@/db";
import { eligibleGrcItems } from "@/modules/cards/grc";
import { qrSvgDataUri } from "@/modules/cards/qr";
import { cardUrl } from "@/modules/cards/token";
import { CardUrl } from "../../card-url";
import { getCardDetail } from "@/modules/inventory/queries";
import { adminPage, cardTone, DangerZone, DetailList, inlineLink, LinkButton, NextStep, PageHeader, Panel, Section, Status } from "../../../ui";
import { MatchPackageForm, NfcCheckForm, ProvisionForm, ReplaceForm, ReserveForm, RetireForm } from "../../forms";
import { dateTime, KIND_LABEL, STATE_LABEL } from "../../format";

export const instant = false;

const textLink = inlineLink;

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
  const provisioning = blank && Boolean(card.publicToken);
  // The card-back sticker: the same customer-side QR helper over the exact URL written to NFC. A retired card's URL
  // is permanently unavailable, so there is nothing to print.
  const sharingQr = isDbc && dbcUri && card.state !== "retired" ? qrSvgDataUri(dbcUri) : null;

  return (
    <main data-admin-section="inventory" className={adminPage}>
      <PageHeader
        back={{ href: "/admin/inventory", label: "Inventory" }}
        title={KIND_LABEL[card.kind ?? "none"]}
        description={
          <span className="flex flex-col gap-1.5">
            <Status tone={cardTone(card.state, provisioning)}>{provisioning ? "In provisioning" : STATE_LABEL[card.state]}</Status>
            <span className="font-mono text-label break-all">Card ID: {card.id}</span>
          </span>
        }
        actions={
          <LinkButton icon={LifeBuoy} href={`/admin/support/new?${new URLSearchParams({ cardId: card.id, ...(card.orderContext?.orderId ? { orderId: card.orderContext.orderId } : {}), ...(card.owningAccountId ? { accountId: card.owningAccountId } : {}), ...(card.purchaser ? { purchaserId: card.purchaser.id } : {}) })}`}>Open support case</LinkButton>
        }
      />

      {card.kind === "dbc" ? (
        <Section title="Provisioning progress" description={card.state === "retired" ? "This card is retired and cannot be sold." : undefined}>
          <Panel>
            <ol className="divide-y">
              {[
                { label: "Card provisioned", complete: Boolean(card.publicToken) },
                { label: "NFC written/tested", complete: Boolean(card.nfcVerifiedAt) },
                { label: "Activation package matched", complete: Boolean(card.packageMatchedAt) },
                { label: "Ready for sale", complete: ["ready", "reserved", "released"].includes(card.state) },
              ].map((step) => {
                const Icon = step.complete ? CircleCheck : card.state === "retired" ? Minus : Circle;
                return (
                  <li key={step.label} className="flex items-center gap-3 px-4 sm:px-5 py-3 text-body">
                    <Icon aria-hidden className={`size-4 shrink-0 ${step.complete ? "text-emerald-600" : "text-fg-faint"}`} />
                    <span className="min-w-0 flex-1">{step.label}</span>
                    <span className={step.complete ? "font-medium" : "text-fg-secondary"}>{step.complete ? "Complete" : card.state === "retired" ? "Not applicable" : "Pending"}</span>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </Section>
      ) : null}

      <ProvisionForm key={card.id} cardId={card.id} available={canProvision} />

      {isDbc && blank && dbcUri && !card.nfcVerifiedAt ? (
        <NextStep title="Next step">
          <h3 className="text-body font-medium">Physical NFC check</h3>
          <div className="text-body">
            <p className="font-medium">Waiting for physical card</p>
            <p className="text-fg-secondary">You can leave this card here and continue when the NFC card is available.</p>
          </div>
          <div className="max-w-xl"><NfcCheckForm cardId={card.id} expectedUri={dbcUri} /></div>
        </NextStep>
      ) : null}

      {isDbc && blank && card.nfcVerifiedAt ? (
        <NextStep title="Next step">
          <h3 className="text-body font-medium">Match the activation package</h3>
          <div className="max-w-xl"><MatchPackageForm cardId={card.id} /></div>
        </NextStep>
      ) : null}

      {reservedGrc && card.orderContext?.reviewUrl ? (
        <NextStep title="Next step">
          <h3 className="text-body font-medium">Physical NFC check</h3>
          <div className="max-w-xl"><NfcCheckForm cardId={card.id} expectedUri={card.orderContext.reviewUrl} /></div>
        </NextStep>
      ) : null}

      {canReserve ? (
        <NextStep title="Next step">
          <h3 className="text-body font-medium">Reserve for an order</h3>
          {eligibleItems.length > 0 ? (
            <div className="max-w-xl"><ReserveForm cardId={card.id} items={eligibleItems} /></div>
          ) : (
            <p className="text-meta text-fg-secondary">No open Google Review Card order item needs a card right now.</p>
          )}
        </NextStep>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-8">
        <Section title="Card details">
          <Panel padded className="flex flex-col gap-5">
            <DetailList
              rows={[
                ["Added", dateTime(card.createdAt)],
                dbcUri ? ["Card URL", <span key="url" className="font-mono text-meta break-all">{dbcUri}</span>] : null,
              ]}
            />
            {sharingQr && dbcUri ? (
              <div className="flex flex-col gap-3 border-t pt-5">
                <h3 className="text-body font-medium">Sharing QR</h3>
                <p className="text-meta text-fg-secondary">Print this on the sticker for the back of the card. It opens the same URL as the NFC tag, never the activation page.</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sharingQr} alt="Sharing QR for this card" width={160} height={160} className="size-40 self-start rounded-lg border bg-white p-2" />
                <a href={sharingQr} download={`neffi-sharing-qr-${card.publicToken}.svg`} className={`${buttonVariants({ variant: "outline", size: "touch" })} gap-2 self-start md:h-9`}>
                  <Download aria-hidden className="size-4" />
                  Download QR (SVG)
                </a>
                <CardUrl url={dbcUri} />
              </div>
            ) : null}
            {card.purchaser || card.owningAccount || card.orderContext ? (
              <div className="border-t pt-5">
                <DetailList
                  rows={[
                    card.purchaser ? ["Purchaser", <Link key="p" className={textLink} href={`/admin/customers/purchasers/${card.purchaser.id}`}>{card.purchaser.name}</Link>] : null,
                    card.owningAccount ? ["Owning Account", <Link key="a" className={textLink} href={`/admin/customers/accounts/${card.owningAccountId}`}>{card.owningAccount.email}</Link>] : null,
                    card.orderContext ? ["Order", <span key="o">{card.orderContext.orderId ? <Link className={textLink} href={`/admin/orders/${card.orderContext.orderId}`}>{card.orderContext.orderNumber}</Link> : card.orderContext.orderNumber}{card.orderContext.label ? ` · ${card.orderContext.label}` : ""}</span>] : null,
                    card.orderContext ? ["Review URL", <span key="r" className="font-mono text-meta break-all">{card.orderContext.reviewUrl}</span>] : null,
                  ]}
                />
              </div>
            ) : null}
            {isDbc || reservedGrc ? (
              <div className="border-t pt-5">
                <DetailList
                  rows={[
                    ["NFC check", card.nfcVerifiedAt ? dateTime(card.nfcVerifiedAt) : "Not done"],
                    isDbc ? ["Package match", card.packageMatchedAt ? dateTime(card.packageMatchedAt) : "Not done"] : null,
                    isDbc ? ["Credential", `${card.usableCredentialId ? "One unused credential" : "No usable credential"} · ${card.credentialCount} issued`] : null,
                  ]}
                />
              </div>
            ) : null}
          </Panel>
        </Section>

        <Section title="Recent activity">
          <Panel>
            <ul className="divide-y">
              {card.activity.map((event, index) => (
                <li key={index} className="flex flex-col gap-0.5 px-4 sm:px-5 py-3 text-body">
                  <span className="font-medium">{event.type.replaceAll("_", " ")}</span>
                  <span className="text-meta text-fg-secondary tabular-nums">{dateTime(event.createdAt)}</span>
                  {event.note ? <span className="text-meta break-words text-fg-secondary">{event.note}</span> : null}
                </li>
              ))}
              {card.activity.length === 0 ? <li className="px-4 sm:px-5 py-4 text-meta text-fg-secondary">Nothing recorded yet.</li> : null}
            </ul>
          </Panel>
        </Section>
      </div>

      {isDbc && card.usableCredentialId && (blank || card.state === "ready") ? (
        <Section title="Credential recovery">
          <Panel padded className="max-w-xl"><ReplaceForm cardId={card.id} credentialId={card.usableCredentialId} /></Panel>
        </Section>
      ) : null}

      {retirable ? (
        <DangerZone>
          <div className="max-w-xl"><RetireForm cardId={card.id} /></div>
        </DangerZone>
      ) : null}
    </main>
  );
}
