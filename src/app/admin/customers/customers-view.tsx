import { Users } from "lucide-react";
import { formatDate } from "@/lib/format-date";
import type { listAccounts } from "@/modules/accounts/directory";
import type { listPurchaserDirectory } from "@/modules/orders/purchasers";
import type { PageWindow } from "@/modules/pagination";
import { adminPageWide, EmptyPanel, FilterBar, FilterField, Input, label, Meta, pageHref, PageHeader, Pagination, RecordTable, RowLink, TabNav } from "../ui";

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

export type CustomersViewProps = {
  accounts: boolean;
  query: string;
  paging: PageWindow;
  accountRows: Awaited<ReturnType<typeof listAccounts>>;
  purchaserRows: Awaited<ReturnType<typeof listPurchaserDirectory>>;
  basePath?: string;
  recordHref?: (id: string) => string;
};

export function CustomersView({ accounts, query, paging, accountRows, purchaserRows, basePath = "/admin/customers", recordHref }: CustomersViewProps) {
  const detailHref = (id: string, kind: "accounts" | "purchasers") => recordHref?.(id) ?? `${basePath}/${kind}/${id}`;
  const keep = { view: accounts ? "accounts" : undefined, q: query };
  return <main data-admin-section="customers" className={adminPageWide}>
    <PageHeader title="Customers" description="Purchasers are buyers of cards. Neffi Accounts are customer sign-ins and are read-only." />
    <TabNav label="Customer views" items={[{ label: "Purchasers", href: basePath, active: !accounts }, { label: "Neffi Accounts", href: `${basePath}?view=accounts`, active: accounts }]} />
    <FilterBar action={basePath} clearHref={query ? `${basePath}${accounts ? "?view=accounts" : ""}` : undefined} submit="Search">
      <input type="hidden" name="view" value={accounts ? "accounts" : "purchasers"} />
      <FilterField label={accounts ? "Account email" : "Purchaser name or contact"} grow><Input name="q" defaultValue={query} maxLength={100} /></FilterField>
    </FilterBar>
    {accounts && accountRows.length ? (
      <RecordTable
        caption="Neffi Accounts"
        rows={accountRows}
        rowKey={(row) => row.id}
        href={(row) => detailHref(row.id, "accounts")}
        columns={[
          { label: "Account", cell: (row) => <RowLink href={detailHref(row.id, "accounts")}><span className="break-all">{row.email}</span></RowLink> },
          { label: "Role", cell: (row) => label(row.role) },
          { label: "Joined", cell: (row) => <span className="text-meta text-fg-secondary tabular-nums">{formatDate(row.createdAt)}</span> },
        ]}
        mobile={(row) => ({ title: <span className="break-all">{row.email}</span>, subtitle: label(row.role), meta: `Joined ${formatDate(row.createdAt)}`, cta: "View account" })}
      />
    ) : null}
    {!accounts && purchaserRows.length ? (
      <RecordTable
        caption="Purchasers"
        rows={purchaserRows}
        rowKey={(row) => row.id}
        href={(row) => detailHref(row.id, "purchasers")}
        columns={[
          { label: "Purchaser", cell: (row) => <><RowLink href={detailHref(row.id, "purchasers")}>{row.name}</RowLink>{row.contactNumber ? <Meta>{row.contactNumber}</Meta> : null}</> },
          { label: "Contact", cell: (row) => row.contactNumber ?? <span className="text-fg-secondary">No contact</span> },
          { label: "Orders", align: "right", cell: (row) => row.orderCount },
          { label: "Cards", align: "right", cell: (row) => row.cardCount },
        ]}
        mobile={(row) => ({ title: row.name, subtitle: row.contactNumber ?? "No contact number", meta: `${plural(row.orderCount, "order")} · ${plural(row.cardCount, "card")}`, cta: "View customer" })}
      />
    ) : null}
    {paging.total ? null : (
      <EmptyPanel icon={Users} title={query ? `No customers match “${query}”` : accounts ? "No Neffi Accounts" : "No customers yet"}>{query ? "Try a different name, contact or email." : accounts ? "Customer Accounts will appear here." : "Purchasers appear here after the first order."}</EmptyPanel>
    )}
    <Pagination noun={accounts ? "accounts" : "customers"} paging={paging} hrefFor={pageHref(basePath, keep)} />
  </main>;
}
