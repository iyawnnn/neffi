import { connection } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { countOrders, listOrders, orderAssignees } from "@/modules/orders/queries";
import { PAGE_SIZE, pageWindow } from "@/modules/pagination";
import { OrdersView } from "./orders-view";

export const instant = false;

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireOwner();
  await connection();
  const params = await searchParams;
  const status = z.enum(["in_progress", "completed", "cancelled"]).safeParse(params.status);
  const assignee = z.uuid().safeParse(params.assigneeId);
  const filters = { status: status.success ? status.data : undefined, assigneeId: assignee.success ? assignee.data : undefined };
  const [total, owners] = await Promise.all([countOrders(db, filters), orderAssignees(db)]);
  const paging = pageWindow(total, params.page);
  const page = await listOrders(db, { ...filters, limit: PAGE_SIZE, offset: paging.offset });
  return <OrdersView filters={filters} paging={paging} owners={owners} orders={page.orders} />;
}
