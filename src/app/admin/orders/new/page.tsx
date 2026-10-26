import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { listProducts } from "@/modules/orders/products";
import { getPurchaser } from "@/modules/orders/purchasers";
import { adminPageWide, inlineLink, PageHeader } from "../../ui";
import { NormalOrderForm } from "./normal-order-form";
import { OrderForm } from "./order-form";
import { getCaseDetail } from "@/modules/support/queries";

export const instant = false;

export default async function NewOrderPage({ searchParams }: PageProps<"/admin/orders/new">) {
  await requireOwner();
  await connection();
  const { purchaserId: queryPurchaserId, supportCaseId, product } = await searchParams;
  const grc = product === "grc";
  let purchaserId = queryPurchaserId;
  if (supportCaseId !== undefined) {
    if (!z.uuid().safeParse(supportCaseId).success) notFound();
    const support = await getCaseDetail(db, supportCaseId as string);
    if (!support || support.status === "resolved") notFound();
    purchaserId ??= support.purchaserId ?? support.order?.purchaserId ?? undefined;
  }
  let purchaser;
  if (purchaserId !== undefined) {
    if (!z.uuid().safeParse(purchaserId).success) notFound();
    purchaser = await getPurchaser(db, purchaserId as string);
    if (!purchaser) notFound();
  }
  const products = grc ? (await listProducts(db)).filter((entry) => entry.kind === "grc") : [];
  return <main data-admin-section="orders" className={adminPageWide}>
    <PageHeader back={{ href: "/admin/orders", label: "Orders" }} title={grc ? "New Google Review Card order" : "Create order"} description={grc ? "Record a Google Review Card sale. Neffi Digital Business Cards use the standard order." : supportCaseId ? "This is a paid replacement: a new sale linked to the support case." : "Customer, quantity, payment method and delivery. The product price is already received."} />
    {!grc ? <>
      <NormalOrderForm clientKey={randomUUID()} purchaser={purchaser} supportCaseId={supportCaseId as string | undefined} />
      {supportCaseId === undefined ? <p className="text-meta text-fg-secondary">Selling a Google Review Card instead? <Link className={inlineLink} href="/admin/orders/new?product=grc">Create a Google Review Card order</Link></p> : null}
    </> : !products.length ? <p className="text-body">Set up <Link className={inlineLink} href="/admin/settings">Products &amp; Pricing</Link> before taking an order.</p> : <OrderForm products={products} purchaser={purchaser} supportCaseId={supportCaseId as string | undefined} />}
  </main>;
}
