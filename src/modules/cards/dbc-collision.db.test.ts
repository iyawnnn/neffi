import { beforeAll, expect, test, vi } from "vitest";
import { cards } from "@/db/schema";
import { insertAccount, insertProduct, insertStockPurchase, syntheticCredentialSecrets } from "@/db/test-fixtures";
import { createTestDb, rollback, type TestDb } from "@/db/testing";

const m = vi.hoisted(() => ({ issue: vi.fn() }));
vi.mock("../activation/credentials", async (importOriginal) => ({ ...(await importOriginal<typeof import("../activation/credentials")>()), issueActivationCredential: m.issue }));

const { ActivationCredentialError } = await import("../activation/credentials");
const { provisionDbc } = await import("./dbc");

let db: TestDb;
beforeAll(async () => { db = await createTestDb(); });

test("credential collision exhaustion rolls back provisioning", () => rollback(db, async (tx) => {
  const owner = await insertAccount(tx, "owner");
  await insertProduct(tx, "dbc");
  const stock = await insertStockPurchase(tx);
  const [card] = await tx.insert(cards).values({ stockPurchaseId: stock.id }).returning();
  m.issue.mockRejectedValueOnce(new ActivationCredentialError());
  await expect(provisionDbc(tx, { actorId: owner.id, cardId: card.id, secrets: syntheticCredentialSecrets("s".repeat(40)) })).rejects.toBeInstanceOf(ActivationCredentialError);
  expect((await tx.select().from(cards))[0]).toMatchObject({ id: card.id, publicToken: null, kind: null, productId: null });
}));
