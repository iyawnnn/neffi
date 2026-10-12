// Production HTTP regression for M7's /c Proxy boundary. It creates only synthetic rows in the
// isolated loopback database, then retires them. Never point this at Neon or a shared environment.
import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import pg from "pg";

const require = createRequire(import.meta.url);
const { setCacheBustingSearchParam } = require("next/dist/client/components/router-reducer/set-cache-busting-search-param.js") as {
  setCacheBustingSearchParam(url: URL, headers: Record<string, string>): Promise<void>;
};

const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
assert(["127.0.0.1", "localhost"].includes(databaseUrl.hostname), "check-public-http only runs against loopback PostgreSQL");
assert(["postgres:", "postgresql:"].includes(databaseUrl.protocol), "check-public-http requires PostgreSQL");
assert(databaseUrl.pathname.endsWith("neffi_m7_http_diagnostic"), "check-public-http requires the isolated m7 HTTP diagnostic database");
assert(![...databaseUrl.searchParams.keys()].some((key) => ["host", "hostaddr", "port"].includes(key)), "DATABASE_URL may not override the loopback target");
const origin = new URL(process.env.PUBLIC_HTTP_ORIGIN ?? "http://127.0.0.1:3001");
assert(["127.0.0.1", "localhost"].includes(origin.hostname), "PUBLIC_HTTP_ORIGIN must be loopback");

const pool = new pg.Pool({ connectionString: databaseUrl.href, max: 3 });
const id = () => randomUUID();
const marker = `M7HTTP-${randomBytes(8).toString("hex")}`;
const token = (suffix: string) => `${marker.replaceAll("-", "").toUpperCase()}${suffix}`;
type Fixture = {
  ownerId: string; otherId: string; productId: string; stockId: string; purchaserId: string; orderId: string;
  itemIds: string[]; profileIds: string[]; sceneIds: string[]; cardIds: string[]; ownerSession: string; otherSession: string;
  publishedToken: string; disabledToken: string; draftToken: string; unpublishedToken: string;
};

const generic = "This Neffi isn\u2019t available right now";
const request = async (path: string | URL, init: RequestInit = {}) => {
  const response = await fetch(new URL(path, origin), { redirect: "manual", ...init });
  return { response, body: await response.text() };
};
const assertPrivate = (body: string, fixture: Fixture) => {
  assert(!body.includes(fixture.ownerId));
  assert(!body.includes(fixture.otherId));
  assert(!body.includes(`${marker.toLowerCase()}@example.test`));
};
const assertNoSnapshotLeak = (response: Response, body: string) => {
  assert.equal(response.headers.get("x-neffi-card-request"), null);
  assert.equal(response.headers.get("x-middleware-request-x-neffi-card-request"), null);
  assert(!body.includes("x-neffi-card-request"));
};
const expectUnavailable = async (name: string, path: string | URL, init: RequestInit, fixture: Fixture) => {
  const { response, body } = await request(path, init);
  assert.equal(response.status, 404, `expected real HTTP 404 for ${name}`);
  assert.match(body, new RegExp(generic));
  assert.match(response.headers.get("x-robots-tag") ?? body, /noindex/i);
  assertPrivate(body, fixture);
  assertNoSnapshotLeak(response, body);
};
const expectFlightUnavailable = async (name: string, url: URL, headers: Record<string, string>, fixture: Fixture) => {
  const { response, body } = await request(url, { headers });
  assert.equal(response.status, 404, `${name} must receive an early HTTP 404`);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/i);
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/i);
  assertPrivate(body, fixture);
  assertNoSnapshotLeak(response, body);
};
const expectRscUnavailable = async (path: string, fixture: Fixture) => {
  const url = new URL(path, origin);
  const headers = { rsc: "1", "next-router-state-tree": encodeURIComponent(JSON.stringify(["", { children: ["__PAGE__", {}] }])) };
  // This is exactly the cache-busting query Next's router computes from its request headers. Without it,
  // a synthetic Flight request is intentionally redirected by Next's cache-poisoning protection.
  await setCacheBustingSearchParam(url, headers);
  // A Flight request is deliberately answered before it can stream the page. The router then performs a
  // document navigation to the same permanent Card URL, whose ordinary response supplies the generic copy.
  await expectFlightUnavailable("RSC navigation", url, headers, fixture);
  await expectUnavailable("RSC document navigation", path, {}, fixture);
};

const signedCookie = (value: string) => {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  assert(secret.length >= 32, "BETTER_AUTH_SECRET is required to exercise authenticated Proxy behavior");
  return `better-auth.session_token=${value}.${createHmac("sha256", secret).update(value).digest("base64")}`;
};
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function insertFixture(): Promise<Fixture> {
  const fixture: Fixture = {
    ownerId: id(), otherId: id(), productId: id(), stockId: id(), purchaserId: id(), orderId: id(), itemIds: [id(), id(), id(), id()],
    profileIds: [id(), id(), id()], sceneIds: [id(), id(), id()], cardIds: [id(), id(), id(), id()],
    ownerSession: randomBytes(32).toString("base64url"), otherSession: randomBytes(32).toString("base64url"),
    publishedToken: token("PUB"), disabledToken: token("DIS"), draftToken: token("DRF"), unpublishedToken: token("UNP"),
  };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO accounts(id,name,email,email_verified) VALUES ($1,$2,$3,true),($4,$5,$6,true)", [
      fixture.ownerId, `${marker} owner`, `${marker.toLowerCase()}@example.test`, fixture.otherId, `${marker} other`, `${marker.toLowerCase()}-other@example.test`,
    ]);
    await client.query("INSERT INTO products(id,kind,name,price) VALUES ($1,'dbc',$2,50000)", [fixture.productId, `${marker} DBC`]);
    await client.query("INSERT INTO stock_purchases(id,received_on,created_by_account_id) VALUES ($1,'2026-10-12',$2)", [fixture.stockId, fixture.ownerId]);
    await client.query("INSERT INTO purchasers(id,name) VALUES ($1,$2)", [fixture.purchaserId, `${marker} purchaser`]);
    await client.query("INSERT INTO orders(id,purchaser_id,created_by_account_id,assigned_to_account_id) VALUES ($1,$2,$3,$3)", [fixture.orderId, fixture.purchaserId, fixture.ownerId]);
    for (const itemId of fixture.itemIds) await client.query("INSERT INTO order_items(id,order_id,product_id,product_kind,quantity,unit_price) VALUES ($1,$2,$3,'dbc',1,50000)", [itemId, fixture.orderId, fixture.productId]);
    const profileStatus = ["published", "draft", "unpublished"] as const;
    for (const [index, profileId] of fixture.profileIds.entries()) {
      // A published Profile requires its Default Scene in the same committed fixture, so establish that relationship first.
      await client.query("INSERT INTO profiles(id,account_id,status,full_name) VALUES ($1,$2,'draft',$3)", [profileId, fixture.ownerId, index === 0 ? `${marker} Published Initial` : `${marker} private`]);
      await client.query("INSERT INTO scenes(id,profile_id,name) VALUES ($1,$2,'Main')", [fixture.sceneIds[index], profileId]);
      await client.query("UPDATE profiles SET default_scene_id=$1,status=$2 WHERE id=$3", [fixture.sceneIds[index], profileStatus[index], profileId]);
    }
    const cards = [
      [fixture.cardIds[0], fixture.itemIds[0], fixture.publishedToken, fixture.profileIds[0], null],
      [fixture.cardIds[1], fixture.itemIds[1], fixture.disabledToken, fixture.profileIds[0], new Date()],
      [fixture.cardIds[2], fixture.itemIds[2], fixture.draftToken, fixture.profileIds[1], null],
      [fixture.cardIds[3], fixture.itemIds[3], fixture.unpublishedToken, fixture.profileIds[2], null],
    ];
    for (const [cardId, itemId, publicToken, profileId, disabledAt] of cards) {
      await client.query("INSERT INTO cards(id,stock_purchase_id,product_id,kind,state,order_item_id,public_token,owner_account_id,profile_id,disabled_at) VALUES ($1,$2,$3,'dbc','released',$4,$5,$6,$7,$8)", [cardId, fixture.stockId, fixture.productId, itemId, publicToken, fixture.ownerId, profileId, disabledAt]);
    }
    await client.query("INSERT INTO auth_sessions(token,account_id,expires_at) VALUES ($1,$2,now() + interval '1 day'),($3,$4,now() + interval '1 day')", [fixture.ownerSession, fixture.ownerId, fixture.otherSession, fixture.otherId]);
    await client.query("COMMIT");
    return fixture;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function removeFixture(fixture: Fixture) {
  // Public tokens are immutable and card history is append-only, so the local fixture is retired rather than deleted.
  // Its random M7HTTP label makes it separately identifiable in the disposable diagnostic database.
  await pool.query("DELETE FROM auth_sessions WHERE token = ANY($1::text[])", [[fixture.ownerSession, fixture.otherSession]]);
  await pool.query("UPDATE cards SET state='retired',profile_id=NULL,disabled_at=NULL WHERE id = ANY($1::uuid[])", [fixture.cardIds]);
}

async function expectSceneDeletionRace(fixture: Fixture) {
  const sceneId = id();
  const blockId = id();
  const uniqueText = `${marker} must never render after deletion`;
  await pool.query("INSERT INTO scenes(id,profile_id,name) VALUES ($1,$2,'Race')", [sceneId, fixture.profileIds[0]]);
  await pool.query("INSERT INTO scene_blocks(id,scene_id,type,position,content) VALUES ($1,$2,'about',0,$3::jsonb)", [blockId, sceneId, JSON.stringify({ text: uniqueText })]);
  await pool.query("UPDATE profiles SET active_scene_id=$1,content_version=content_version+1 WHERE id=$2", [sceneId, fixture.profileIds[0]]);

  const locker = await pool.connect();
  let committed = false;
  try {
    await locker.query("BEGIN");
    await locker.query("LOCK TABLE scene_blocks IN ACCESS EXCLUSIVE MODE");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const pending = request(`/c/${fixture.publishedToken}`, { signal: controller.signal });
    let waiting = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      const [{ waitingOnBlocks }] = (await pool.query<{ waitingOnBlocks: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid <> pg_backend_pid() AND wait_event_type='Lock' AND query ILIKE '%scene_blocks%') AS \"waitingOnBlocks\"",
      )).rows;
      if (waitingOnBlocks) { waiting = true; break; }
      await wait(100);
    }
    assert(waiting, "the production request did not reach the blocked Scene read");
    await locker.query("UPDATE profiles SET active_scene_id=NULL,content_version=content_version+1 WHERE id=$1", [fixture.profileIds[0]]);
    await locker.query("DELETE FROM scenes WHERE id=$1", [sceneId]);
    await locker.query("COMMIT");
    committed = true;
    const { response, body } = await pending;
    clearTimeout(timeout);
    assert(!body.includes(uniqueText), "a deleted Scene must never reach the visitor response");
    assert.match(body, new RegExp(generic));
    assertPrivate(body, fixture);
    assertNoSnapshotLeak(response, body);
  } finally {
    if (!committed) await locker.query("ROLLBACK").catch(() => undefined);
    locker.release();
  }
}

async function main() {
  const [{ neon }] = (await pool.query<{ neon: string | null }>("SELECT current_setting('neon.project_id', true) AS neon")).rows;
  assert(!neon, "check-public-http must never target Neon");
  const fixture = await insertFixture();
  const ownerHeaders = { cookie: signedCookie(fixture.ownerSession) };
  const otherHeaders = { cookie: signedCookie(fixture.otherSession) };
  try {
    await expectUnavailable("unknown visitor card", `/c/${token("UNKNOWN")}`, {}, fixture);
    await expectUnavailable("disabled visitor card", `/c/${fixture.disabledToken}`, {}, fixture);
    await expectUnavailable("draft visitor card", `/c/${fixture.draftToken}`, {}, fixture);
    await expectUnavailable("unpublished visitor card", `/c/${fixture.unpublishedToken}`, {}, fixture);
    await expectUnavailable("disabled non-owner card", `/c/${fixture.disabledToken}`, { headers: otherHeaders }, fixture);

    const published = await request(`/c/${fixture.publishedToken}`);
    assert.equal(published.response.status, 200, "published card must answer HTTP 200");
    assert.match(published.body, /Published Initial/);
    assert.match(published.response.headers.get("x-robots-tag") ?? published.body, /noindex/i);
    assertPrivate(published.body, fixture);
    assertNoSnapshotLeak(published.response, published.body);

    const ownerUnavailable = await request(`/c/${fixture.disabledToken}`, { headers: ownerHeaders });
    assert.equal(ownerUnavailable.response.status, 200, "the card owner alone keeps the unavailable management response");
    assert.match(ownerUnavailable.body, new RegExp(generic));
    assert.match(ownerUnavailable.body, /Manage this card/);
    assertPrivate(ownerUnavailable.body, fixture);
    assertNoSnapshotLeak(ownerUnavailable.response, ownerUnavailable.body);

    await pool.query("UPDATE cards SET disabled_at=now() WHERE id=$1", [fixture.cardIds[0]]);
    await expectUnavailable("newly disabled visitor card", `/c/${fixture.publishedToken}`, {}, fixture);
    await pool.query("UPDATE cards SET disabled_at=NULL WHERE id=$1", [fixture.cardIds[0]]);
    const restored = await request(`/c/${fixture.publishedToken}`);
    assert.equal(restored.response.status, 200, "re-enabling must affect the next request");

    await pool.query("UPDATE profiles SET full_name=$1, content_version=content_version+1 WHERE id=$2", [`${marker} Published Revised`, fixture.profileIds[0]]);
    const revised = await request(`/c/${fixture.publishedToken}`);
    assert.equal(revised.response.status, 200);
    assert.match(revised.body, /Published Revised/, "a new content_version must miss the old public Scene cache");

    await expectUnavailable("forged snapshot", `/c/${token("FORGED")}`, { headers: { "x-neffi-card-request": "forged" } }, fixture);
    await expectRscUnavailable(`/c/${fixture.disabledToken}`, fixture);
    const prefetchUrl = new URL(`/c/${fixture.disabledToken}`, origin);
    const prefetchHeaders = { rsc: "1", purpose: "prefetch", "next-router-prefetch": "1", "next-router-state-tree": encodeURIComponent(JSON.stringify(["", { children: ["__PAGE__", {}] }])) };
    await setCacheBustingSearchParam(prefetchUrl, prefetchHeaders);
    await expectFlightUnavailable("prefetch to disabled card", prefetchUrl, prefetchHeaders, fixture);
    await expectSceneDeletionRace(fixture);
  } finally {
    await removeFixture(fixture);
  }
}

await main().finally(() => pool.end());
console.log("M7 public HTTP regression passed");
