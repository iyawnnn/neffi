import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "./db";
import { escapeLike } from "./orders/purchasers";
import { PAGE_SIZE, pageWindow } from "./pagination";
import type { SearchHit } from "./search-types";

// Read-only owner search over what the admin screens already show. It never touches activation credentials,
// recovery codes, session data or any secret column: a hit is a type, an id, two display lines and why it matched.

export { searchTypes, type SearchHit, type SearchType } from "./search-types";

const MIN_TERM = 2;

type Options = { perType?: number; limit: number; offset?: number };

export async function searchRecords(db: Db, query: string, { perType, limit, offset = 0 }: Options): Promise<{ hits: SearchHit[]; total: number }> {
  const term = query.trim().slice(0, 100);
  if (term.length < MIN_TERM) return { hits: [], total: 0 };
  const escaped = escapeLike(term);
  const pat = `%${escaped}%`;
  const prefix = `${escaped}%`;

  // "1003", "#1003" and "order 1003" all mean the order number; short digits must match exactly, longer ones by prefix.
  const digits = term.replace(/^(order\s*)?#?\s*/i, "");
  const numberLike = /^\d+$/.test(digits) ? (digits.length >= 3 ? `${digits}%` : digits) : null;
  const orderNumber = (column: string) => (numberLike ? sql`${sql.raw(column)}::text LIKE ${numberLike}` : sql`false`);
  const hex = /^[0-9a-f-]{4,36}$/i.test(term);
  const suffix = term.length <= 4;

  const result = await db.execute(sql`
    WITH hits AS (
      SELECT 'order' AS type, 1 AS type_rank, o.id::text AS id, 'Order ' || o.number AS title, p.name AS subtitle, o.status::text AS status,
        CASE WHEN ${orderNumber("o.number")} THEN 'Order number' WHEN p.name ILIKE ${pat} THEN 'Customer name' ELSE 'Customer contact' END AS matched,
        CASE WHEN o.number::text = ${digits} THEN 0 WHEN ${orderNumber("o.number")} OR p.name ILIKE ${prefix} THEN 1 ELSE 2 END AS rank, o.created_at AS at
      FROM orders o JOIN purchasers p ON p.id = o.purchaser_id
      WHERE ${orderNumber("o.number")} OR p.name ILIKE ${pat} OR p.contact_number ILIKE ${pat}
      UNION ALL
      SELECT 'customer', 2, p.id::text, p.name, coalesce(p.contact_number, 'No contact number'), NULL,
        CASE WHEN p.name ILIKE ${pat} THEN 'Name' ELSE 'Contact number' END,
        CASE WHEN lower(p.name) = lower(${term}) THEN 0 WHEN p.name ILIKE ${prefix} THEN 1 ELSE 2 END, p.created_at
      FROM purchasers p WHERE p.name ILIKE ${pat} OR p.contact_number ILIKE ${pat}
      UNION ALL
      SELECT 'account', 3, a.id::text, a.email, a.role::text, NULL, 'Account email',
        CASE WHEN lower(a.email) = lower(${term}) THEN 0 WHEN a.email ILIKE ${prefix} THEN 1 ELSE 2 END, a.created_at
      FROM accounts a WHERE a.email ILIKE ${pat}
      UNION ALL
      SELECT 'card', 4, c.id::text, upper(right(coalesce(c.public_token, c.id::text), 4)), coalesce(c.kind::text, 'none'), c.state::text,
        CASE WHEN c.public_token = ${term} OR c.id::text = ${term.toLowerCase()} THEN 'Card reference' ELSE 'Card ending' END,
        CASE WHEN c.public_token = ${term} OR c.id::text = ${term.toLowerCase()} THEN 0 ELSE 2 END, c.created_at
      FROM cards c WHERE c.public_token = ${term} OR c.id::text = ${term.toLowerCase()} OR (${suffix} AND right(coalesce(c.public_token, c.id::text), 4) ILIKE ${pat})
      UNION ALL
      SELECT 'support', 5, sc.id::text, sc.summary, sc.type::text, sc.status::text,
        CASE WHEN ${hex} AND sc.id::text ILIKE ${prefix} THEN 'Case reference' WHEN sc.summary ILIKE ${pat} THEN 'Summary' WHEN ${orderNumber("lo.number")} THEN 'Linked order'
          WHEN lp.name ILIKE ${pat} THEN 'Linked customer' ELSE 'Linked account' END,
        CASE WHEN ${hex} AND sc.id::text ILIKE ${prefix} THEN 0 WHEN sc.summary ILIKE ${prefix} THEN 1 ELSE 2 END, sc.created_at
      FROM support_cases sc LEFT JOIN orders lo ON lo.id = sc.order_id LEFT JOIN purchasers lp ON lp.id = sc.purchaser_id LEFT JOIN accounts la ON la.id = sc.account_id
      WHERE (${hex} AND sc.id::text ILIKE ${prefix}) OR sc.summary ILIKE ${pat} OR ${orderNumber("lo.number")} OR lp.name ILIKE ${pat} OR la.email ILIKE ${pat}
      UNION ALL
      SELECT 'tracking', 6, sh.order_id::text, sh.tracking_number, 'Order ' || o.number, NULL, 'Tracking number',
        CASE WHEN lower(sh.tracking_number) = lower(${term}) THEN 0 ELSE 2 END, sh.created_at
      FROM shipments sh JOIN orders o ON o.id = sh.order_id WHERE sh.tracking_number ILIKE ${pat}
    )
    SELECT type, id, title, subtitle, status, matched, (count(*) OVER ())::int AS total FROM (
      SELECT hits.*, row_number() OVER (PARTITION BY type ORDER BY rank, at DESC NULLS LAST, id) AS n FROM hits
    ) ranked WHERE ${perType === undefined ? sql`true` : sql`n <= ${perType}`} ORDER BY type_rank, n LIMIT ${limit} OFFSET ${offset}
  `);
  const rows = (result as { rows: (SearchHit & { total: number })[] }).rows;
  return { hits: rows.map(({ type, id, title, subtitle, status, matched }) => ({ type, id, title, subtitle, status, matched })), total: rows[0]?.total ?? 0 };
}

/** One numbered page of every match, grouped by type. A page past the end lands on the last one. */
export async function searchPage(db: Db, query: string, requestedPage: unknown) {
  // The total is unknown until the first read, so the requested page is trusted for now and clamped afterwards.
  const first = pageWindow(Number.MAX_SAFE_INTEGER, requestedPage);
  let { hits, total } = await searchRecords(db, query, { limit: PAGE_SIZE, offset: first.offset });
  if (!hits.length && first.page > 1) total = (await searchRecords(db, query, { limit: 1 })).total;
  const window = pageWindow(total, requestedPage);
  if (!hits.length && total) hits = (await searchRecords(db, query, { limit: PAGE_SIZE, offset: window.offset })).hits;
  return { hits, window };
}
