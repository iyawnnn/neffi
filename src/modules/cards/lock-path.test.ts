import { expect, test } from "vitest";
import type { Db } from "../db";
import { recordNfcCheck } from "./card";

test("GRC NFC check refuses a card moved to another item while waiting for the order lock", async () => {
  const snapshot = { id: "card", kind: "grc", state: "reserved", orderItemId: "original-item" };
  const reads = [[snapshot], [{ orderId: "original-order" }], [{ ...snapshot, orderItemId: "different-item" }]];
  const locks: unknown[] = [];
  const tx = {
    select: () => {
      const rows = reads.shift();
      const query = {
        from: () => query, innerJoin: () => query, where: () => query,
        for: (_mode: string, options?: unknown) => { locks.push(options); return query; },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(rows).then(resolve),
      };
      return query;
    },
  };
  const db = { transaction: (fn: (tx: unknown) => unknown) => fn(tx) } as unknown as Db;
  await expect(recordNfcCheck(db, { actorId: "owner", cardId: "card", cardUrlOrigin: "https://tap.example.test", readBackUri: "https://g.page/r/review", readBackMatched: true, phoneOpenedUri: true, tagLeftWritable: true })).rejects.toMatchObject({ code: "item_ineligible" });
  expect(locks).toHaveLength(2);
});
