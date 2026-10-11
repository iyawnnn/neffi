import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next resolves `server-only` to a no-op under the react-server condition; tests run outside that graph.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Every database test file also holds its own in-process PGlite. Left uncapped, a worker per core boots them all at
    // once and, on a 16 GB machine, starves the first wave past the hook timeout (flaky, and slower than 8).
    maxWorkers: 8,
    // Each *.db.test.ts file boots in-process Postgres and applies every migration; under a parallel run
    // that alone can exceed the 5s default.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
