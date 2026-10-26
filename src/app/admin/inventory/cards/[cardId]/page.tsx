import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Activity, Check, Circle, CircleCheck, Download, KeyRound, LifeBuoy, Link2, Package, PackageCheck, ReceiptText, Smartphone, Wrench } from "lucide-react";
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
import { inventoryReference } from "@/modules/inventory/operations-view";
import { adminPage, DangerZone, Disclosure, label, LinkButton, quietText } from "../../../ui";
import { Card, DetailHeader, KeyValueList, MetaRow, recordLink, StatePanel, StateText, SummaryStrip, Timeline } from "../../../detail-ui";
import { MatchPackageForm, NfcCheckForm, ProvisionForm, ReplaceForm, ReserveForm, RetireForm } from "../../forms";
import { dateTime, KIND_LABEL } from "../../format";
import { ActivationCode } from "./activation-code";
import { ContinueOnPhone } from "./continue-on-phone";
import { preparationSteps, type StepCard } from "./preparation-steps";

export const instant = false;

const ACTIVITY: Record<string, string> = { card_provisioned: "Card prepared for NFC writing", card_nfc_verified: "NFC verified", card_package_matched: "Package confirmed", card_ready: "Card ready", card_reserved: "Card reserved", card_released: "Card released", card_returned: "Card returned to stock", card_retired: "Card retired" };

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
  const reference = inventoryReference(card.inventoryNumber);
  const credentialId = live && isDbc && !card.owningAccountId ? card.usableCredentialId : null;
  const order = card.orderContext;
  const preparing = isDbc && ["provision", "nfc", "package"].includes(flow.current);
  const released = card.state === "released";
  const activated = released && Boolean(card.owningAccountId);
  const stateLabel = card.state === "reserved" ? "Assigned to an order" : isDbc ? (activated ? "Activated" : STATUS[flow.current]) : card.state === "retired" ? "Retired" : "In stock";
  const StateIcon = activated ? CircleCheck : preparing ? Wrench : Package;
  const phoneCompact = phoneUrl && phoneQr ? <ContinueOnPhone url={phoneUrl} qrSrc={phoneQr} /> : null;

  const completion = <SummaryStrip embedded text label="Card completion" items={[
    { label: "NFC", value: card.nfcVerifiedAt ? "Verified" : "Not verified" },
    { label: "Package", value: card.packageMatchedAt ? "Confirmed" : "Not confirmed" },
    { label: "Delivery", value: released ? "Given to customer" : card.state === "reserved" ? "Assigned to order" : "Not assigned" },
    { label: "Activation", value: activated ? "Claimed" : released ? "Awaiting activation" : "Not claimed" },
  ]} />;

  return (
    <main data-admin-section="inventory" className={adminPage}>
      <DetailHeader
        back={{ href: "/admin/inventory", label: "Inventory" }}
        title={`Card ${reference}`}
        subtitle={KIND_LABEL[card.kind ?? "none"]}
        meta={
          <MetaRow
            items={[
              { icon: StateIcon, text: stateLabel },
              card.purchaser ? { text: <>Customer: <Link className={recordLink} href={`/admin/customers/purchasers/${card.purchaser.id}`}>{card.purchaser.name}</Link></> } : null,
              order ? { text: order.orderId ? <Link className={recordLink} href={`/admin/orders/${order.orderId}`}>Order {order.orderNumber}</Link> : <>Order {order.orderNumber}</> } : null,
              order?.label ? { text: order.label } : null,
              order?.status === "cancelled" ? { text: "This order was cancelled." } : null,
            ]}
          />
        }
        actions={
          <LinkButton icon={LifeBuoy} href={`/admin/support/new?${new URLSearchParams({ cardId: card.id, ...(order?.orderId ? { orderId: order.orderId } : {}), ...(card.owningAccountId ? { accountId: card.owningAccountId } : {}), ...(card.purchaser ? { purchaserId: card.purchaser.id } : {}) })}`}>Open support case</LinkButton>
        }
      />

      <ProvisionForm key={card.id} cardId={card.id} available={canProvision} />

      {preparing && flow.current !== "provision" ? (
        <ol aria-label="Preparation progress" className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-panel border bg-border sm:grid-cols-4">
          {flow.steps.map((step, index) => {
            const Icon = step.done ? Check : Circle;
            const current = !step.done && flow.steps.slice(0, index).every((earlier) => earlier.done);
            return (
              <li key={step.label} aria-current={current ? "step" : undefined} className="flex items-center gap-2 bg-background px-4 py-3 text-body sm:px-6">
                <Icon aria-hidden className={`size-4 shrink-0 ${step.done ? "text-foreground" : "text-fg-faint"}`} />
                <span className={current ? "font-semibold" : step.done ? "" : "text-fg-secondary"}>{step.label}<span className="sr-only">{step.done ? ", done" : ""}</span></span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {flow.current === "nfc" && dbcUri ? (
        <StatePanel tone="action" title="Write and test the NFC card" icon={Wrench} description="Take any untouched card and write this card's permanent URL. Keep this card with you until preparation is complete.">
          <div className="max-w-xl"><NfcCheckForm cardId={card.id} expectedUri={dbcUri} /></div>
        </StatePanel>
      ) : null}

      {flow.current === "package" ? (
        <StatePanel tone="action" title="Confirm the package" icon={PackageCheck} description="NFC test confirmed. Now type the code printed on the package that goes with this card.">
          <div className="max-w-xl"><MatchPackageForm cardId={card.id} /></div>
          {credentialId ? <div id="activation" className="max-w-xl border-t pt-4"><ActivationCode cardId={card.id} credentialId={credentialId} retrievable={card.credentialRetrievable} /></div> : null}
        </StatePanel>
      ) : null}

      {flow.current === "ready" && card.state === "reserved" && order?.orderId ? (
        <StatePanel tone="action" title="Assigned to an order" icon={ReceiptText} description="This card is prepared and assigned. Deliver it from the order." footer={completion}>
          <div><LinkButton variant="action" href={`/admin/orders/${order.orderId}`}>Open Order {order.orderNumber}</LinkButton></div>
        </StatePanel>
      ) : null}

      {flow.current === "ready" && card.state === "ready" ? (
        <StatePanel title="Ready for customer" icon={PackageCheck} description="Prepared and waiting for the next paid order, which assigns it automatically. No physical steps are left." footer={completion} />
      ) : null}
      {flow.current === "released" ? (
        <StatePanel title={activated ? "Activated" : "Given to the customer"} icon={activated ? CircleCheck : PackageCheck} description={activated ? "The customer has claimed this card. Corrections go through a support case." : "The customer activates it with the code from the package. Corrections go through a support case."} footer={completion} />
      ) : null}
      {flow.current === "retired" ? (
        <StatePanel title="Retired" description="This card is retired and cannot be sold. Its history stays below." />
      ) : null}

      {canReserve && !canProvision ? (
        <StatePanel tone="action" title="Reserve for an order" icon={ReceiptText}>
          {eligibleItems.length > 0 ? (
            <div className="max-w-xl"><ReserveForm cardId={card.id} items={eligibleItems} /></div>
          ) : (
            <p className="text-meta text-fg-secondary">No open Google Review Card order item needs a card right now.</p>
          )}
        </StatePanel>
      ) : null}

      {reservedGrc && order?.reviewUrl ? (
        <StatePanel tone="action" title="Physical NFC check" icon={Wrench}>
          <div className="max-w-xl"><NfcCheckForm cardId={card.id} expectedUri={order.reviewUrl} /></div>
        </StatePanel>
      ) : null}

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <Card title="Card summary" icon={Package}>
          <KeyValueList
            rows={[
              ["Reference", <span key="ref" className="font-mono">{reference}</span>],
              ["Type", KIND_LABEL[card.kind ?? "none"]],
              ["State", stateLabel],
              ["Added", dateTime(card.createdAt)],
              isDbc || reservedGrc ? ["NFC test", card.nfcVerifiedAt ? dateTime(card.nfcVerifiedAt) : "Not done"] : null,
              isDbc ? ["Package", card.packageMatchedAt ? dateTime(card.packageMatchedAt) : "Not done"] : null,
              card.purchaser ? ["Customer", <Link key="customer" className={recordLink} href={`/admin/customers/purchasers/${card.purchaser.id}`}>{card.purchaser.name}</Link>] : null,
              order ? ["Order", order.orderId ? <Link key="order" className={recordLink} href={`/admin/orders/${order.orderId}`}>Order {order.orderNumber}</Link> : `Order ${order.orderNumber}`] : null,
              order?.reviewUrl ? ["Review URL", <span key="review" className="font-mono text-meta break-all">{order.reviewUrl}</span>] : null,
            ]}
          />
        </Card>

        {sharingQr && dbcUri ? (
          <Card title="Public destination" icon={Link2} description="The permanent URL the NFC tag opens.">
            {flow.current !== "nfc" ? <CardUrl url={dbcUri} copyLabel="Copy NFC URL" copied="NFC URL copied." /> : null}
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sharingQr} alt="Sharing QR for this card" width={96} height={96} className="size-24 shrink-0 rounded-lg border bg-white p-1.5" />
              <div className="flex min-w-0 flex-col gap-2">
                <div>
                  <h3 className="text-body font-medium">Sharing QR</h3>
                  <p className={quietText}>For the back of the card. Opens the same URL as the NFC tag, never the activation page.</p>
                </div>
                <a href={sharingQr} download={`neffi-sharing-qr-${dbcToken}.svg`} className={`${buttonVariants({ variant: "outline", size: "touch" })} gap-2 self-start md:h-9`}>
                  <Download aria-hidden className="size-4" />
                  Download QR (SVG)
                </a>
              </div>
            </div>
          </Card>
        ) : null}

        {isDbc && live ? (
          <Card title="Ownership and activation" icon={KeyRound} className="lg:col-span-2">
            <KeyValueList
              columns={2}
              rows={[
                ["Owner", card.owningAccount ? <Link key="owner" className={recordLink} href={`/admin/customers/accounts/${card.owningAccountId}`}>{card.owningAccount.email}</Link> : "Not claimed yet"],
                ["Activation", <StateText key="activation" icon={activated ? Check : Circle}>{activated ? "Claimed" : released ? "Awaiting activation" : "Not released yet"}</StateText>],
                ["Credential", `${card.usableCredentialId ? "One unused credential" : "No usable credential"} · ${card.credentialCount} issued`],
              ]}
            />
            {credentialId && flow.current !== "package" ? <div id="activation" className="border-t pt-4"><ActivationCode cardId={card.id} credentialId={credentialId} retrievable={card.credentialRetrievable} /></div> : null}
          </Card>
        ) : null}

        {preparing && phoneCompact ? <Card title="Continue on phone" icon={Smartphone} className="max-md:hidden lg:col-span-2">{phoneCompact}</Card> : null}
      </div>

      {canProvision && canReserve ? (
        <Disclosure summary="Use as a Google Review Card instead">
          {eligibleItems.length > 0 ? <div className="max-w-xl"><ReserveForm cardId={card.id} items={eligibleItems} /></div> : <p className="text-meta text-fg-secondary">No open Google Review Card order item needs a card right now.</p>}
        </Disclosure>
      ) : null}

      <Card title="Recent activity" icon={Activity}>
        <Timeline entries={card.activity.map((event, index) => ({ id: String(index), title: ACTIVITY[event.type] ?? label(event.type), detail: event.note ?? undefined, at: new Date(event.createdAt) }))} />
      </Card>

      {!preparing && phoneCompact ? <Disclosure summary="Continue on phone" className="max-md:hidden">{phoneCompact}</Disclosure> : null}

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
    </main>
  );
}
