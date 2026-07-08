import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Resolve the "@/..." path alias the app uses, so tests can import modules
  // that (transitively) import "@/lib/...".
  resolve: {
    alias: { "@": root },
  },
  test: {
    // Only the repo's own tests — nested agent worktrees under .claude/ otherwise
    // get discovered and fail against the current app code.
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.claude/**", "**/packages/**"],
    // A dummy URL so importing modules that construct a PrismaClient at load
    // doesn't fail. Unit tests here exercise pure logic and never connect.
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/neemiz_test",
      PROVABLY_FAIR_SECRET: "test-provably-fair-secret",
    },
  },
});
