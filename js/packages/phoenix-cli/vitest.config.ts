import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["build/**", "dist/**", "node_modules/**"],
  },
});
