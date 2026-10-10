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
    // Each *.db.test.ts file boots in-process Postgres and applies every migration; under a parallel run
    // that alone can exceed the 5s default.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
