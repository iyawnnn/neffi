import Link from "next/link";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { cardStateCounts, listCards } from "@/modules/inventory/queries";
import { StockForm } from "./forms";
import { dateTime, KIND_LABEL, STATE_LABEL } from "./format";

export const instant = false;

const STATES = ["blank", "ready", "reserved", "released", "retired"] as const;

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  await requireOwner();
  const params = await searchParams;
  const before = Array.isArray(params.before) ? params.before[0] : params.before;
  const [counts, page] = await Promise.all([cardStateCounts(db), listCards(db, { before, limit: 50 })]);

  const kinds = ["dbc", "grc", null] as const;
  const countOf = (kind: (typeof kinds)[number], state: string) => counts.rows.find((row) => row.kind === kind && row.state === state)?.count ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>

      <section className="flex flex-col gap-2 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Cards by state</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 pr-3 font-normal">Product</th>
                {STATES.map((state) => (
                  <th key={state} className="py-1 pr-3 font-normal">
                    {STATE_LABEL[state]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kinds.map((kind) => (
                <tr key={kind ?? "none"}>
                  <th className="py-1 pr-3 font-normal">{KIND_LABEL[kind ?? "none"]}</th>
                  {STATES.map((state) => (
                    <td key={state} className="py-1 pr-3">
                      {countOf(kind, state)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground">In provisioning (token issued, not yet Ready): {counts.inProvisioning}</p>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Receive stock</h2>
        <StockForm today={new Date().toISOString().slice(0, 10)} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Cards</h2>
        <ul className="flex flex-col divide-y rounded-lg border">
          {page.cards.map((card) => (
            <li key={card.id}>
              <Link href={`/admin/inventory/cards/${card.id}`} className="flex flex-col gap-0.5 px-3 py-3 hover:bg-muted">
                <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
                  <span>{KIND_LABEL[card.kind ?? "none"]}</span>
                  <span className="rounded-md bg-muted px-2 py-1 text-xs">
                    {card.state === "blank" && card.publicToken ? "In provisioning" : STATE_LABEL[card.state]}
                  </span>
                </span>
                <span className="break-all font-mono text-xs text-muted-foreground">{card.publicToken ?? card.id}</span>
                <span className="text-xs text-muted-foreground">Added {dateTime(card.createdAt)}</span>
              </Link>
            </li>
          ))}
          {page.cards.length === 0 ? <li className="px-3 py-3 text-sm text-muted-foreground">No cards yet.</li> : null}
        </ul>
        {page.next ? (
          <Link href={`/admin/inventory?before=${encodeURIComponent(page.next)}`} className="text-sm underline">
            Older cards
          </Link>
        ) : null}
      </section>
    </main>
  );
}
