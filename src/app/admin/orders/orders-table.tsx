import { formatDate } from "@/lib/format-date";
import { formatPeso } from "@/lib/money";
import { label, Meta, orderTone, RecordTable, RowLink, Status } from "../ui";

type OrderRow = { id: string; number: number; purchaserName: string; status: string; orderTotal: number | null; balance: number | null; createdAt: Date };
const moneyOrPending = (amount: number | null) => amount === null ? "Pending shipping" : formatPeso(amount);

// Shared by the Orders index, the dashboard and a purchaser's order history.
export function OrdersTable({ orders, showPurchaser = true, recordHref = (id) => `/admin/orders/${id}` }: { orders: OrderRow[]; showPurchaser?: boolean; recordHref?: (id: string) => string }) {
  return (
    <RecordTable
      caption="Orders"
      rows={orders}
      rowKey={(order) => order.id}
      href={(order) => recordHref(order.id)}
      columns={[
        { label: "Order", cell: (order) => <><RowLink href={recordHref(order.id)}>Order {order.number}</RowLink>{showPurchaser ? <Meta>{order.purchaserName}</Meta> : null}</> },
        { label: "Status", cell: (order) => <Status tone={orderTone(order.status)}>{label(order.status)}</Status> },
        { label: "Created", cell: (order) => <span className="text-meta text-fg-secondary tabular-nums">{formatDate(order.createdAt)}</span> },
        { label: "Total", align: "right", cell: (order) => moneyOrPending(order.orderTotal) },
        { label: "Balance", align: "right", cell: (order) => <span className={order.balance !== null && order.balance > 0 ? "font-medium" : "text-fg-secondary"}>{moneyOrPending(order.balance)}</span> },
      ]}
      mobile={(order) => ({
        title: `Order ${order.number}`,
        status: <Status tone={orderTone(order.status)}>{label(order.status)}</Status>,
        subtitle: showPurchaser ? order.purchaserName : undefined,
        figures: [["Total", moneyOrPending(order.orderTotal)], ["Balance", moneyOrPending(order.balance)]],
        meta: formatDate(order.createdAt),
        cta: "View order",
      })}
    />
  );
}
