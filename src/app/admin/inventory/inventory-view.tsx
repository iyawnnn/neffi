import Link from "next/link";
import { Package, PackageSearch } from "lucide-react";
import type { ReactNode } from "react";
import { formatPeso } from "@/lib/money";
import type { inventoryStatusCounts, listInventoryQueue, QueueCard, QueueFilter } from "@/modules/inventory/queries";
import { activationCell, inventoryReference, STATUS_LABEL_BY_KEY, toInventoryOperation, type StatusKey } from "@/modules/inventory/operations-view";
import type { listStockPurchases } from "@/modules/inventory/stock-purchases";
import type { PageWindow } from "@/modules/pagination";
import { adminPageWide, EmptyPanel, FilterBar, FilterField, Input, listHref, Meta, Notice, pageHref, PageHeader, Pagination, Panel, RecordTable, RowLink, Section, Status, TabNav, TextLink, type Tone } from "../ui";
import { KIND_LABEL } from "./format";

const SHORT = { dbc: "DBC", grc: "GRC", none: "Unassigned" } as const;
const wrap = "break-words [overflow-wrap:anywhere]";
const TONE: Record<StatusKey, Tone> = { available_blank: "neutral", needs_preparation: "warning", ready: "success", assigned: "attention", shipped: "neutral", given: "neutral", waiting_activation: "warning", delivery_unconfirmed: "warning", activated: "success", retired: "neutral" };
const TABS: { filter: QueueFilter | undefined; label: string; keys: StatusKey[] }[] = [
  { filter: undefined, label: "Tracked cards", keys: [] },
  { filter: "needs_preparation", label: "Needs preparation", keys: ["needs_preparation"] },
  { filter: "ready", label: "Ready", keys: ["ready"] },
  { filter: "assigned", label: "Assigned", keys: ["assigned"] },
  { filter: "delivered", label: "Delivered", keys: ["shipped", "given", "waiting_activation"] },
  { filter: "activated", label: "Activated", keys: ["activated"] },
  { filter: "retired", label: "Retired", keys: ["retired"] },
  { filter: "available", label: "Available blanks", keys: ["available_blank"] },
];

export type InventoryViewProps = {
  stockView: boolean;
  filter?: QueueFilter;
  search?: string;
  counts: Awaited<ReturnType<typeof inventoryStatusCounts>>;
  shortage: number;
  paging: PageWindow;
  queue: Awaited<ReturnType<typeof listInventoryQueue>> | null;
  purchases: Awaited<ReturnType<typeof listStockPurchases>>;
  actions?: ReactNode;
  basePath?: string;
  recordHref?: (id: string) => string;
};

const deliveryOf = (card: QueueCard) => card.shipped ? { label: card.courier ?? "J&T", tracking: card.tracking } : card.statusKey === "given" ? { label: "In person", tracking: null } : null;

export function InventoryView({ stockView, filter, search, counts, shortage, paging, queue, purchases, actions, basePath = "/admin/inventory", recordHref }: InventoryViewProps) {
  const cardHref = (id: string) => recordHref?.(id) ?? `${basePath}/cards/${id}`;
  const stockHref = (id: string) => recordHref?.(id) ?? `${basePath}/stock/${id}`;
  const total = (keys: StatusKey[]) => counts.filter((row) => keys.includes(row.status)).reduce((sum, row) => sum + row.count, 0);
  const everyKey = Object.keys(STATUS_LABEL_BY_KEY) as StatusKey[];
  const available = total(["available_blank"]);
  const todo = total(everyKey) - available;
  const filtered = Boolean(filter || search);
  const operation = (card: QueueCard) => toInventoryOperation({ id: card.id, kind: card.kind, state: card.state, publicToken: card.publicToken, ownerAccountId: card.ownerAccountId, orderId: card.orderId, deliveryMethod: card.deliveryMethod, hasShippedShipment: card.shipped, hasHandedOver: card.handedOver });
  const actionHref = (card: QueueCard) => { const { href } = operation(card); return recordHref ? recordHref(card.id) : href.startsWith("/admin/inventory/cards/") ? cardHref(card.id) : href; };
  const activationFor = (card: QueueCard) => activationCell({ kind: card.kind, ownerAccountId: card.ownerAccountId, usableCredential: card.activation.usable, retrievable: card.activation.retrievable, revoked: card.activation.revoked, retired: card.state === "retired" });

  return (
    <main data-admin-section="inventory" className={adminPageWide}>
      <PageHeader title="Inventory" description="Every card from blank stock to activation, with the next thing to do." actions={actions} />
      <TabNav label="Inventory views" items={[{ label: "Cards", href: basePath, active: !stockView }, { label: "Stock purchases", href: `${basePath}?view=stock`, active: stockView }]} />

      {stockView ? (
        <Section title="Stock purchases" description="Each delivery received, newest first.">
          {purchases.length ? (
            <RecordTable
              caption="Stock purchases"
              rows={purchases}
              rowKey={(purchase) => purchase.id}
              href={(purchase) => stockHref(purchase.id)}
              columns={[
                { label: "Received", cell: (purchase) => <><RowLink href={stockHref(purchase.id)}>{purchase.receivedOn}</RowLink><Meta>{purchase.supplier ?? "No supplier"}</Meta></> },
                { label: "Quantity", align: "right", cell: (purchase) => `${purchase.quantity} cards` },
                { label: "Purchase cost", align: "right", cell: (purchase) => (purchase.purchaseCost == null ? <span className="text-fg-secondary">Not recorded</span> : formatPeso(purchase.purchaseCost)) },
                { label: "Inbound shipping", align: "right", cell: (purchase) => (purchase.inboundShippingCost == null ? <span className="text-fg-secondary">Not recorded</span> : formatPeso(purchase.inboundShippingCost)) },
              ]}
              mobile={(purchase) => ({
                title: `Received ${purchase.receivedOn}`,
                subtitle: purchase.supplier ?? "No supplier",
                figures: [["Quantity", `${purchase.quantity} cards`], ...(purchase.purchaseCost == null ? [] : [["Cost", formatPeso(purchase.purchaseCost)] as [string, string]])],
                cta: "View delivery",
              })}
            />
          ) : (
            <EmptyPanel icon={Package} title="No stock purchases yet">Use Receive stock when a delivery of blank cards arrives.</EmptyPanel>
          )}
          <Pagination noun="deliveries" paging={paging} hrefFor={pageHref(basePath, { view: "stock" })} />
        </Section>
      ) : (
        <>
          {shortage > 0 ? <Notice tone="warning" title={`${shortage} ${shortage === 1 ? "card" : "cards"} short`} action={<TextLink href="/admin/orders">Open orders</TextLink>}>Paid orders are waiting for stock. Receive stock and they are filled automatically.</Notice> : null}

          <nav aria-label="Card queue" className="flex flex-wrap gap-2">
            {TABS.map((tab) => <Link key={tab.label} href={listHref(basePath, { status: tab.filter })} aria-current={tab.filter === filter ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-lg border px-3 text-meta font-medium nav-interact focus-visible:outline-2 focus-visible:outline-brand ${tab.filter === filter ? "border-action text-foreground" : "border-border text-fg-secondary hover:bg-canvas"}`}>
              {tab.label} {tab.filter ? total(tab.keys) : todo}
            </Link>)}
          </nav>

          {!filter && !search && available > 0 ? (
            <Panel padded className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h2 className="text-section">{available} available blank {available === 1 ? "card" : "cards"}</h2>
                <p className="text-meta text-fg-secondary">Untouched stock. A card is chosen automatically when an order needs one, so there is nothing to prepare yet.</p>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-body">{recordHref ? null : <TextLink href="/admin/orders/new">Create order</TextLink>}<TextLink href={listHref(basePath, { status: "available" })}>View the list</TextLink></div>
            </Panel>
          ) : null}

          <Section title={filter ? TABS.find((tab) => tab.filter === filter)!.label : search ? "Search results" : "Operational cards"} description={filter ? undefined : search ? undefined : "Allocated, prepared and delivered cards stay individually traceable."}>
            <FilterBar action={basePath} clearHref={filtered ? basePath : undefined} submit="Search">
              {filter ? <input type="hidden" name="status" value={filter} /> : null}
              <FilterField label="Search" grow>
                <Input name="q" defaultValue={search ?? ""} maxLength={100} placeholder="N-0051, order, name or tracking" />
              </FilterField>
            </FilterBar>
            {queue?.cards.length ? (
              <RecordTable
                caption="Cards"
                rows={queue.cards}
                rowKey={(card) => card.id}
                href={(card) => actionHref(card)}
                columns={[
                  { label: "Card", cell: (card) => <><RowLink href={actionHref(card)}><span className="whitespace-nowrap">{inventoryReference(card.inventoryNumber)}</span></RowLink><Meta>{SHORT[card.kind ?? "none"]}</Meta></> },
                  { label: "Status", cell: (card) => <Status tone={TONE[card.statusKey]}>{STATUS_LABEL_BY_KEY[card.statusKey]}</Status> },
                  { label: "Order / Customer", cell: (card) => card.orderNumber ? <><p className={`text-body ${wrap}`}>{card.customer}</p><Meta>Order {card.orderNumber}</Meta></> : <span className="text-fg-secondary">Not assigned</span> },
                  { label: "Activation", cell: (card) => { const cell = activationFor(card); return cell.href ? <Link href={`${cardHref(card.id)}#activation`} className="relative z-10 whitespace-nowrap font-medium text-action-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand">{cell.label}</Link> : <span className="text-fg-secondary">{cell.label}</span>; } },
                  { label: "Delivery", cell: (card) => { const delivery = deliveryOf(card); return delivery ? <><p className="text-body">{delivery.label}</p>{delivery.tracking ? <Meta className="font-mono">{delivery.tracking}</Meta> : null}</> : <span className="text-fg-secondary">—</span>; } },
                  { label: "Next action", cell: (card) => <Link href={actionHref(card)} className="relative z-10 font-medium text-action-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand">{operation(card).actionLabel}</Link> },
                ]}
                mobile={(card) => {
                  const delivery = deliveryOf(card);
                  return {
                    title: inventoryReference(card.inventoryNumber),
                    status: <Status tone={TONE[card.statusKey]}>{STATUS_LABEL_BY_KEY[card.statusKey]}</Status>,
                    subtitle: card.orderNumber ? `${card.customer ?? ""} · Order ${card.orderNumber}` : KIND_LABEL[card.kind ?? "none"],
                    meta: <span className={wrap}>{[delivery ? `${delivery.label}${delivery.tracking ? ` ${delivery.tracking}` : ""}` : null, activationFor(card).label].filter(Boolean).join(" · ")}</span>,
                    cta: operation(card).actionLabel,
                  };
                }}
              />
            ) : (
              <EmptyPanel icon={PackageSearch} title={filtered ? "No cards match" : "Nothing needs doing"}>{filtered ? "Try another status or a different search." : "Receive stock to add blank cards, or create an order."}</EmptyPanel>
            )}
            <Pagination noun="cards" paging={paging} hrefFor={pageHref(basePath, { status: filter, q: search })} />
          </Section>
        </>
      )}
    </main>
  );
}
