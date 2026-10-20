import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ClipboardList, Pencil, Plus } from "lucide-react";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { getPurchaser } from "@/modules/orders/purchasers";
import { countOrders, listOrders } from "@/modules/orders/queries";
import { PAGE_SIZE, pageWindow } from "@/modules/pagination";
import { adminPage, EmptyPanel, fieldLabel, Input, LinkButton, pageHref, PageHeader, Pagination, Section } from "../../../ui";
import { ActionSheet } from "../../../orders/[orderId]/action-sheet";
import { ActionForm } from "../../../inventory/forms";
import { OrdersTable } from "../../../orders/orders-table";
import { updatePurchaserAction } from "../../actions";
export const instant = false;
export default async function PurchaserPage({ params, searchParams }: PageProps<"/admin/customers/purchasers/[id]">) {
  await requireOwner(); await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const purchaser = await getPurchaser(db, id);
  if (!purchaser) notFound();
  const filters = await searchParams;
  const paging = pageWindow(await countOrders(db, { purchaserId: id }), filters.page);
  const page = await listOrders(db, { purchaserId: id, limit: PAGE_SIZE, offset: paging.offset });
  return <main data-admin-section="customers" className={adminPage}>
    <PageHeader
      back={{ href: "/admin/customers", label: "Purchasers" }}
      title={purchaser.name}
      description={purchaser.contactNumber ?? "No contact number"}
      actions={<>
        <ActionSheet title="Edit purchaser" description="Name and contact number." icon={<Pencil aria-hidden />}>
          <ActionForm action={updatePurchaserAction} submit="Save purchaser" variant="primary"><input type="hidden" name="id" value={id} /><label className={fieldLabel}>Name<Input name="name" required maxLength={100} defaultValue={purchaser.name} /></label><label className={fieldLabel}>Contact number<Input name="contactNumber" maxLength={50} defaultValue={purchaser.contactNumber ?? ""} /></label></ActionForm>
        </ActionSheet>
        <LinkButton href={`/admin/orders/new?purchaserId=${id}`} variant="action" icon={Plus}>New order</LinkButton>
      </>}
    />
    <Section title="Orders">
      {page.orders.length ? <OrdersTable orders={page.orders} showPurchaser={false} /> : <EmptyPanel icon={ClipboardList} title="No orders yet">Orders for this purchaser will be listed here.</EmptyPanel>}
      <Pagination noun="orders" paging={paging} hrefFor={pageHref(`/admin/customers/purchasers/${id}`, {})} />
    </Section>
  </main>;
}
