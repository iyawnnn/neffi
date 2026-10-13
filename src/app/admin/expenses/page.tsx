import Link from "next/link";
import { connection } from "next/server";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { expenseCategory } from "@/db/schema/enums";
import { formatPeso } from "@/lib/money";
import { expenseReport } from "@/modules/expenses/report";
import { ActionForm } from "../inventory/forms";
import { saveExpenseAction, deleteExpenseAction } from "./actions";
import { inputClass } from "@/components/ui/input";

export const instant = false;
function ExpenseFields({ entry, today }: { entry?: Pick<typeof expenses.$inferSelect, "id" | "spentOn" | "amount" | "category" | "payee" | "note" | "orderId">; today: string }) {
  return <>
    <input type="hidden" name="id" value={entry?.id ?? ""} />
    <label>Date<input className={inputClass} type="date" name="spentOn" required defaultValue={entry?.spentOn ?? today} /></label>
    <label>Amount (pesos)<input className={inputClass} name="amount" inputMode="decimal" required defaultValue={entry ? (entry.amount / 100).toFixed(2) : ""} /></label>
    <label>Category<select className={inputClass} name="category" defaultValue={entry?.category ?? "other"}>{expenseCategory.enumValues.map((c) => <option key={c} value={c}>{c.replaceAll("_", " ")}</option>)}</select></label>
    <label>Payee (optional)<input className={inputClass} name="payee" maxLength={100} defaultValue={entry?.payee ?? ""} /></label>
    <label>Note (optional)<textarea className="w-full rounded-lg border p-3" name="note" maxLength={500} defaultValue={entry?.note ?? ""} /></label>
    <label>Order ID (optional)<input className={inputClass} name="orderId" defaultValue={entry?.orderId ?? ""} /></label>
  </>;
}
export default async function ExpensesPage({ searchParams }: PageProps<"/admin/expenses">) {
  await requireOwner(); await connection();
  const params = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const month = typeof params.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month) ? params.month : today.slice(0, 7);
  const report = await expenseReport(db, month);
  return <main data-admin-section="expenses" className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
    <h1 className="text-2xl font-semibold">Expenses</h1><form className="flex gap-2"><label>Month<input className={inputClass} type="month" name="month" defaultValue={month} /></label><button className="min-h-11 self-end rounded-lg border px-4">View</button></form>
    <p className="text-xl font-semibold">Total {formatPeso(report.total)}</p><dl className="grid gap-2 sm:grid-cols-2">{Object.entries(report.categories).map(([category, amount]) => <div key={category}><dt>{category.replaceAll("_", " ")}</dt><dd>{formatPeso(amount)}</dd></div>)}</dl>
    <section id="add" className="rounded-lg border p-4"><h2 className="mb-3 font-semibold">Add expense</h2><ActionForm action={saveExpenseAction} submit="Add expense"><ExpenseFields today={today} /></ActionForm></section>
    {report.rows.map((row) => <section key={`${row.source}-${row.id}`} className="rounded-lg border p-4"><p>{row.spentOn} · {row.category.replaceAll("_", " ")} · {formatPeso(row.amount)}</p><p className="text-sm">{row.payee} {row.note}</p>
      {row.source === "manual" ? <details><summary className="min-h-11 cursor-pointer py-3">Edit manual expense</summary><ActionForm action={saveExpenseAction} submit="Save expense"><ExpenseFields entry={row} today={today} /></ActionForm><ActionForm action={deleteExpenseAction} submit="Delete manual expense" variant="destructive"><input name="id" type="hidden" value={row.id} /><label><input name="confirm" type="checkbox" required /> Confirm deletion</label></ActionForm></details> : <Link className="flex min-h-11 items-center underline" href={row.source === "courier" ? `/admin/orders/${row.orderId}` : `/admin/inventory/stock/${row.id}`}>View source ({row.source})</Link>}
    </section>)}{!report.rows.length ? <p>No expenses this month.</p> : null}
  </main>;
}
