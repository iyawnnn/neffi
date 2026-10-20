import { Package } from "lucide-react";
import type { ReactNode } from "react";
import { formatPeso } from "@/lib/money";
import type { cardStateCounts, listCards } from "@/modules/inventory/queries";
import type { listStockPurchases } from "@/modules/inventory/stock-purchases";
import type { PageWindow } from "@/modules/pagination";
import { InventorySummary } from "../inventory-summary";
import { adminPageWide, cardTone, EmptyPanel, FilterBar, FilterField, Meta, Notice, pageHref, PageHeader, Pagination, Panel, RecordTable, RowLink, Section, Select, Status, TabNav, TextLink } from "../ui";
import { dateTime, KIND_LABEL, STATE_LABEL } from "./format";

const STATES = ["blank", "ready", "reserved", "released", "retired"] as const;

export type InventoryViewProps = {
  stockView: boolean;
  filters: { kind?: "dbc" | "grc" | "none"; state?: typeof STATES[number] };
  counts: Awaited<ReturnType<typeof cardStateCounts>>;
  paging: PageWindow;
  cardPage: Awaited<ReturnType<typeof listCards>> | null;
  purchases: Awaited<ReturnType<typeof listStockPurchases>>;
  actions?: ReactNode;
  basePath?: string;
  recordHref?: (id: string) => string;
};

export function InventoryView({ stockView, filters, counts, paging, cardPage, purchases, actions, basePath = "/admin/inventory", recordHref }: InventoryViewProps) {
  const filtered = Boolean(filters.kind || filters.state);
  const cardHref = (id: string) => recordHref?.(id) ?? `${basePath}/cards/${id}`;
  const stockHref = (id: string) => recordHref?.(id) ?? `${basePath}/stock/${id}`;
  return (
    <main data-admin-section="inventory" className={adminPageWide}>
      <PageHeader title="Inventory" description="Track physical cards and provisioning." actions={actions} />
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
          {counts.inProvisioning > 0 ? <Notice tone="warning" title={`${counts.inProvisioning} ${counts.inProvisioning === 1 ? "card is" : "cards are"} in provisioning`} action={<TextLink href={`${basePath}?state=blank`}>Review blank cards</TextLink>}>Token issued, not yet Ready for sale.</Notice> : null}
          <Section title="Overview" description="Every card by product and where it stands.">
            <Panel padded><InventorySummary rows={counts.rows} inProvisioning={counts.inProvisioning} full basePath={basePath} /></Panel>
          </Section>

          <Section title="Cards">
            <FilterBar action={basePath} clearHref={filtered ? basePath : undefined} submit="Filter">
              <FilterField label="Product">
                <Select name="kind" defaultValue={filters.kind ?? ""}><option value="">All</option><option value="dbc">DBC</option><option value="grc">GRC</option><option value="none">Unassigned</option></Select>
              </FilterField>
              <FilterField label="State">
                <Select name="state" defaultValue={filters.state ?? ""}><option value="">All</option>{STATES.map((state) => <option key={state} value={state}>{STATE_LABEL[state]}</option>)}</Select>
              </FilterField>
            </FilterBar>
            {cardPage?.cards.length ? (
              <RecordTable
                caption="Cards"
                rows={cardPage.cards}
                rowKey={(card) => card.id}
                href={(card) => cardHref(card.id)}
                columns={[
                  { label: "Card", cell: (card) => <><RowLink href={cardHref(card.id)}>{KIND_LABEL[card.kind ?? "none"]}</RowLink><Meta className="font-mono break-all">{card.publicToken ?? card.id}</Meta></> },
                  { label: "State", cell: (card) => <Status tone={cardTone(card.state, card.state === "blank" && Boolean(card.publicToken))}>{card.state === "blank" && card.publicToken ? "In provisioning" : STATE_LABEL[card.state]}</Status> },
                  { label: "Added", cell: (card) => <span className="text-meta text-fg-secondary tabular-nums">{dateTime(card.createdAt)}</span> },
                ]}
                mobile={(card) => ({
                  title: KIND_LABEL[card.kind ?? "none"],
                  status: <Status tone={cardTone(card.state, card.state === "blank" && Boolean(card.publicToken))}>{card.state === "blank" && card.publicToken ? "In provisioning" : STATE_LABEL[card.state]}</Status>,
                  subtitle: <span className="font-mono">{card.publicToken ? `•••• ${card.publicToken.slice(-4).toUpperCase()}` : "No token yet"}</span>,
                  meta: dateTime(card.createdAt),
                  cta: "View card",
                })}
              />
            ) : (
              <EmptyPanel icon={Package} title={filtered ? "No cards match these filters" : "No cards found"}>{filtered ? "Try a different product or state." : "Receive stock to add blank cards."}</EmptyPanel>
            )}
            <Pagination noun="cards" paging={paging} hrefFor={pageHref(basePath, filters)} />
          </Section>
        </>
      )}
    </main>
  );
}
