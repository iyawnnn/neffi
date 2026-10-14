import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import * as s from "../../db/schema";
import { recordActivity } from "../activity/record";
import type { Db } from "../db";
import { SupportError } from "./errors";

type Case = typeof s.supportCases.$inferSelect;
export type CaseMutation = { caseId: string; actorId: string };
type Link = "purchaserId" | "accountId" | "orderId";

export async function lockCase(tx: Db, id: string): Promise<Case> {
  const [row] = await tx.select().from(s.supportCases).where(eq(s.supportCases.id, id)).for("no key update");
  if (!row) throw new SupportError("not_found");
  return row;
}

export async function withCase<T>(db: Db, input: CaseMutation & { requireActive?: boolean }, fn: (tx: Db, row: Case) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const row = await lockCase(tx, input.caseId);
    if (input.requireActive !== false && row.status === "resolved") throw new SupportError("case_resolved");
    const result = await fn(tx, row);
    await tx.update(s.supportCases).set({ updatedAt: new Date() }).where(eq(s.supportCases.id, row.id));
    return result;
  });
}

async function checkLink(tx: Db, field: Link, value: string) {
  const table = { purchaserId: s.purchasers, accountId: s.accounts, orderId: s.orders }[field];
  const [row] = await tx.select({ id: table.id }).from(table).where(eq(table.id, value));
  if (!row) throw new SupportError("not_found");
}

async function checkOwner(tx: Db, id: string) {
  const [owner] = await tx.select({ id: s.accounts.id }).from(s.accounts).where(and(eq(s.accounts.id, id), eq(s.accounts.role, "owner")));
  if (!owner) throw new SupportError("invalid_input");
}

export const openCaseSchema = z.object({ type: z.enum(s.supportCaseType.enumValues), summary: z.string().trim().min(1).max(500), purchaserId: z.uuid().optional(), accountId: z.uuid().optional(), orderId: z.uuid().optional(), cardId: z.uuid().optional(), assignedToAccountId: z.uuid().optional() });

export async function openCase(db: Db, input: { actorId: string } & Record<string, unknown>) {
  const parsed = openCaseSchema.safeParse(input);
  if (!parsed.success) throw new SupportError("invalid_input");
  const { cardId, ...data } = parsed.data;
  return db.transaction(async (tx) => {
    const assignedToAccountId = data.assignedToAccountId ?? input.actorId;
    await checkOwner(tx, assignedToAccountId);
    for (const field of ["purchaserId", "accountId", "orderId"] as const) if (data[field]) await checkLink(tx, field, data[field]);
    const [row] = await tx.insert(s.supportCases).values({ ...data, assignedToAccountId, openedByAccountId: input.actorId }).returning({ id: s.supportCases.id });
    await recordActivity(tx, { type: "support_case_opened", actorAccountId: input.actorId, supportCaseId: row.id, orderId: data.orderId });
    if (cardId) await linkCaseCard(tx, { caseId: row.id, actorId: input.actorId, cardId });
    return { caseId: row.id };
  });
}

export async function assignCase(db: Db, input: CaseMutation & { assignedToAccountId: string }) {
  return withCase(db, input, async (tx) => {
    await checkOwner(tx, input.assignedToAccountId);
    await tx.update(s.supportCases).set({ assignedToAccountId: input.assignedToAccountId }).where(eq(s.supportCases.id, input.caseId));
    await recordActivity(tx, { type: "support_case_assigned", actorAccountId: input.actorId, supportCaseId: input.caseId });
  });
}

export async function setCaseStatus(db: Db, input: CaseMutation & { status: "open" | "waiting_on_customer" | "resolved"; note?: string }) {
  if (!z.enum(s.supportCaseStatus.enumValues).safeParse(input.status).success || !z.string().trim().max(500).optional().safeParse(input.note).success) throw new SupportError("invalid_input");
  return withCase(db, input, async (tx, row) => {
    if (row.status === input.status) throw new SupportError("invalid_input");
    await tx.update(s.supportCases).set({ status: input.status, resolvedAt: input.status === "resolved" ? new Date() : null }).where(eq(s.supportCases.id, row.id));
    await recordActivity(tx, { type: input.status === "resolved" ? "support_case_resolved" : input.status === "waiting_on_customer" ? "support_case_waiting" : "support_case_reopened", actorAccountId: input.actorId, supportCaseId: row.id, note: input.note?.trim() });
  });
}

export async function reopenCase(db: Db, input: CaseMutation) {
  return withCase(db, { ...input, requireActive: false }, async (tx, row) => {
    if (row.status !== "resolved") throw new SupportError("invalid_input");
    await tx.update(s.supportCases).set({ status: "open", resolvedAt: null }).where(eq(s.supportCases.id, row.id));
    await recordActivity(tx, { type: "support_case_reopened", actorAccountId: input.actorId, supportCaseId: row.id });
  });
}

export async function addCaseNote(db: Db, input: CaseMutation & { note: string }) {
  if (!z.string().trim().min(1).max(500).safeParse(input.note).success) throw new SupportError("invalid_input");
  return withCase(db, { ...input, requireActive: false }, (tx) => recordActivity(tx, { type: "note", actorAccountId: input.actorId, supportCaseId: input.caseId, note: input.note.trim() }));
}

export async function fillCaseLink(db: Db, input: CaseMutation & { field: Link; value: string }) {
  if (!z.enum(["purchaserId", "accountId", "orderId"]).safeParse(input.field).success || !z.uuid().safeParse(input.value).success) throw new SupportError("invalid_input");
  return withCase(db, input, async (tx, row) => {
    if (row[input.field] !== null) throw new SupportError("link_exists");
    await checkLink(tx, input.field, input.value);
    await tx.update(s.supportCases).set({ [input.field]: input.value }).where(eq(s.supportCases.id, row.id));
    await recordActivity(tx, { type: "support_case_linked", actorAccountId: input.actorId, supportCaseId: row.id, accountId: input.field === "accountId" ? input.value : undefined, orderId: input.field === "orderId" ? input.value : undefined });
  });
}

export async function linkCaseCard(db: Db, input: CaseMutation & { cardId: string }) {
  return withCase(db, input, async (tx, row) => {
    const [card] = await tx.select({ id: s.cards.id }).from(s.cards).where(eq(s.cards.id, input.cardId));
    if (!card) throw new SupportError("not_found");
    const [linked] = await tx.insert(s.supportCaseCards).values({ supportCaseId: row.id, cardId: card.id, role: "affected" }).onConflictDoNothing().returning();
    if (!linked) throw new SupportError("link_exists");
    await recordActivity(tx, { type: "support_case_linked", actorAccountId: input.actorId, supportCaseId: row.id, cardId: card.id });
  });
}
