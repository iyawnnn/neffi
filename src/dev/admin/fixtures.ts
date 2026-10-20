import type { OrdersViewProps } from "@/app/admin/orders/orders-view";
import type { SupportViewProps } from "@/app/admin/support/support-view";
import type { InventoryViewProps } from "@/app/admin/inventory/inventory-view";
import type { ExpenseRow } from "@/modules/expenses/report";
import type { SearchHit } from "@/modules/search-types";
import { pageWindow } from "@/modules/pagination";

export const MONTH = "2026-10";
export const MONTH_LABEL = "October 2026";
export const PREVIEW_BASE = "/dev/admin-preview";
const day = (n: number) => `${MONTH}-${String(n).padStart(2, "0")}`;
const date = (n: number, hour = 9) => new Date(`${day(n)}T${String(hour).padStart(2, "0")}:00:00+08:00`);
const id = (kind: string, n: number) => `preview-${kind}-${String(n + 1).padStart(3, "0")}`;
const names = ["Juan Dela Cruz", "Maria Santos", "Paolo Reyes", "Isabel Garcia", "Miguel Tan", "Camille Mendoza", "Rafael Lim", "Andrea Ramos", "Jose Bautista", "Sofia Villanueva", "Luis Aquino", "Bianca Flores", "Gabriel Castillo", "Patricia Navarro", "Marco Santiago", "Elena Torres", "Carlo Mercado", "Diana Cruz", "Angelo Rivera", "Bea Sy", "Nico Fernandez", "Lara Gonzales", "Enzo Valdez", "Mika Salazar", "Adrian Chua", "Julia Soriano", "Anton Perez", "Clara David", "Diego Uy", "Althea Lopez", "Joaquin Ong", "Nina Evangelista", "Francis Co", "Sam Domingo", "Mara Pineda", "Leo Manalo", "Studio Sampaguita", "Tala Design Collective", "Amihan Coffee", "Luntian Creative Studio", "Sinag Community Workshop", "Habi Manila", "The Sampaguita Creative Consultancy and Community Learning Cooperative Services"];

const customers = names.map((name, i) => ({ id: id("customer", i), name, contactNumber: i % 9 === 0 ? null : `09XX 000 ${String(i + 1).padStart(4, "0")}` }));
export const accounts = customers.map((customer, i) => ({ id: id("account", i), email: `sample.${String(i + 1).padStart(2, "0")}@example.invalid`, role: "customer" as const, createdAt: date(1 + i % 31) }));
export const owners = [{ id: "preview-owner", email: "owner@example.invalid" }];
const activeDays = Array.from({ length: 31 }, (_, i) => i + 1).filter((n) => n !== 7 && n !== 21);

export const orders = Array.from({ length: 102 }, (_, i) => {
  const purchaser = customers[i % customers.length];
  const status = (i % 11 === 0 ? "cancelled" : i % 3 === 0 ? "in_progress" : "completed") as OrdersViewProps["orders"][number]["status"];
  const productKind = i % 4 === 0 ? "grc" as const : "dbc" as const;
  const quantity = i === 41 ? 40 : 1 + i % 5;
  const deliveryMethod = (["pickup", "courier", "local_handoff"] as const)[i % 3];
  const shippingFee = deliveryMethod === "courier" ? 18000 : 0;
  const orderTotal = quantity * (productKind === "dbc" ? 65000 : 35000) + shippingFee;
  const collected = status === "cancelled" ? 0 : status === "completed" ? orderTotal : i % 2 === 0 ? Math.floor(orderTotal / 2) : 0;
  const createdDay = activeDays[(i * 7 + Math.floor(i / 9)) % activeDays.length];
  return { id: id("order", i), number: 260001 + i, purchaserId: purchaser.id, purchaserName: purchaser.name, status, assignedToAccountId: owners[0].id, createdAt: date(createdDay, 8 + i % 10), cursor: "", orderTotal, balance: status === "cancelled" ? 0 : orderTotal - collected, collected, paidOn: day(createdDay), productKind, quantity, deliveryMethod, shippingFee };
}).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.number - a.number);

export const cards = Array.from({ length: 63 }, (_, i) => {
  const state = (["blank", "ready", "reserved", "released", "retired", "blank", "released"] as const)[i % 7];
  const kind = state === "blank" && i % 4 === 0 ? null : i % 4 === 1 ? "grc" as const : "dbc" as const;
  const publicToken = kind && (state !== "blank" || (kind === "dbc" && i % 2 === 1)) ? `PREVIEW-CARD-${String(i + 1).padStart(4, "0")}` : null;
  const order = state === "reserved" || state === "released" ? orders.filter((row) => row.status !== "cancelled" && row.productKind === kind)[i % orders.filter((row) => row.status !== "cancelled" && row.productKind === kind).length] : null;
  return { id: id("card", i), stockPurchaseId: id("stock", i % 4), kind, state, publicToken, nfcVerifiedAt: publicToken && state !== "blank" ? date(1) : null, packageMatchedAt: publicToken && state !== "blank" ? date(1) : null, createdAt: date(1 + i % 31), purchaserId: order?.purchaserId ?? null, orderId: order?.id ?? null };
}).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id));

export const purchasers = customers.map((customer) => ({ ...customer, orderCount: orders.filter((row) => row.purchaserId === customer.id).length, cardCount: cards.filter((row) => row.purchaserId === customer.id).length })).sort((a, b) => a.name.localeCompare(b.name));

const categoryAmounts: [ExpenseRow["category"], number[]][] = [
  ["inventory_production", [650000, 480000, 390000, 280000]],
  ["packaging_printing", [120000, 160000, 90000, 130000, 150000, 210000]],
  ["shipping_delivery", [85000, 90000, 110000, 65000, 130000, 80000, 100000]],
  ["software_operations", [95000, 85000, 60000, 110000]],
  ["marketing", [70000, 90000, 100000, 80000, 60000]],
  ["other", [45000, 65000, 55000, 75000, 50000, 40000]],
];
export const expenses: ExpenseRow[] = categoryAmounts.flatMap(([category, amounts], c) => amounts.map((amount, i) => ({ id: c === 0 || (c === 2 && i < 4) ? id("stock", i) : id("expense", c * 10 + i), source: c === 0 ? "stock" as const : c === 2 ? i < 4 ? "inbound" as const : "courier" as const : "manual" as const, spentOn: day(activeDays[(i * 5 + (c === 2 && i < 4 ? 0 : c * 3)) % activeDays.length]), amount, category, payee: ["Sample card workshop", "Sample packaging & print shop", "Sample delivery service", "Sample software provider", "Sample campaign studio", "Sample office supplies"][c], note: ["October card production batch", "Sleeves, labels and printed inserts", "Delivery and courier costs", "Monthly operating tools", "Local campaign materials", "Workshop supplies and incidental costs"][c], orderId: c === 2 && i >= 4 ? orders.filter((row) => row.deliveryMethod === "courier")[i].id : null }))).sort((a, b) => b.spentOn.localeCompare(a.spentOn) || a.id.localeCompare(b.id));

export const purchases: InventoryViewProps["purchases"] = Array.from({ length: 4 }, (_, i) => {
  const purchase = expenses.find((row) => row.source === "stock" && row.id === id("stock", i))!;
  const inbound = expenses.find((row) => row.source === "inbound" && row.id === purchase.id)!;
  const stockCards = cards.filter((row) => row.stockPurchaseId === purchase.id);
  return { id: purchase.id, receivedOn: purchase.spentOn, supplier: "Sample card workshop", purchaseCost: purchase.amount, inboundShippingCost: inbound.amount, reference: `TEST-DELIVERY-${i + 1}`, notes: "Synthetic delivery", createdByAccountId: owners[0].id, createdAt: new Date(`${purchase.spentOn}T09:00:00+08:00`), quantity: stockCards.length, states: Object.fromEntries([...new Set(stockCards.map((row) => row.state))].map((state) => [state, stockCards.filter((row) => row.state === state).length])) };
}).sort((a, b) => b.receivedOn.localeCompare(a.receivedOn));

export const report = {
  rows: expenses,
  total: expenses.reduce((sum, row) => sum + row.amount, 0),
  categories: Object.fromEntries(categoryAmounts.map(([category]) => [category, expenses.filter((row) => row.category === category).reduce((sum, row) => sum + row.amount, 0)])),
};

const topics = ["activation_issue", "account_recovery", "ownership_correction", "defective_card", "shipping_issue", "replacement", "other"] as const;
const summaries = ["Help with first card activation", "Account access assistance requested", "Confirm the correct card owner", "Card is not scanning consistently", "Delivery address needs clarification", "Replacement for a damaged card", "Question about updating profile details"];
export const cases = Array.from({ length: 23 }, (_, i) => ({ id: id("case", i), type: topics[i % topics.length], status: (["open", "waiting_on_customer", "resolved", "resolved"] as const)[i % 4], source: (["owner", "public", "account"] as const)[i % 3], summary: `TEST-${String(i + 1).padStart(3, "0")} · ${summaries[i % summaries.length]}${i === 0 ? " for The Sampaguita Creative Consultancy and Community Learning Cooperative — customer requested a follow-up after their team event" : ` · ${customers[i % customers.length].name}`}`, assignedToAccountId: i % 3 ? owners[0].id : null, createdAt: date(1 + i * 4 % 31, 10 + i % 8), cursor: "", orderId: orders[i].id, purchaserId: orders[i].purchaserId, accountId: accounts[i].id, cardId: cards[i].id })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

export const counts: InventoryViewProps["counts"] = {
  rows: Array.from(new Set(cards.map((row) => `${row.kind ?? "none"}:${row.state}`))).map((key) => {
    const rows = cards.filter((row) => `${row.kind ?? "none"}:${row.state}` === key);
    return { kind: rows[0].kind, state: rows[0].state, count: rows.length };
  }),
  inProvisioning: cards.filter((row) => row.kind === "dbc" && row.state === "blank" && row.publicToken).length,
};

export const trends = {
  collected: activeDays.map((n) => ({ day: day(n), amount: orders.filter((row) => row.paidOn === day(n)).reduce((sum, row) => sum + row.collected, 0) })),
  orders: activeDays.flatMap((n) => (["in_progress", "completed", "cancelled"] as const).map((status) => ({ day: day(n), status, count: orders.filter((row) => row.paidOn === day(n) && row.status === status).length }))),
};
export const dashboardData = {
  inProgress: orders.filter((row) => row.status === "in_progress").length,
  outstanding: orders.filter((row) => row.status !== "cancelled").reduce((sum, row) => sum + row.balance, 0),
  collected: orders.reduce((sum, row) => sum + row.collected, 0),
  expenses: report.total,
  openSupportCases: cases.filter((row) => row.status !== "resolved").length,
  stock: counts,
  recent: orders.slice(0, 15).map((row, i) => ({ id: id("event", i), type: row.collected ? "payment_recorded" : "order_created", note: `Order #${row.number} · ${row.purchaserName}`, orderId: row.id, cardId: null, stockPurchaseId: null, createdAt: row.createdAt })),
};

export const searchHits: SearchHit[] = [
  ...orders.map((row): SearchHit => ({ type: "order", id: row.id, title: `#${row.number}`, subtitle: row.purchaserName, status: row.status, matched: "Order number / customer" })),
  ...purchasers.map((row): SearchHit => ({ type: "customer", id: row.id, title: row.name, subtitle: row.contactNumber ?? "No contact", status: null, matched: "Name / contact" })),
  ...accounts.map((row): SearchHit => ({ type: "account", id: row.id, title: row.email, subtitle: row.role, status: null, matched: "Email" })),
  ...cards.map((row): SearchHit => ({ type: "card", id: row.id, title: (row.publicToken ?? row.id).slice(-4).toUpperCase(), subtitle: row.kind ?? "none", status: row.state, matched: "Card ending" })),
  ...cases.map((row): SearchHit => ({ type: "support", id: row.id, title: row.summary, subtitle: row.type, status: row.status, matched: "Case summary / reference" })),
];

export function searchFixtures(query: string) {
  const term = query.trim().slice(0, 100).toLowerCase();
  return term.length < 2 ? [] : searchHits.filter((hit) => `${hit.title} ${hit.subtitle}`.toLowerCase().includes(term));
}

export function fixturePage<T>(rows: T[], requested: unknown, size = 20) {
  const window = pageWindow(rows.length, requested, size);
  return { rows: rows.slice(window.offset, window.offset + window.size), window };
}

export function filterOrders(filters: OrdersViewProps["filters"]) {
  return orders.filter((row) => (!filters.status || row.status === filters.status) && (!filters.assigneeId || row.assignedToAccountId === filters.assigneeId));
}
export function filterCards(filters: InventoryViewProps["filters"]) {
  return cards.filter((row) => (!filters.state || row.state === filters.state) && (!filters.kind || (row.kind ?? "none") === filters.kind));
}
export function filterCases(filters: SupportViewProps["filters"]) {
  return cases.filter((row) => (!filters.status || row.status === filters.status) && (!filters.source || row.source === filters.source));
}

export const previewHref = (path: string) => path.replace(/^\/admin(?=\/|\?|$)/, PREVIEW_BASE);
export const previewHitHref = (hit: SearchHit) => `${PREVIEW_BASE}/search?q=${encodeURIComponent(hit.title)}&record=${encodeURIComponent(hit.id)}`;
