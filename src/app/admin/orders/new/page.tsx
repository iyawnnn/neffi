import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { listProducts } from "@/modules/orders/products";
import { getPurchaser } from "@/modules/orders/purchasers";
import { OrderForm } from "./order-form";
import { getCaseDetail } from "@/modules/support/queries";

export const instant = false;

export default async function NewOrderPage({ searchParams }: PageProps<"/admin/orders/new">) {
  await requireOwner();
  await connection();
  const { purchaserId: queryPurchaserId, supportCaseId } = await searchParams;
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
  const products = await listProducts(db);
  return <main data-admin-section="orders" className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-8"><h1 className="text-2xl font-semibold">New order</h1>
    {supportCaseId ? <p>This is a paid replacement: a new sale linked to the support case.</p> : null}
    {!products.length ? <p>Set up <Link className="underline" href="/admin/settings">Products &amp; Pricing</Link> before taking an order.</p> : <OrderForm products={products} purchaser={purchaser} supportCaseId={supportCaseId as string | undefined} />}
  </main>;
}
