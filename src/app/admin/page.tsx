import { connection } from "next/server";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { dashboard } from "@/modules/orders/dashboard";
import { listOrders } from "@/modules/orders/queries";
import { monthTrends } from "@/modules/orders/trends";
import { expenseReport } from "@/modules/expenses/report";
import { listCases } from "@/modules/support/queries";
import { DashboardView } from "./dashboard-view";

export const instant = false;

export default async function AdminHome() {
  await requireOwner();
  await connection();
  const now = new Date();
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" }).format(now);
  const monthLabel = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "long" }).format(now);
  const [data, report, trends, recentOrders, openCases] = await Promise.all([dashboard(db, month), expenseReport(db, month), monthTrends(db, month), listOrders(db), listCases(db, { status: "open" })]);

  return <DashboardView {...{ month, monthLabel, data, report, trends, recentOrders, openCases }} />;
}
