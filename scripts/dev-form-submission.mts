// Synthetic acceptance messages only. Loopback databases and apps only; never .env.local or Neon.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import type { FormConfig } from "../src/modules/forms/config";

const url = new URL(process.env.DATABASE_URL ?? "");
assert(["127.0.0.1", "localhost"].includes(url.hostname), "The form helper only runs against a loopback database");
assert(["postgres:", "postgresql:"].includes(url.protocol));
assert(![...url.searchParams.keys()].some((key) => ["host", "hostaddr", "port"].includes(key)));
const app = new URL(process.env.APP_ORIGIN ?? "http://localhost:3000");
assert(["127.0.0.1", "localhost"].includes(app.hostname), "The form helper only sends to a loopback app");
assert(["http:", "https:"].includes(app.protocol));
const appOrigin = app.origin;

const pool = new pg.Pool({ connectionString: url.href, max: 2 });
try {
  const { rows: [server] } = await pool.query("SELECT current_setting('neon.project_id', true) AS neon");
  assert(!server.neon, "The form helper must never target Neon");
  const { rows: [form] } = await pool.query<{ id: string; config: FormConfig }>(`
    SELECT f.id, f.config FROM form_definitions f
    JOIN profiles p ON p.id = f.profile_id
    WHERE p.status = 'published'
      AND EXISTS (SELECT 1 FROM scene_blocks b WHERE b.form_id = f.id AND b.visible)
    ORDER BY p.created_at DESC, f.created_at DESC, f.id DESC LIMIT 1
  `);
  assert(form, "Publish a profile with a visible form before running this helper");
  const answers: Record<string, string> = {
    name: "Synthetic Visitor",
    email: process.env.VISITOR_EMAIL ?? "visitor@example.test",
    phone: "+639000000000", // Synthetic only; satisfies the local Required Phone acceptance case.
    message: "Synthetic acceptance message",
  };
  for (const question of form.config.questions) answers[question.id] = "Synthetic answer";
  const body = JSON.stringify({ key: randomUUID(), answers });
  const statuses: number[] = [];
  for (let i = 0; i < (process.argv.includes("--repeat-key") ? 2 : 1); i++) {
    const response = await fetch(`${appOrigin}/api/forms/${form.id}/submissions`, {
      method: "POST",
      headers: { Origin: appOrigin, "Content-Type": "application/json" },
      body,
    });
    statuses.push(response.status);
  }
  console.log(statuses.join(" "));
} finally {
  await pool.end();
}
