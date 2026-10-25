import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

declare global {
  interface ImportMeta {
    glob<T>(pattern: string | string[]): Record<string, () => Promise<T>>;
  }
}

type Action = (...args: unknown[]) => unknown;
type ActionModule = Record<string, Action>;
const m = vi.hoisted(() => ({
  getSession: vi.fn(), touched: [] as string[], provider: vi.fn(), mutation: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("@/auth/server", () => ({ auth: { api: new Proxy({ getSession: m.getSession }, {
  get(target, key) {
    if (key === "getSession") return target.getSession;
    return () => m.mutation("auth.api." + String(key));
  },
}) } }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: m.mutation, delete: m.mutation }),
}));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(), cache: <T>(fn: T) => fn,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error("REDIRECT " + url); },
  notFound: () => { throw new Error("NOT_FOUND"); },
}));
vi.mock("next/server", () => ({ connection: async () => {}, after: m.mutation }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate, revalidateTag: m.revalidate, updateTag: m.revalidate }));
vi.mock("@/db", () => {
  const reject = (operation: string): never => { m.touched.push(operation); throw new Error("DB touched: " + operation); };
  return { db: new Proxy(() => {}, {
    get: (_, key) => reject("get " + String(key)), apply: () => reject("call"),
    set: (_, key) => reject("set " + String(key)), construct: () => reject("construct"),
  }) };
});
vi.mock("@/integrations/email/sender", () => ({ sendEmail: m.provider }));
vi.mock("@/integrations/media/cloudinary", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/integrations/media/cloudinary")>();
  return Object.fromEntries(Object.entries(actual).map(([name, value]) => [name, typeof value === "function" ? m.provider : value]));
});
vi.mock("@/config/env", async () => {
  const { parseServerEnv } = await import("@/config/env-schema");
  return { env: parseServerEnv({
  "DATABASE_URL": "postgresql://ci:ci-dummy-db-password@ep-ci-dummy.example.invalid/ci",
  "DATABASE_URL_UNPOOLED": "postgresql://ci:ci-dummy-db-password@ep-ci-dummy.example.invalid/ci",
  "BETTER_AUTH_SECRET": "ci-dummy-better-auth-secret-0123456789abcdef",
  "BETTER_AUTH_URL": "http://localhost:3000",
  "GOOGLE_CLIENT_ID": "ci-dummy-google-client-id.apps.example.invalid",
  "GOOGLE_CLIENT_SECRET": "ci-dummy-google-client-secret-0123456789",
  "RESEND_API_KEY": "re_ci_dummy_resend_key_0123456789",
  "AUTH_EMAIL_FROM": "Neffi <ci@example.invalid>",
  "ACTIVATION_CODE_SECRET": "ci-dummy-activation-code-secret-0123456789abcdef",
  "ACTIVATION_CODE_ENCRYPTION_ACTIVE_KEY_ID": "ci-test-v1",
  "ACTIVATION_CODE_ENCRYPTION_KEYS": JSON.stringify({ "ci-test-v1": Buffer.alloc(32, 75).toString("base64") }),
  "CARD_URL_ORIGIN": "http://localhost:3000",
  "CLOUDINARY_CLOUD_NAME": "ci-dummy-cloud",
  "CLOUDINARY_API_KEY": "ci-dummy-cloudinary-key-0123456789",
  "CLOUDINARY_API_SECRET": "ci-dummy-cloudinary-secret-0123456789abcdef",
  "NEXT_TELEMETRY_DISABLED": "1"
}) };
});

const classifiedExports: Record<string, readonly string[]> = {
  "./(customer)/app/account/actions.ts": [
    "requestEmailChangeAction",
    "confirmEmailChangeAction",
    "removeGoogleAction",
    "signOutEverywhereAction"
  ],
  "./(customer)/app/cards/actions.ts": [
    "connectCardAction",
    "setCardDisabledAction",
    "saveCardSettingsAction"
  ],
  "./(customer)/app/inbox/actions.ts": [
    "deleteSubmissionAction",
    "updateInboxAction"
  ],
  "./(customer)/app/profiles/[profileId]/actions.ts": [
    "publishAction",
    "unpublishAction",
    "updateIdentityAction",
    "showSceneAction",
    "createSceneAction",
    "deleteProfileAction",
    "updateAppearanceAction",
    "startImageUploadAction",
    "confirmImageAction",
    "removeImageAction",
    "confirmCoverAction",
    "updateCoverCropAction",
    "removeCoverAction",
    "discardCoverUploadAction"
  ],
  "./(customer)/app/profiles/[profileId]/scenes/[sceneId]/actions.ts": [
    "loadItemAction",
    "mutateItemAction",
    "renameSceneAction",
    "deleteSceneAction",
    "addBlockAction",
    "updateBlockAction",
    "moveBlockAction",
    "toggleBlockAction",
    "removeBlockAction",
    "updateFormAction"
  ],
  "./(customer)/app/setup/[cardId]/actions.ts": [
    "publishSetupAction",
    "saveYouAction",
    "savePhotoAction",
    "saveContactAction",
    "saveLookAction",
    "saveStyleAction",
    "chooseProfileAction",
    "continueGoalAction"
  ],
  "./(public)/activate/actions.ts": [
    "checkCodeAction",
    "claimAction",
    "switchAccountAction",
    "startOverAction"
  ],
  "./(public)/support/actions.ts": [
    "submitSupportAction"
  ],
  "./(public)/support/recover/actions.ts": [
    "completeRecoveryAction"
  ],
  "./admin/customers/actions.ts": [
    "updatePurchaserAction"
  ],
  "./admin/expenses/actions.ts": [
    "saveExpenseAction",
    "deleteExpenseAction"
  ],
  "./admin/inventory/actions.ts": [
    "updateStockPurchaseAction",
    "receiveStockAction",
    "provisionDbcAction",
    "recordNfcCheckAction",
    "matchPackageAction",
    "replaceCredentialAction",
    "revealActivationCodeAction",
    "saveExistingActivationCodeAction",
    "reserveGrcAction",
    "retireCardAction"
  ],
  "./admin/orders/[orderId]/actions.ts": [
    "assignOrderAction",
    "addOrderNoteAction",
    "updateOrderDetailsAction",
    "addOrderItemAction",
    "updateOrderItemAction",
    "removeOrderItemAction",
    "recordPaymentAction",
    "recordRefundAction",
    "voidPaymentAction",
    "voidRefundAction",
    "reserveDbcCardsAction",
    "returnCardToStockAction",
    "handOverOrderAction",
    "shipOrderAction",
    "updateShipmentAction",
    "cancelOrderAction"
  ],
  "./admin/orders/new/actions.ts": [
    "createOrderAction"
  ],
  "./admin/settings/actions.ts": [
    "saveProductAction"
  ],
  "./admin/support/[caseId]/actions.ts": [
    "openCaseAction",
    "assignCaseAction",
    "sendCaseMessageAction",
    "initiateRecoveryAction",
    "cancelRecoveryAction",
    "secureAccountAction",
    "resendRecoveryNoticeAction",
    "resendSecurityNoticeAction",
    "setCaseStatusAction",
    "reopenCaseAction",
    "addCaseNoteAction",
    "fillCaseLinkAction",
    "linkCaseCardAction",
    "afterSaleRefundAction",
    "recordCompletedPaymentAction",
    "voidAfterSaleRefundAction",
    "voidCompletedPaymentAction",
    "retireAffectedCardAction",
    "releaseReplacementCardAction",
    "reissueActivationCodeAction",
    "resetCardOwnershipAction",
    "recordSupportShipmentAction",
    "updateSupportShipmentAction"
  ]
};

const publicActions: Record<string, string> = {
  "./(public)/support/actions.ts#submitSupportAction": "Anonymous intake is quota-guarded.",
  "./(public)/support/recover/actions.ts#completeRecoveryAction": "Recovery completion is proof- and quota-guarded.",
  "./(public)/activate/actions.ts#checkCodeAction": "Anonymous code checking has an IP quota.",
  "./(public)/activate/actions.ts#startOverAction": "Clears only the caller's activation challenge.",
  "./(public)/activate/actions.ts#switchAccountAction": "Signs out only the caller's session.",
};
const actionModules = import.meta.glob<ActionModule>("./**/actions.ts");
const pageModules = Object.fromEntries(Object.entries(import.meta.glob<{ default: Action }>([
  "./**/page.tsx", "./**/layout.tsx",
])).filter(([path]) => path.startsWith("./admin/") || path.startsWith("./(customer)/app/")));
const sessionFor = (role: "customer" | "owner") => ({
  user: { id: "00000000-0000-4000-8000-000000000001", email: "sweep@example.invalid", emailVerified: true, role },
});
beforeEach(() => {
  vi.clearAllMocks();
  m.touched.length = 0;
  m.getSession.mockResolvedValue(null);
  m.provider.mockImplementation(() => { throw new Error("Unexpected provider call"); });
  m.mutation.mockImplementation(() => { throw new Error("Unexpected mutation"); });
});
afterEach(() => {
  expect(m.touched, "denial must precede every database access").toEqual([]);
  expect(m.provider).not.toHaveBeenCalled();
  expect(m.mutation).not.toHaveBeenCalled();
  expect(m.revalidate).not.toHaveBeenCalled();
  for (const [request] of m.getSession.mock.calls) expect(request.query).toEqual({ disableRefresh: true });
});

test("the real authorization boundary distinguishes signed-out, customer and OWNER sessions", async () => {
  const { authorize } = await import("@/auth/access");
  expect(await authorize("owner")).toEqual({ ok: false, denial: { status: 401, error: "unauthenticated" } });
  m.getSession.mockResolvedValue(sessionFor("customer"));
  expect(await authorize("owner")).toEqual({ ok: false, denial: { status: 403, error: "forbidden" } });
  m.getSession.mockResolvedValue(sessionFor("owner"));
  expect(await authorize("owner")).toMatchObject({ ok: true, viewer: { role: "owner" } });
});

test("every action module and public exception is explicitly classified", () => {
  expect(Object.keys(actionModules).sort()).toEqual(Object.keys(classifiedExports).sort());
  for (const [entry, reason] of Object.entries(publicActions)) {
    const [path, name] = entry.split("#");
    expect(classifiedExports[path]).toContain(name);
    expect(reason.length).toBeGreaterThan(0);
  }
  expect(pageModules).toHaveProperty("./admin/layout.tsx");
  expect(pageModules).toHaveProperty("./(customer)/app/layout.tsx");
});

for (const [path, load] of Object.entries(actionModules)) {
  test("classifies every runtime export of " + path, async () => {
    const exports = await load();
    expect(Object.keys(exports).sort()).toEqual([...classifiedExports[path] ?? []].sort());
    for (const action of Object.values(exports)) expect(typeof action).toBe("function");
  });
  for (const name of classifiedExports[path] ?? []) {
    if (publicActions[path + "#" + name]) continue;
    const roles = path.startsWith("./admin/") ? ["signed-out", "customer"] as const : ["signed-out"] as const;
    describe(path + "#" + name, () => {
      for (const role of roles) test("denies " + role + " before data or side effects", async () => {
        m.getSession.mockResolvedValue(role === "customer" ? sessionFor("customer") : null);
        const action = (await load())[name];
        const args = action.length === 1 ? [new FormData()] : [undefined, new FormData()];
        let value: unknown;
        let thrown: unknown;
        try { value = await action(...args); } catch (error) { thrown = error; }
        expect(m.getSession).toHaveBeenCalledTimes(1);
        if (thrown !== undefined) {
          expect(thrown).toBeInstanceOf(Error);
          // User-approved plan correction: signed-out claim returns to activation without claiming.
          const claim = path === "./(public)/activate/actions.ts" && name === "claimAction";
          const expected = claim ? "REDIRECT /activate" : role === "customer" ? "NOT_FOUND" : path.startsWith("./admin/") ? "REDIRECT /sign-in?next=/admin" : "REDIRECT /sign-in?next=/app";
          expect((thrown as Error).message).toBe(expected);
        } else {
          expect(value).toMatchObject({ error: expect.any(String) });
          expect((value as { error: string }).error.length).toBeGreaterThan(0);
          expect(value).not.toHaveProperty("ok");
        }
      });
    });
  }
}

for (const [path, load] of Object.entries(pageModules)) {
  const admin = path.startsWith("./admin/");
  const roles = admin ? ["signed-out", "customer"] as const : ["signed-out"] as const;
  for (const role of roles) test(path + " denies " + role + " before data or side effects", async () => {
    m.getSession.mockResolvedValue(role === "customer" ? sessionFor("customer") : null);
    const params = Object.fromEntries([...path.matchAll(/\[([^\]]+)\]/g)].map(([, key]) => [key, "00000000-0000-4000-8000-000000000001"]));
    params.token = "0".repeat(26);
    const page = (await load()).default;
    const props = { params: Promise.resolve(params), searchParams: Promise.resolve({}), children: null };
    let thrown: unknown;
    try { await page(props); } catch (error) { thrown = error; }
    expect(thrown).toBeInstanceOf(Error);
    const expected = role === "customer" ? ["NOT_FOUND"] : admin ? ["REDIRECT /sign-in?next=/admin"] : ["REDIRECT /sign-in?next=/app", "NOT_FOUND"];
    expect(expected).toContain((thrown as Error).message);
    if ((thrown as Error).message !== "NOT_FOUND" || admin) expect(m.getSession).toHaveBeenCalledTimes(1);
  });
}
