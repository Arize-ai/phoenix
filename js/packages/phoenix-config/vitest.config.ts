import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@phoenix-config/env-file": fileURLToPath(
        new URL("./src/envFile.ts", import.meta.url)
      ),
    },
  },
  test: {
    exclude: ["**/dist/**", "**/node_modules/**"],
  },
});
