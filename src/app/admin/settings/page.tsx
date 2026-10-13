import { connection } from "next/server";
import { requireOwner } from "@/auth/access";
import { Input } from "@/components/ui/input";
import { db } from "@/db";
import { formatDateTime } from "@/lib/format-date";
import { listOwnerAccess, listProducts } from "@/modules/orders/products";
import { ActionForm } from "../inventory/forms";
import { saveProductAction } from "./actions";

export const instant = false;

export default async function SettingsPage() {
  await requireOwner();
  await connection();
  const [products, owners] = await Promise.all([listProducts(db), listOwnerAccess(db)]);
  return <main data-admin-section="settings" className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 sm:p-8">
    <h1 className="text-2xl font-semibold">Settings</h1>
    <section className="space-y-5">
      <h2 className="text-xl font-semibold">Products &amp; Pricing</h2>
      <p className="text-sm text-muted-foreground">Edit catalog prices here. Existing orders keep their original prices.</p>
      {(["dbc", "grc"] as const).map((kind) => {
        const product = products.find((p) => p.kind === kind);
        return <div key={kind} className="space-y-3 border-b pb-6">
          <h3 className="font-medium">{kind === "dbc" ? "Digital Business Card" : "Google Review Card"}</h3>
          <ActionForm action={saveProductAction} submit={product ? "Save product" : "Create product"}>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="productId" value={product?.id ?? ""} />
            <label className="flex flex-col gap-1 text-sm">Name<Input name="name" required maxLength={100} defaultValue={product?.name} /></label>
            <label className="flex flex-col gap-1 text-sm">Price (pesos)<Input name="price" required inputMode="decimal" maxLength={30} defaultValue={product ? (product.price / 100).toFixed(2) : undefined} /></label>
          </ActionForm>
        </div>;
      })}
    </section>
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Owner Access</h2>
      <p className="text-sm text-muted-foreground">Read-only. Both owners have equal access.</p>
      {owners.map((owner) => <div key={owner.email} className="border-b py-3"><p className="break-all font-medium">{owner.email}</p><p className="text-sm text-muted-foreground">Owner · Joined {formatDateTime(owner.createdAt)}</p></div>)}
      {!owners.length ? <p>No owners found.</p> : null}
    </section>
  </main>;
}
