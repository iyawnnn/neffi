import "server-only";
import { z } from "zod";
import type { Db } from "../db";
import { recordPayment, recordRefund } from "../payments/record";
import { voidPayment, voidRefund } from "../payments/void";
import { withCase, type CaseMutation } from "./case";
import { SupportError } from "./errors";

type MoneyMutation = CaseMutation & { orderId: string; reason: string };

async function withMoney(db: Db, input: MoneyMutation, fn: (tx: Db) => Promise<void>) {
  if (!z.string().trim().min(1).max(200).safeParse(input.reason).success) throw new SupportError("invalid_input");
  return withCase(db, input, async (tx, row) => {
    if (!row.orderId || row.orderId !== input.orderId) throw new SupportError("wrong_order");
    await fn(tx);
  });
}

export function afterSaleRefund(db: Db, input: MoneyMutation & Omit<Parameters<typeof recordRefund>[1], "supportCaseId">) {
  return withMoney(db, input, (tx) => recordRefund(tx, { ...input, supportCaseId: input.caseId }));
}

export function voidAfterSaleRefund(db: Db, input: MoneyMutation & { refundId: string }) {
  return withMoney(db, input, (tx) => voidRefund(tx, { ...input, supportCaseId: input.caseId }));
}

export function voidCompletedPayment(db: Db, input: MoneyMutation & { paymentId: string }) {
  return withMoney(db, input, (tx) => voidPayment(tx, { ...input, supportCaseId: input.caseId }));
}

export function recordCompletedPayment(db: Db, input: MoneyMutation & Omit<Parameters<typeof recordPayment>[1], "supportCaseId">) {
  return withMoney(db, input, (tx) => recordPayment(tx, { ...input, supportCaseId: input.caseId }));
}
