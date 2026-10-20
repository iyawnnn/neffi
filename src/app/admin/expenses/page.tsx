import { connection } from "next/server";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { expenseCategory } from "@/db/schema/enums";
import { formatPeso } from "@/lib/money";
import { expenseReport } from "@/modules/expenses/report";
import { ActionForm } from "../inventory/forms";
import { ActionSheet } from "../orders/[orderId]/action-sheet";
import { fieldLabel, Input, label, Select, Textarea } from "../ui";
import { saveExpenseAction, deleteExpenseAction } from "./actions";
import { ExpensesView } from "./expenses-view";

export const instant = false;

type Entry = Pick<typeof expenses.$inferSelect, "id" | "spentOn" | "amount" | "category" | "payee" | "note" | "orderId">;

function ExpenseFields({ entry, today }: { entry?: Entry; today: string }) {
  return <>
    <input type="hidden" name="id" value={entry?.id ?? ""} />
    <label className={fieldLabel}>Date<Input type="date" name="spentOn" required defaultValue={entry?.spentOn ?? today} /></label>
    <label className={fieldLabel}>Amount (pesos)<Input name="amount" inputMode="decimal" required defaultValue={entry ? (entry.amount / 100).toFixed(2) : ""} /></label>
    <label className={fieldLabel}>Category<Select name="category" defaultValue={entry?.category ?? "other"}>{expenseCategory.enumValues.map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select></label>
    <label className={fieldLabel}>Payee (optional)<Input name="payee" maxLength={100} defaultValue={entry?.payee ?? ""} /></label>
    <label className={fieldLabel}>Note (optional)<Textarea name="note" maxLength={500} defaultValue={entry?.note ?? ""} /></label>
    <label className={fieldLabel}>Order ID (optional)<Input name="orderId" defaultValue={entry?.orderId ?? ""} /></label>
  </>;
}

function EditExpense({ entry, today, monthLabel }: { entry: Entry; today: string; monthLabel: string }) {
  return (
    <ActionSheet title="Edit expense" description={`${entry.spentOn} · ${formatPeso(entry.amount)}`} icon={<Pencil aria-hidden />} trigger="Edit">
      <ActionForm action={saveExpenseAction} submit="Save expense" variant="primary"><ExpenseFields entry={entry} today={today} /></ActionForm>
      <div className="border-t pt-5">
        <ActionForm
          action={deleteExpenseAction}
          submit="Delete expense"
          variant="destructive"
          confirm={{ field: "confirm", icon: <Trash2 className="size-5" />, title: "Delete expense?", description: `This permanently removes the ${formatPeso(entry.amount)} ${label(entry.category).toLowerCase()} expense${entry.payee ? ` paid to ${entry.payee}` : ""} from the ${monthLabel} report.`, confirmLabel: "Delete expense" }}
        >
          <input name="id" type="hidden" value={entry.id} />
        </ActionForm>
      </div>
    </ActionSheet>
  );
}

export default async function ExpensesPage({ searchParams }: PageProps<"/admin/expenses">) {
  await requireOwner(); await connection();
  const params = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const month = typeof params.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month) ? params.month : today.slice(0, 7);
  const report = await expenseReport(db, month);
  const monthLabel = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "long" }).format(new Date(`${month}-01T00:00:00Z`));
  return <ExpensesView {...{ month, monthLabel, report }} renderEdit={(entry) => <EditExpense entry={entry} today={today} monthLabel={monthLabel} />} actions={
        <ActionSheet title="Add expense" description="Manual costs only. Courier and stock costs are recorded from orders and inventory." icon={<Plus aria-hidden />} variant="action" defaultOpen={params.add === "1"}>
          <ActionForm action={saveExpenseAction} submit="Add expense" variant="primary"><ExpenseFields today={today} /></ActionForm>
        </ActionSheet>
  } />;
}
