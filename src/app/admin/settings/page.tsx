import { connection } from "next/server";
import { IdCard, ShieldCheck, Star, Users } from "lucide-react";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { formatPeso } from "@/lib/money";
import { formatDate } from "@/lib/format-date";
import { listOwnerAccess, listProducts } from "@/modules/orders/products";
import { NORMAL_DBC_UNIT_PRICE } from "@/modules/orders/policy";
import { adminPageNarrow, EmptyPanel, fieldLabel, Input, PageHeader, Panel, RecordTable, Section } from "../ui";
import { ActionForm } from "../inventory/forms";
import { saveProductAction } from "./actions";

export const instant = false;

const catalog = [
  { kind: "dbc", title: "Digital Business Card", blurb: "NFC card linked to a customer's profile.", icon: IdCard },
  { kind: "grc", title: "Google Review Card", blurb: "NFC card that opens a Google review link.", icon: Star },
] as const;

export default async function SettingsPage() {
  await requireOwner();
  await connection();
  const [products, owners] = await Promise.all([listProducts(db), listOwnerAccess(db)]);
  return <main data-admin-section="settings" className={adminPageNarrow}>
    <PageHeader title="Settings" description="Catalog prices and owner access." />
    <Section title="Products & Pricing" description="Prices apply to new orders. Existing orders keep the price they were sold at.">
      <Panel>
        <ul className="divide-y">
          {catalog.map(({ kind, title, blurb, icon: Icon }) => {
            const product = products.find((p) => p.kind === kind);
            return <li key={kind} className="flex flex-col gap-4 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-canvas text-fg-secondary"><Icon className="size-4" /></span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <h3 className="text-body font-medium">{title}</h3>
                    <p className="text-meta text-fg-secondary">{blurb}</p>
                  </div>
                </div>
                <p className="shrink-0 text-right text-meta text-fg-secondary">{kind === "dbc" ? <>Fixed price<span className="block text-section text-foreground tabular-nums">{formatPeso(NORMAL_DBC_UNIT_PRICE)}</span></> : product ? <>Current price<span className="block text-section text-foreground tabular-nums">{formatPeso(product.price)}</span></> : "Not set up yet"}</p>
              </div>
              <ActionForm action={saveProductAction} submit={product ? "Save changes" : "Create product"} className="sm:flex-row sm:flex-wrap sm:items-end sm:[&>button]:self-end">
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="productId" value={product?.id ?? ""} />
                <label className={`${fieldLabel} sm:min-w-0 sm:flex-1`}>Name<Input name="name" required maxLength={100} defaultValue={product?.name} /></label>
                <label className={`${fieldLabel} sm:w-40`}>
                  Price (pesos)
                  <span className="relative block">
                    <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-body text-fg-secondary">₱</span>
                    <Input name="price" required inputMode="decimal" maxLength={30} defaultValue={kind === "dbc" ? "799.00" : product ? (product.price / 100).toFixed(2) : undefined} readOnly={kind === "dbc"} className="pl-7 tabular-nums" />
                  </span>
                </label>
              </ActionForm>
            </li>;
          })}
        </ul>
      </Panel>
    </Section>
    <Section title="Owner Access" description="Read-only. Both owners have equal access.">
      {owners.length ? (
        <RecordTable
          caption="Owner access"
          rows={owners}
          rowKey={(owner) => owner.email}
          href={() => undefined}
          columns={[
            { label: "Owner", cell: (owner) => <span className="font-medium break-all">{owner.email}</span> },
            { label: "Role", cell: () => <span className="inline-flex items-center gap-1.5 text-meta font-medium"><ShieldCheck aria-hidden className="size-3.5 text-fg-secondary" />Owner</span> },
            { label: "Joined", cell: (owner) => <span className="text-meta text-fg-secondary tabular-nums">{formatDate(owner.createdAt)}</span> },
          ]}
          mobile={(owner) => ({ title: <span className="break-all">{owner.email}</span>, subtitle: "Owner", meta: `Joined ${formatDate(owner.createdAt)}` })}
        />
      ) : (
        <EmptyPanel icon={Users} title="No owners found">Owner Accounts appear here.</EmptyPanel>
      )}
    </Section>
  </main>;
}
