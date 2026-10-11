import { z } from "zod";
import { consumeQuota, hmacHex } from "@/auth/otp-quota";
import { env } from "@/config/env";
import { db } from "@/db";
import { clientIp } from "@/lib/client-ip";
import { submitForm } from "@/modules/forms/submissions";

const MAX_BODY = 16_000;
const SUBMISSIONS_PER_IP = 10;
const body = z.object({ key: z.uuid(), answers: z.record(z.string(), z.string().max(2000)), website: z.string().max(200).optional() });
const json = (data: object, status: number) => Response.json(data, { status });

// Public, unauthenticated endpoint for Neffi Forms (M7 renders the form). Same-origin only; nothing is echoed back.
export async function POST(request: Request, { params }: RouteContext<"/api/forms/[formId]/submissions">) {
  if (request.headers.get("origin") !== new URL(env.authBaseUrl).origin) return json({ error: "forbidden" }, 403);
  if (!(await consumeQuota(db, hmacHex(env.betterAuthSecret, "form-ip", clientIp(request.headers)), SUBMISSIONS_PER_IP))) {
    return json({ error: "rate_limited" }, 429);
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: "too_large" }, 413);
  let parsed: z.infer<typeof body>;
  try {
    parsed = body.parse(JSON.parse(raw));
  } catch {
    return json({ error: "invalid" }, 400);
  }
  const { formId } = await params;
  if (!z.uuid().safeParse(formId).success) return json({ error: "unavailable" }, 404);
  // Bots fill the hidden field; accept and drop it so they learn nothing.
  if (parsed.website) return json({ ok: true }, 201);
  const result = await submitForm(db, { formId, clientKey: parsed.key, answers: parsed.answers });
  if (result.status === "unavailable") return json({ error: "unavailable" }, 404);
  if (result.status === "invalid") return json({ error: "invalid", fields: result.fields }, 400);
  return json({ ok: true }, 201);
}
