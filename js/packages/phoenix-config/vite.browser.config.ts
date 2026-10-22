import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

import { createRejectNodeBuiltinsPlugin } from "../../scripts/viteRejectNodeBuiltins.mjs";

export default defineConfig({
  root: fileURLToPath(new URL("../phoenix-otel", import.meta.url)),
  build: {
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(
        new URL("../phoenix-otel/test/browserConfigSmoke.ts", import.meta.url)
      ),
      formats: ["es"],
      name: "PhoenixConfigBrowserSmoke",
    },
    outDir: fileURLToPath(new URL("./dist/browser-smoke", import.meta.url)),
  },
  plugins: [createRejectNodeBuiltinsPlugin({ targetName: "Browser" })],
  resolve: {
    conditions: ["browser", "import", "module", "default"],
    mainFields: ["browser", "module", "jsnext:main", "jsnext"],
    preserveSymlinks: true,
  },
});
