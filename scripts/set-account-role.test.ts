import { spawnSync } from "node:child_process";
import { createServer, type AddressInfo } from "node:net";
import { setImmediate } from "node:timers/promises";
import { expect, test } from "vitest";

const run = (args: string[], overrides: Record<string, string>) => spawnSync(process.execPath,
  ["--conditions=react-server", "--import", "tsx", "scripts/set-account-role.ts", ...args], {
    encoding: "utf8", timeout: 15_000,
    env: { ...process.env, DATABASE_URL_UNPOOLED: "postgresql://synthetic:secret@127.0.0.1:1/test", ...overrides },
  });

test.each([[], ["sensitive@example.test"], ["sensitive@example.test", "admin"], ["sensitive@example.test", "owner", "extra"]].map(args => ({ args })))(
  "invalid arguments $args fail before connecting and never echo input", ({ args }) => {
    const result = run(args, { VERCEL_ENV: "development" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage: accounts:set-role <email> <owner|customer>");
    expect(result.stderr).not.toContain("sensitive@example.test");
    expect(result.stdout).toBe("");
  });

test.each(["production", "unknown"])("%s context fails before opening a database connection", async (VERCEL_ENV) => {
  let connections = 0;
  const server = createServer(socket => { connections++; socket.destroy(); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address() as AddressInfo;
    const result = run(["sensitive@example.test", "owner"], {
      VERCEL_ENV, DATABASE_URL_UNPOOLED: `postgresql://synthetic:secret@127.0.0.1:${port}/test`,
    });
    await setImmediate();
    expect(result.status).toBe(1);
    expect(result.stderr).toBe("accounts:set-role failed. Check arguments, environment and database access.\n");
    expect(result.stdout).toBe("");
    expect(connections).toBe(0);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
