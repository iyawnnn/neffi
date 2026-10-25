import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect, test } from "vitest";

test("0019-0021 preserve legacy commercial, shipping and credential history", async () => {
  const folder = mkdtempSync(join(tmpdir(), "neffi-owner-operations-"));
  const client = new PGlite();
  try {
    cpSync("drizzle", folder, { recursive: true });
    const journal = JSON.parse(readFileSync(join(folder, "meta/_journal.json"), "utf8"));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= 18);
    writeFileSync(join(folder, "meta/_journal.json"), JSON.stringify(journal));
    const db = drizzle({ client });
    await migrate(db, { migrationsFolder: folder });
    await client.exec(`
      INSERT INTO accounts (id, name, email) VALUES ('00000000-0000-4000-8000-000000000001', 'Synthetic owner', 'owner@example.invalid');
      INSERT INTO products (id, kind, name, price) VALUES ('00000000-0000-4000-8000-000000000002', 'dbc', 'Historical card', 50000);
      INSERT INTO purchasers (id, name) VALUES ('00000000-0000-4000-8000-000000000003', 'Synthetic buyer');
      INSERT INTO orders (id, purchaser_id, delivery_method, shipping_fee, created_by_account_id, assigned_to_account_id)
        VALUES ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', 'courier', 0, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001');
      INSERT INTO orders (id, purchaser_id, status, delivery_method, completed_at, created_by_account_id, assigned_to_account_id)
        VALUES ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', 'completed', 'pickup', now(), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001');
      INSERT INTO orders (id, purchaser_id, status, cancelled_at, created_by_account_id, assigned_to_account_id)
        VALUES ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000003', 'cancelled', now(), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001');
      INSERT INTO order_items (id, order_id, product_id, product_kind, quantity, unit_price, agreed_total)
        VALUES ('00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'dbc', 1, 50000, 47000);
      INSERT INTO stock_purchases (id, received_on, created_by_account_id)
        VALUES ('00000000-0000-4000-8000-000000000008', '2026-10-01', '00000000-0000-4000-8000-000000000001');
      INSERT INTO cards (id, stock_purchase_id, product_id, kind, public_token, created_at) VALUES
        ('00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000002', 'dbc', 'LEGACYONE', '2026-01-01'),
        ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000002', 'dbc', 'LEGACYTWO', '2026-01-02'),
        ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000002', 'dbc', 'LEGACYTHREE', '2026-01-03');
      INSERT INTO activation_credentials (id, card_id, lookup_hmac, used_at, revoked_at) VALUES
        ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000009', repeat('a', 64), NULL, NULL),
        ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000010', repeat('b', 64), now(), NULL),
        ('00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000011', repeat('c', 64), NULL, now());
      INSERT INTO payments (order_id, amount, method, paid_on, recorded_by_account_id)
        VALUES ('00000000-0000-4000-8000-000000000004', 47000, 'cash', '2026-10-02', '00000000-0000-4000-8000-000000000001');
      INSERT INTO shipments (order_id, courier, status) VALUES
        ('00000000-0000-4000-8000-000000000004', 'Historical courier', 'pending'),
        ('00000000-0000-4000-8000-000000000004', 'Historical courier', 'pending');
      INSERT INTO activity_events (type, card_id) VALUES ('card_provisioned', '00000000-0000-4000-8000-000000000009');
    `);
    const before = {
      orderItems: (await client.query("SELECT unit_price, agreed_total FROM order_items ORDER BY id")).rows,
      payments: (await client.query("SELECT order_id, amount, method, paid_on FROM payments ORDER BY id")).rows,
      shipments: (await client.query("SELECT order_id, courier, status FROM shipments ORDER BY id")).rows,
      credentials: (await client.query("SELECT id, card_id, lookup_hmac, used_at, revoked_at FROM activation_credentials ORDER BY id")).rows,
      orders: (await client.query("SELECT id, status, delivery_method, shipping_fee FROM orders ORDER BY id")).rows,
    };
    await migrate(db, { migrationsFolder: "drizzle" });
    expect((await client.query("SELECT unit_price, agreed_total FROM order_items ORDER BY id")).rows).toEqual(before.orderItems);
    expect((await client.query("SELECT order_id, amount, method, paid_on FROM payments ORDER BY id")).rows).toEqual(before.payments);
    expect((await client.query("SELECT order_id, courier, status FROM shipments ORDER BY id")).rows).toEqual(before.shipments);
    expect((await client.query("SELECT id, card_id, lookup_hmac, used_at, revoked_at FROM activation_credentials ORDER BY id")).rows).toEqual(before.credentials);
    expect((await client.query("SELECT id, status, delivery_method, shipping_fee FROM orders ORDER BY id")).rows).toEqual(before.orders);
    const cards = (await client.query<{ inventory_number: number }>("SELECT inventory_number FROM cards ORDER BY created_at, id")).rows;
    expect(cards.map(card => card.inventory_number)).toEqual([1, 2, 3]);
    const [newCard] = (await client.query<{ inventory_number: number }>("INSERT INTO cards (stock_purchase_id) VALUES ('00000000-0000-4000-8000-000000000008') RETURNING inventory_number")).rows;
    expect(newCard.inventory_number).toBe(4);
    expect((await client.query<{ encrypted_code: string | null }>("SELECT encrypted_code FROM activation_credentials")).rows.every(row => row.encrypted_code === null)).toBe(true);
    expect((await client.query<{ shipping_fee_pending: boolean; client_key: string | null; normal_payment_method: string | null }>("SELECT shipping_fee_pending, client_key, normal_payment_method FROM orders")).rows.every(row => row.shipping_fee_pending === false && row.client_key === null && row.normal_payment_method === null)).toBe(true);
    expect((await client.query("SELECT activation_credential_id FROM activity_events")).rows).toEqual([{ activation_credential_id: null }]);
  } finally {
    await client.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
