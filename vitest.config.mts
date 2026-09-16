import { fileURLToPath } from "node:url";

import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL("./", import.meta.url));

const commonExclude = [
  "node_modules/**",
  ".next/**",
  "e2e/**",
  "supabase/**",
  "playwright-report/**",
  "test-results/**",
];

export default defineConfig({
  resolve: {
    alias: [
      // Same alias as tsconfig.json ("@/*" -> project root).
      { find: /^@\//, replacement: rootDir },
      // `server-only` throws outside the React Server Components bundler.
      // Unit tests run server code in Node, so resolve it to its no-op variant.
      { find: /^server-only$/, replacement: fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)) },
    ],
  },
  test: {
    // Server logic by default. Component tests opt in with a
    // `// @vitest-environment jsdom` comment at the top of the file.
    environment: "node",
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["**/*.test.{ts,tsx}"],
          exclude: [...commonExclude, "**/*.integration.test.ts"],
        },
      },
      {
        // Integration tests against the LOCAL Supabase stack only (`npm run db:start`).
        // They fail with a clear message if it is unreachable, and refuse to run
        // against any other URL (see lib/supabase/testing/local-test-env.ts).
        extends: true,
        test: {
          name: "integration",
          include: ["**/*.integration.test.ts"],
          exclude: commonExclude,
          // Only the Supabase variables are loaded from .env / .env.local.
          env: loadEnv("test", rootDir, ["NEXT_PUBLIC_SUPABASE_", "SUPABASE_"]),
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
