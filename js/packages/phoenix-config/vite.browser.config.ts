import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";

function rejectNodeBuiltins(): Plugin {
  return {
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (
          output.type === "chunk" &&
          /(?:node:fs|node:path)/u.test(output.code)
        ) {
          throw new Error(
            "Browser build included Node-only environment-file discovery"
          );
        }
      }
    },
    name: "reject-node-builtins",
    resolveId(source) {
      if (source === "node:fs" || source === "node:path") {
        throw new Error(
          `Browser build reached Node-only module ${source}; the envFile browser condition was not applied`
        );
      }
      return null;
    },
  };
}

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
  plugins: [rejectNodeBuiltins()],
  resolve: {
    conditions: ["browser", "import", "module", "default"],
    mainFields: ["browser", "module", "jsnext:main", "jsnext"],
    preserveSymlinks: true,
  },
});
