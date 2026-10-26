import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Circle, CircleCheck, Download, LifeBuoy } from "lucide-react";
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
import { adminPage, cardTone, DangerZone, DetailList, Disclosure, inlineLink, LinkButton, NextStep, PageHeader, Panel, Section, Status } from "../../../ui";
import { MatchPackageForm, NfcCheckForm, ProvisionForm, ReplaceForm, ReserveForm, RetireForm } from "../../forms";
import { dateTime, KIND_LABEL } from "../../format";
import { ActivationCode } from "./activation-code";
import { ContinueOnPhone } from "./continue-on-phone";
import { preparationSteps, type StepCard } from "./preparation-steps";

export const instant = false;

const wrap = "break-words [overflow-wrap:anywhere]";
const STATUS: Record<string, string> = { provision: "New stock card", nfc: "In preparation", package: "In preparation", ready: "Ready", released: "With the customer", retired: "Retired" };

export default async function CardPage({ params }: PageProps<"/admin/inventory/cards/[cardId]">) {
  const { cardId } = await params;
  const valid = z.uuid().safeParse(cardId).success;
  await requireOwner(valid ? `/admin/inventory/cards/${cardId}` : undefined);
  await connection();
  if (!valid) notFound();
  const card = await getCardDetail(db, cardId);
  if (!card) notFound();

  const isDbc = card.kind === "dbc" || (card.kind === null && card.state === "blank");
  const dbcToken = isDbc && card.publicToken ? card.publicToken : null;
  const flow = preparationSteps(card as StepCard);
  const blank = card.state === "blank";
  const dbcUri = dbcToken ? cardUrl(env.cardUrlOrigin, dbcToken) : null;
  const canProvision = blank && card.kind !== "grc" && !card.publicToken;
  const canReserve = blank && card.kind !== "dbc";
  const reservedGrc = card.kind === "grc" && card.state === "reserved";
  const retirable = (isDbc && (blank || card.state === "ready" || card.state === "preparing")) || reservedGrc || (card.kind === "grc" && blank);
  const eligibleItems = canReserve ? await eligibleGrcItems(db) : [];
  const live = card.state !== "retired";
  const sharingQr = dbcUri && live ? qrSvgDataUri(dbcUri) : null;
  const phoneUrl = dbcUri && live ? `${env.cardUrlOrigin}/admin/inventory/cards/${card.id}` : null;
  const phoneQr = phoneUrl ? qrSvgDataUri(phoneUrl) : null;
  const reference = (dbcToken ?? card.id).slice(-4).toUpperCase();
  const credentialId = live && isDbc && card.state !== "released" && !card.owningAccountId ? card.usableCredentialId : null;
  const order = card.orderContext;

  return (
    <main data-admin-section="inventory" className={adminPage}>
      <PageHeader
        back={{ href: "/admin/inventory", label: "Inventory" }}
        title={isDbc && ["provision", "nfc", "package"].includes(flow.current) ? "Prepare card" : KIND_LABEL[card.kind ?? "none"]}
        description={
          <span className="flex flex-col gap-1.5">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium text-foreground">Card {reference}</span>
              <Status tone={cardTone(card.state, flow.current === "nfc" || flow.current === "package")}>{isDbc ? (card.state === "reserved" ? "Assigned to an order" : STATUS[flow.current]) : card.state === "reserved" ? "Assigned to an order" : card.state === "retired" ? "Retired" : "In stock"}</Status>
            </span>
            {order ? (
              <span className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${wrap}`}>
                {card.purchaser ? <Link className={`${inlineLink} ${wrap}`} href={`/admin/customers/purchasers/${card.purchaser.id}`}>{card.purchaser.name}</Link> : null}
                {order.orderId ? <Link className={inlineLink} href={`/admin/orders/${order.orderId}`}>Order {order.orderNumber}</Link> : <span>Order {order.orderNumber}</span>}
                {order.label ? <span>{order.label}</span> : null}
              </span>
            ) : null}
            {order?.status === "cancelled" ? <span>This order was cancelled.</span> : null}
          </span>
        }
        actions={
          <LinkButton icon={LifeBuoy} href={`/admin/support/new?${new URLSearchParams({ cardId: card.id, ...(order?.orderId ? { orderId: order.orderId } : {}), ...(card.owningAccountId ? { accountId: card.owningAccountId } : {}), ...(card.purchaser ? { purchaserId: card.purchaser.id } : {}) })}`}>Open support case</LinkButton>
        }
      />

      <ProvisionForm key={card.id} cardId={card.id} available={canProvision} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:grid-rows-[auto_1fr] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1">
          {isDbc && ["provision", "nfc", "package", "ready"].includes(flow.current) ? (
            <ol aria-label="Preparation progress" className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border bg-border sm:grid-cols-4">
              {flow.steps.map((step, index) => {
                const Icon = step.done ? CircleCheck : Circle;
                const current = !step.done && flow.steps.slice(0, index).every((earlier) => earlier.done) && ["nfc", "package", "ready"].includes(flow.current) && flow.current !== "ready";
                return (
                  <li key={step.label} aria-current={current ? "step" : undefined} className="flex items-center gap-2 bg-background px-4 py-3 text-body">
                    <Icon aria-hidden className={`size-4 shrink-0 ${step.done ? "text-emerald-600" : "text-fg-faint"}`} />
                    <span className={current ? "font-semibold" : step.done ? "" : "text-fg-secondary"}>{step.label}<span className="sr-only">{step.done ? ", done" : ""}</span></span>
                  </li>
                );
              })}
            </ol>
          ) : null}

          {flow.current === "nfc" && dbcUri ? (
            <div data-primary-task>
              <NextStep title="Write and test the NFC card">
                <p className="text-body">Take any untouched card and write this card&apos;s permanent URL. Keep this card with you until preparation is complete.</p>
                <div className="max-w-xl"><NfcCheckForm cardId={card.id} expectedUri={dbcUri} /></div>
              </NextStep>
            </div>
          ) : null}

          {flow.current === "package" ? (
            <div data-primary-task>
              <NextStep title="Confirm the package">
                <p className="text-body">NFC test confirmed. Now type the code printed on the package that goes with this card.</p>
                <div className="max-w-xl"><MatchPackageForm cardId={card.id} /></div>
                {credentialId ? <div className="max-w-xl border-t pt-4"><ActivationCode cardId={card.id} credentialId={credentialId} retrievable={card.credentialRetrievable} /></div> : null}
              </NextStep>
            </div>
          ) : null}

          {flow.current === "ready" && card.state === "reserved" && order?.orderId ? (
            <div data-primary-task>
              <NextStep title="Assigned to an order">
                <p className="text-body">This card is prepared and assigned. Deliver it from the order.</p>
                <div><LinkButton variant="action" href={`/admin/orders/${order.orderId}`}>Open Order {order.orderNumber}</LinkButton></div>
              </NextStep>
            </div>
          ) : null}

          {flow.current === "ready" && card.state === "ready" ? (
            <Panel padded><h2 className="text-section">Ready for customer</h2><p className="mt-1 text-body text-fg-secondary">Prepared and waiting for the next paid order, which assigns it automatically. No physical steps are left.</p></Panel>
          ) : null}
          {flow.current === "released" ? (
            <Panel padded><h2 className="text-section">Given to the customer</h2><p className="mt-1 text-body text-fg-secondary">The customer activates it with the code from the package. Corrections go through a support case.</p></Panel>
          ) : null}
          {flow.current === "retired" ? (
            <Panel padded><h2 className="text-section">Retired</h2><p className="mt-1 text-body text-fg-secondary">This card is retired and cannot be sold. Its history stays below.</p></Panel>
          ) : null}

          {canReserve && !canProvision ? (
            <NextStep title="Next step">
              <h3 className="text-body font-medium">Reserve for an order</h3>
              {eligibleItems.length > 0 ? (
                <div className="max-w-xl"><ReserveForm cardId={card.id} items={eligibleItems} /></div>
              ) : (
                <p className="text-meta text-fg-secondary">No open Google Review Card order item needs a card right now.</p>
              )}
            </NextStep>
          ) : null}

          {reservedGrc && order?.reviewUrl ? (
            <NextStep title="Next step">
              <h3 className="text-body font-medium">Physical NFC check</h3>
              <div className="max-w-xl"><NfcCheckForm cardId={card.id} expectedUri={order.reviewUrl} /></div>
            </NextStep>
          ) : null}

        </div>

        <aside aria-label="Card details" className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {phoneUrl && phoneQr ? <Panel padded className="hidden md:block"><ContinueOnPhone url={phoneUrl} qrSrc={phoneQr} /></Panel> : null}

          {credentialId && flow.current !== "package" ? <Panel padded><ActivationCode cardId={card.id} credentialId={credentialId} retrievable={card.credentialRetrievable} /></Panel> : null}

          {sharingQr && dbcUri ? (
            <Panel padded className="flex flex-col gap-3">
              <h3 className="text-body font-medium">Sharing QR</h3>
              <p className="text-meta text-fg-secondary">Print or download this for the back of the card. It opens the same URL as the NFC tag, never the activation page.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sharingQr} alt="Sharing QR for this card" width={144} height={144} className="size-36 self-start rounded-lg border bg-white p-2" />
              <a href={sharingQr} download={`neffi-sharing-qr-${dbcToken}.svg`} className={`${buttonVariants({ variant: "outline", size: "touch" })} gap-2 self-start md:h-9`}>
                <Download aria-hidden className="size-4" />
                Download QR (SVG)
              </a>
              {flow.current !== "nfc" ? <CardUrl url={dbcUri} copyLabel="Copy NFC URL" copied="NFC URL copied." /> : null}
            </Panel>
          ) : null}

          <Panel padded>
            <DetailList
              rows={[
                ["Added", dateTime(card.createdAt)],
                card.owningAccount ? ["Owning Account", <Link key="a" className={inlineLink} href={`/admin/customers/accounts/${card.owningAccountId}`}>{card.owningAccount.email}</Link>] : null,
                order?.reviewUrl ? ["Review URL", <span key="r" className="font-mono text-meta break-all">{order.reviewUrl}</span>] : null,
                isDbc || reservedGrc ? ["NFC test", card.nfcVerifiedAt ? dateTime(card.nfcVerifiedAt) : "Not done"] : null,
                isDbc ? ["Package", card.packageMatchedAt ? dateTime(card.packageMatchedAt) : "Not done"] : null,
                isDbc ? ["Credential", `${card.usableCredentialId ? "One unused credential" : "No usable credential"} · ${card.credentialCount} issued`] : null,
              ]}
            />
          </Panel>
        </aside>

        <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-2">
          {canProvision && canReserve ? (
            <Disclosure summary="Use as a Google Review Card instead">
              {eligibleItems.length > 0 ? <div className="max-w-xl"><ReserveForm cardId={card.id} items={eligibleItems} /></div> : <p className="text-meta text-fg-secondary">No open Google Review Card order item needs a card right now.</p>}
            </Disclosure>
          ) : null}

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

          {isDbc && card.usableCredentialId && ["blank", "preparing", "ready"].includes(card.state) ? (
            <Disclosure summary="Credential recovery">
              <ReplaceForm cardId={card.id} credentialId={card.usableCredentialId} />
            </Disclosure>
          ) : null}

          {retirable ? (
            <DangerZone>
              <div className="max-w-xl"><RetireForm cardId={card.id} /></div>
            </DangerZone>
          ) : null}
        </div>
      </div>
    </main>
  );
}
