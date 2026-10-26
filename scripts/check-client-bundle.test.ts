import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { expect, test } from "vitest";

test.each(["encoded", "decoded"])("bundle scan catches one %s leaked encryption key without the JSON container", (form) => {
  const root = mkdtempSync(join(tmpdir(), "neffi-bundle-scan-"));
  const key = Buffer.alloc(32, 75).toString("base64");
  try {
    mkdirSync(join(root, ".next", "static"), { recursive: true });
    writeFileSync(join(root, ".next", "static", "leak.js"), `const key = "${form === "encoded" ? key : Buffer.alloc(32, 75).toString("utf8")}";`);
    const result = spawnSync(process.execPath, [resolve("scripts/check-client-bundle.mjs")], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ACTIVATION_CODE_ENCRYPTION_KEYS: JSON.stringify({ "test-v1": key }) },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`ACTIVATION_CODE_ENCRYPTION_KEYS (${form === "encoded" ? "individual key" : "decoded key"})`);
    expect(result.stderr).not.toContain(key);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
