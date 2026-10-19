import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { createTestAuth, signInWithEmail } from "@/auth/test-auth";
import * as s from "@/db/schema";
import { insertAccount, insertProfileWithScene, insertReleasedDbc } from "@/db/test-fixtures";
import { completeRecovery, initiateRecovery } from "@/modules/accounts/recovery";
import { resolveCard } from "@/modules/cards/resolve";
import { openCase } from "@/modules/support/case";

test("support recovery revokes the old session and signs into the same Account with its published Card", async () => {
  const t = await createTestAuth();
  const db = t.db;
  try {
    const oldEmail = "journey-old@example.invalid";
    const newEmail = "journey-new@example.invalid";
    const oldClient = t.client();
    expect((await signInWithEmail(t, oldClient, oldEmail)).response.status).toBe(200);
    const readSession = (client: ReturnType<typeof t.client>) => t.auth.api.getSession({ headers: new Headers({ cookie: client.cookieHeader() }), query: { disableRefresh: true } });
    const original = await readSession(oldClient);
    assert(original, "Old sign-in must create a session");
    const accountId = original.user.id;
    const fixture = await db.transaction(async tx => {
      const owner = await insertAccount(tx, "owner");
      const { card } = await insertReleasedDbc(tx);
      const { profile } = await insertProfileWithScene(tx, accountId);
      await tx.update(s.profiles).set({ status: "published", fullName: "Recovery journey" }).where(eq(s.profiles.id, profile.id));
      await tx.update(s.cards).set({ ownerAccountId: accountId, profileId: profile.id }).where(eq(s.cards.id, card.id));
      return { owner, card, profile };
    });
    assert(fixture.card.publicToken, "Pre-owned Card must have a token");
    expect((await resolveCard(db, fixture.card.publicToken)).status).toBe("published");
    const accountsBefore = await db.select({ id: s.accounts.id }).from(s.accounts).orderBy(s.accounts.id);
    const cardsBefore = await db.select().from(s.cards);
    const profilesBefore = await db.select().from(s.profiles);

    const { caseId } = await openCase(db, { actorId: fixture.owner.id, type: "account_recovery", summary: "Synthetic recovery journey", accountId });
    const secret = "synthetic-recovery-journey-secret";
    let code = "";
    await initiateRecovery(db, { caseId, actorId: fixture.owner.id, newEmail, confirmed: true, verificationNote: "Verified synthetic purchase evidence", unlinkGoogle: true, secret }, async email => {
      if (email.to === newEmail && email.idempotencyKey?.startsWith("recovery-code-")) code = email.text.match(/\b\d{8}\b/)?.[0] ?? "";
    });
    assert(/^\d{8}$/.test(code), "Capturing sender must receive the recovery proof");
    expect(await completeRecovery(db, { email: newEmail, code, secret }, async () => {})).toEqual({ ok: true });
    expect(await readSession(oldClient)).toBeNull();

    const newClient = t.client();
    expect((await signInWithEmail(t, newClient, newEmail)).response.status).toBe(200);
    const recovered = await readSession(newClient);
    assert(recovered, "New address must sign in successfully");
    expect(recovered.user.id).toBe(accountId);
    expect(recovered.user.email).toBe(newEmail);
    expect(await db.select({ id: s.accounts.id }).from(s.accounts).orderBy(s.accounts.id)).toEqual(accountsBefore);
    expect(await db.select().from(s.cards)).toEqual(cardsBefore);
    expect(await db.select().from(s.profiles)).toEqual(profilesBefore);
    const route = await resolveCard(db, fixture.card.publicToken);
    expect(route.status).toBe("published");
    assert(route.status === "published");
    expect(route.ownerAccountId).toBe(accountId);
    expect(route.profileId).toBe(fixture.profile.id);
  } finally {
    await db.$client.close();
  }
});

test("self-service email change makes an older pending support recovery fail its email snapshot", async () => {
  const t = await createTestAuth();
  const db = t.db;
  try {
    const oldEmail = "snapshot-old@example.invalid";
    const recoveryEmail = "snapshot-recovery@example.invalid";
    const selfServiceEmail = "snapshot-self-service@example.invalid";
    const client = t.client();
    expect((await signInWithEmail(t, client, oldEmail)).response.status).toBe(200);
    const requestHeaders = () => new Headers({ cookie: client.cookieHeader() });
    const session = await t.auth.api.getSession({ headers: requestHeaders(), query: { disableRefresh: true } });
    assert(session, "Initial sign-in must create a session");
    const owner = await db.transaction(tx => insertAccount(tx, "owner"));
    const { caseId } = await openCase(db, { actorId: owner.id, type: "account_recovery", summary: "Synthetic snapshot recovery", accountId: session.user.id });
    const secret = "synthetic-snapshot-recovery-secret";
    let recoveryCode = "";
    const recovery = await initiateRecovery(db, { caseId, actorId: owner.id, newEmail: recoveryEmail, confirmed: true, verificationNote: "Verified synthetic purchase evidence", unlinkGoogle: true, secret }, async email => {
      if (email.to === recoveryEmail && email.idempotencyKey?.startsWith("recovery-code-")) recoveryCode = email.text.match(/\b\d{8}\b/)?.[0] ?? "";
    });
    assert(/^\d{8}$/.test(recoveryCode), "Capturing sender must receive the recovery proof");

    const sentBefore = t.sent.length;
    await t.auth.api.requestEmailChangeEmailOTP({ headers: requestHeaders(), body: { newEmail: selfServiceEmail } });
    const changeCode = t.sent[sentBefore]?.code;
    assert(changeCode, "Self-service change must send a code");
    await t.auth.api.changeEmailEmailOTP({ headers: requestHeaders(), body: { newEmail: selfServiceEmail, otp: changeCode } });

    expect(await completeRecovery(db, { email: recoveryEmail, code: recoveryCode, secret }, async () => {})).toEqual({ ok: false });
    expect((await db.select().from(s.accountRecoveries).where(eq(s.accountRecoveries.id, recovery.recoveryId)))[0]).toMatchObject({ status: "pending", oldEmail });
    expect((await db.select().from(s.accounts).where(eq(s.accounts.id, session.user.id)))[0].email).toBe(selfServiceEmail);
  } finally {
    await db.$client.close();
  }
});
