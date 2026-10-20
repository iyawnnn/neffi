import { LifeBuoy, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { formatDateTime } from "@/lib/format-date";
import type { listCases } from "@/modules/support/queries";
import type { PageWindow } from "@/modules/pagination";
import { adminPageWide, caseTone, EmptyPanel, FilterBar, FilterField, label, LinkButton, Meta, pageHref, PageHeader, Pagination, RecordTable, RowLink, Select, Status } from "../ui";

export type SupportViewProps = {
  filters: { status?: "open" | "waiting_on_customer" | "resolved"; source?: "owner" | "public" | "account" };
  paging: PageWindow;
  cases: Awaited<ReturnType<typeof listCases>>["cases"];
  actions?: ReactNode;
  basePath?: string;
  recordHref?: (id: string) => string;
};

export function SupportView({ filters, paging, cases, actions, basePath = "/admin/support", recordHref = (id) => `${basePath}/${id}` }: SupportViewProps) {
  const filtered = Boolean(filters.status || filters.source);
  return <main data-admin-section="support" className={adminPageWide}>
    <PageHeader title="Support" description="Review and resolve customer cases." actions={actions === undefined ? <LinkButton href={`${basePath}/new`} variant="action" icon={Plus}>Open support case</LinkButton> : actions} />
    <FilterBar action={basePath} clearHref={filtered ? basePath : undefined} submit="Filter cases">
      <FilterField label="Status"><Select name="status" defaultValue={filters.status ?? ""}><option value="">All statuses</option><option value="open">Open</option><option value="waiting_on_customer">Waiting on customer</option><option value="resolved">Resolved</option></Select></FilterField>
      <FilterField label="Source"><Select name="source" defaultValue={filters.source ?? ""}><option value="">All sources</option><option value="owner">Owner</option><option value="public">Public</option><option value="account">Account</option></Select></FilterField>
    </FilterBar>
    {cases.length ? (
      <RecordTable
        caption="Support cases"
        rows={cases}
        rowKey={(row) => row.id}
        href={(row) => recordHref(row.id)}
        columns={[
          { label: "Case", cell: (row) => <><RowLink href={recordHref(row.id)}><span className="line-clamp-2 break-words">{row.summary}</span></RowLink><Meta>{label(row.type)}</Meta></> },
          { label: "Status", cell: (row) => <Status tone={caseTone(row.status)}>{label(row.status)}</Status> },
          { label: "Source", cell: (row) => <span className="text-meta text-fg-secondary">{label(row.source)}</span> },
          { label: "Opened", cell: (row) => <span className="text-meta text-fg-secondary tabular-nums">{formatDateTime(row.createdAt)}</span> },
        ]}
        mobile={(row) => ({ title: <span className="line-clamp-2">{row.summary}</span>, status: <Status tone={caseTone(row.status)}>{label(row.status)}</Status>, subtitle: `${label(row.type)} · ${label(row.source)}`, meta: formatDateTime(row.createdAt), cta: "View case" })}
      />
    ) : (
      <EmptyPanel icon={LifeBuoy} title={filtered ? "No support cases match these filters" : "No support cases"}>{filtered ? "Try a different status or source." : "Customer support cases will appear here."}</EmptyPanel>
    )}
    <Pagination noun="cases" paging={paging} hrefFor={pageHref(basePath, filters)} />
  </main>;
}
