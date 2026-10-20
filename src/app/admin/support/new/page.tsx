import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { supportCaseType } from "@/db/schema";
import { accountDirectoryDetail } from "@/modules/accounts/directory";
import { getPurchaser } from "@/modules/orders/purchasers";
import { getOrderDetail, orderAssignees } from "@/modules/orders/queries";
import { getCardDetail } from "@/modules/inventory/queries";
import { adminPageWide, PageHeader } from "../../ui";
import { ActionForm } from "../../inventory/forms";
import { KIND_LABEL } from "../../inventory/format";
import { openCaseAction } from "../[caseId]/actions";
import { CaseFields, type LinkedRecord } from "./case-form";

export const instant = false;

const linkFields = ["orderId", "purchaserId", "accountId", "cardId"] as const;

export default async function NewCasePage({ searchParams }: Pick<PageProps<"/admin/support/new">, "searchParams">) {
  const owner = await requireOwner();
  await connection();
  const params = await searchParams;
  const assignees = await orderAssignees(db);

  // A link in the URL (from an order or customer page) arrives already chosen, with the same checks the record page makes.
  const initial: LinkedRecord[] = [];
  for (const field of linkFields) {
    const value = params[field];
    if (value === undefined) continue;
    if (typeof value !== "string" || !z.uuid().safeParse(value).success) notFound();
    if (field === "orderId") {
      const order = await getOrderDetail(db, value);
      if (!order) notFound();
      initial.push({ field, id: value, title: `Order ${order.number}`, subtitle: order.purchaser.name });
    } else if (field === "purchaserId") {
      const purchaser = await getPurchaser(db, value);
      if (!purchaser) notFound();
      initial.push({ field, id: value, title: purchaser.name, subtitle: purchaser.contactNumber ?? "No contact number" });
    } else if (field === "accountId") {
      const account = await accountDirectoryDetail(db, value);
      if (!account) notFound();
      initial.push({ field, id: value, title: account.email, subtitle: "Neffi account" });
    } else {
      const card = await getCardDetail(db, value);
      if (!card) notFound();
      initial.push({ field, id: value, title: `•••• ${(card.publicToken ?? card.id).slice(-4).toUpperCase()}`, subtitle: KIND_LABEL[card.kind ?? "none"] });
    }
  }

  return <main data-admin-section="support" className={adminPageWide}>
    <PageHeader back={{ href: "/admin/support", label: "Support" }} title="Open support case" description="Create an internal case and link the records it concerns." />
    <ActionForm action={openCaseAction} submit="Open support case" variant="primary" className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-x-8">
      <CaseFields types={[...supportCaseType.enumValues]} assignees={assignees} ownerId={owner.accountId} initial={initial} />
    </ActionForm>
  </main>;
}
