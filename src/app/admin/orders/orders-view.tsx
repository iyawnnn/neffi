import { ClipboardList, Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { listOrders, orderAssignees } from "@/modules/orders/queries";
import type { PageWindow } from "@/modules/pagination";
import { adminPageWide, EmptyPanel, FilterBar, FilterField, LinkButton, pageHref, PageHeader, Pagination, Select } from "../ui";
import { OrdersTable } from "./orders-table";

export type OrdersViewProps = {
  filters: { status?: "in_progress" | "completed" | "cancelled"; assigneeId?: string };
  paging: PageWindow;
  owners: Awaited<ReturnType<typeof orderAssignees>>;
  orders: Awaited<ReturnType<typeof listOrders>>["orders"];
  actions?: ReactNode;
  basePath?: string;
  recordHref?: (id: string) => string;
};

export function OrdersView({ filters, paging, owners, orders, actions, basePath = "/admin/orders", recordHref = (id) => `${basePath}/${id}` }: OrdersViewProps) {
  const filtered = Boolean(filters.status || filters.assigneeId);
  const create = actions === undefined ? <LinkButton href={`${basePath}/new`} variant="action" icon={Plus}>New order</LinkButton> : actions;
  return <main data-admin-section="orders" className={adminPageWide}>
    <PageHeader title="Orders" description="Manage customer orders and fulfillment." actions={create} />
    <FilterBar action={basePath} clearHref={filtered ? basePath : undefined} submit="Filter orders">
      <FilterField label="Status">
        <Select name="status" defaultValue={filters.status ?? ""}><option value="">All statuses</option><option value="in_progress">In Progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></Select>
      </FilterField>
      <FilterField label="Assigned to">
        <Select name="assigneeId" defaultValue={filters.assigneeId ?? ""}><option value="">All owners</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.email}</option>)}</Select>
      </FilterField>
    </FilterBar>
    {orders.length ? (
      <OrdersTable orders={orders} recordHref={recordHref} />
    ) : (
      <EmptyPanel icon={ClipboardList} title={filtered ? "No orders match these filters" : "No orders yet"} action={filtered ? undefined : create}>{filtered ? "Try a different status or owner." : "Orders you create will appear here."}</EmptyPanel>
    )}
    <Pagination noun="orders" paging={paging} hrefFor={pageHref(basePath, filters)} />
  </main>;
}
