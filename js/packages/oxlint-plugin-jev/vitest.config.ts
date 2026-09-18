import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["dist/**", "skills/**", "node_modules/**"],
    testTimeout: 60_000,
  },
});
