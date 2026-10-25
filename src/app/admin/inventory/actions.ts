"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/auth/access";
import { env } from "@/config/env";
import { db } from "@/db";
import { formatActivationCode } from "@/modules/activation/code";
import { ActivationCredentialError } from "@/modules/activation/credentials";
import { CardError, recordNfcCheck, retireCard, type CardErrorCode } from "@/modules/cards/card";
import { matchPackage, provisionDbc, replaceProvisioningCredential } from "@/modules/cards/dbc";
import { reserveGrc } from "@/modules/cards/grc";
import { cardUrl } from "@/modules/cards/token";
import { receiveStock } from "@/modules/inventory/stock-intake";
import { updateStockPurchase } from "@/modules/inventory/stock-purchases";
import { parsePesos } from "@/lib/money";
import { OrderError } from "@/modules/orders/errors";

// Every action is a public endpoint: authorize as OWNER first, then validate, then call the domain service.
// A raw activation code appears only in the `reveal` of the response that issued it.
export type ActionState = { error?: string; ok?: string; href?: string; reveal?: { code: string; url?: string; instructions?: string } };

const MESSAGES: Record<CardErrorCode, string> = {
  not_found: "That card was not found.",
  wrong_state: "That isn't available for the card's current state.",
  already_provisioned: "This card is already provisioned. If its code was lost, use Replace credential.",
  credential_changed: "The credential changed since this page loaded. Reload the card and try again.",
  code_mismatch: "That code doesn't match this card's package.",
  no_product: "There must be exactly one active product of that kind.",
  item_ineligible: "That order item can't take another card.",
  item_full: "That order item already has all of its cards.",
  checks_incomplete: "Complete every physical check first.",
  uri_mismatch: "The address you read back doesn't match the expected one.",
};

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => z.preprocess((value) => (value === "" ? undefined : value), text(max).optional());
const checked = z.literal("on");
const id = z.uuid();
const reason = text(200).min(1);

async function run<S extends z.ZodType>(
  schema: S,
  data: FormData,
  act: (input: z.output<S>, actorId: string) => Promise<ActionState | void>,
  revalidate: (input: z.output<S>) => string[] = () => [],
): Promise<ActionState> {
  const authorization = await authorize("owner");
  if (!authorization.ok) return { error: "You aren't allowed to do that." };

  const parsed = schema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: "Check the form and try again." };

  try {
    const result = (await act(parsed.data, authorization.viewer.accountId)) ?? {};
    for (const path of ["/admin/inventory", ...revalidate(parsed.data)]) revalidatePath(path);
    return result;
  } catch (error) {
    if (error instanceof CardError) return { error: MESSAGES[error.code] };
    if (error instanceof ActivationCredentialError) return { error: "A new activation code could not be issued. Please try again." };
    if (error instanceof OrderError) return { error: "That stock purchase could not be saved. Reload and check the fields." };
    throw error;
  }
}

const cardPage = ({ cardId }: { cardId: string }) => [`/admin/inventory/cards/${cardId}`];

const optionalCost = z.preprocess((value) => value == null || value === "" ? null : value, z.string().max(30).nullable().transform((value, ctx) => {
  if (value === null) return null;
  try { return parsePesos(value); } catch { ctx.addIssue({ code: "custom", message: "Invalid amount" }); return z.NEVER; }
}));
const stockFields = z.object({ receivedOn: z.iso.date(), supplier: optionalText(100), reference: optionalText(100), notes: optionalText(500), purchaseCost: optionalCost, inboundShippingCost: optionalCost });

export async function updateStockPurchaseAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(stockFields.extend({ stockPurchaseId: id }), data, async (input) => {
    await updateStockPurchase(db, { ...input, supplier: input.supplier ?? null, reference: input.reference ?? null, notes: input.notes ?? null });
    return { ok: "Stock purchase saved." };
  }, ({ stockPurchaseId }) => [`/admin/inventory/stock/${stockPurchaseId}`, "/admin/expenses", "/admin"]);
}

export async function receiveStockAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  const schema = z.object({
    receivedOn: z.iso.date(),
    quantity: z.coerce.number().int().min(1).max(500),
    supplier: optionalText(100),
    reference: optionalText(100),
    notes: optionalText(500),
    intendedKind: z.preprocess((value) => (value === "" ? undefined : value), z.enum(["dbc", "grc"]).optional()),
    purchaseCost: optionalCost,
    inboundShippingCost: optionalCost,
  });
  return run(schema, data, async (input, actorId) => {
    const { stockPurchaseId } = await receiveStock(db, { actorId, ...input });
    return { ok: `Received ${input.quantity} cards.`, href: `/admin/inventory/stock/${stockPurchaseId}` };
  });
}

export async function provisionDbcAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(
    z.object({ cardId: id }),
    data,
    async ({ cardId }, actorId) => {
      const { publicToken, activationCode } = await provisionDbc(db, { actorId, cardId, secrets: { lookupSecret: env.activationCodeSecret, activeKeyId: env.activationCodeEncryptionActiveKeyId, encryptionKeys: env.activationCodeEncryptionKeys } });
      return { reveal: { url: cardUrl(env.cardUrlOrigin, publicToken), code: formatActivationCode(activationCode) } };
    },
    cardPage,
  );
}

export async function recordNfcCheckAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  const schema = z.object({
    cardId: id,
    readBackUri: text(2048).min(1),
    readBackMatched: checked,
    phoneOpenedUri: checked,
    tagLeftWritable: checked,
    device: optionalText(100),
  });
  return run(
    schema,
    data,
    async ({ cardId, readBackUri, device }, actorId) => {
      await recordNfcCheck(db, {
        actorId,
        cardId,
        cardUrlOrigin: env.cardUrlOrigin,
        readBackUri,
        readBackMatched: true,
        phoneOpenedUri: true,
        tagLeftWritable: true,
        device,
      });
      return { ok: "NFC check recorded." };
    },
    cardPage,
  );
}

export async function matchPackageAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(
    z.object({ cardId: id, activationCode: text(64).min(1) }),
    data,
    async ({ cardId, activationCode }, actorId) => {
      await matchPackage(db, { actorId, cardId, activationCode, activationSecret: env.activationCodeSecret });
      return { ok: "Package matched. The card is Ready." };
    },
    cardPage,
  );
}

export async function replaceCredentialAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(
    z.object({ cardId: id, credentialId: id, reason, confirm: checked }),
    data,
    async ({ cardId, credentialId, reason }, actorId) => {
      const { activationCode } = await replaceProvisioningCredential(db, { actorId, cardId, credentialId, reason, secrets: { lookupSecret: env.activationCodeSecret, activeKeyId: env.activationCodeEncryptionActiveKeyId, encryptionKeys: env.activationCodeEncryptionKeys } });
      return { reveal: { code: formatActivationCode(activationCode) } };
    },
    cardPage,
  );
}

export async function reserveGrcAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(
    z.object({ cardId: id, orderItemId: id }),
    data,
    async ({ cardId, orderItemId }, actorId) => {
      await reserveGrc(db, { actorId, cardId, orderItemId });
      return { ok: "Card reserved." };
    },
    cardPage,
  );
}

export async function retireCardAction(_previous: ActionState | undefined, data: FormData): Promise<ActionState> {
  return run(
    z.object({ cardId: id, reason, confirm: checked }),
    data,
    async ({ cardId, reason }, actorId) => {
      await retireCard(db, { actorId, cardId, reason });
      return { ok: "Card retired." };
    },
    cardPage,
  );
}
