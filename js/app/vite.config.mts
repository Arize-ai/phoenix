import { resolve } from "path";
import { lezer } from "@lezer/generator/rollup";
import react from "@vitejs/plugin-react";
import {
  transform as transformReact,
  type ReactCompilerOptions,
} from "oxc-transform-react";
// Uncomment below to visualize the bundle size after running the build command, also uncomment plugins.push(visualizer());
// import { visualizer } from "rollup-plugin-visualizer";
/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import reactFallbackThrottlePlugin from "vite-plugin-react-fallback-throttle";
import relay from "vite-plugin-relay";

// We default to not exporting source maps since the JS bundle gets added to the python package.
// We however want to enable source maps on the containers for debugging purposes.
const enableSourceMap = process.env.PHOENIX_ENABLE_SOURCE_MAP === "True";

// Adapted on August 18, 2026 from the proposed native integration in
// https://github.com/vitejs/vite-plugin-react/pull/1419 because
// @vitejs/plugin-react 6.0.5 does not yet expose its `compiler` option.
// Once that PR (or equivalent support) ships, remove this local plugin and use
// `react({ compiler: { panicThreshold: "none", target: "19" } })` instead.
// Keep `oxc-transform-react` installed if the upstream option still requires it.
const REACT_CODE_PATTERN = /forwardRef|memo|\b(?:[A-Z]|use[A-Z0-9])/;
const REACT_SOURCE_PATTERN = /\.[jt]sx?$/;
const NODE_MODULES_PATTERN = /\/node_modules\//;

function createReactCompilerPlugin({
  compilerOptions = { panicThreshold: "none", target: "19" },
}: {
  compilerOptions?: ReactCompilerOptions;
} = {}): Plugin {
  let isDevelopment = false;
  let shouldGenerateSourceMap = true;

  return {
    name: "phoenix:react-compiler",
    enforce: "pre",
    config() {
      return {
        optimizeDeps: {
          include: ["react/compiler-runtime"],
        },
      };
    },
    configResolved(config) {
      isDevelopment = !config.isProduction;
      shouldGenerateSourceMap =
        config.command !== "build" || Boolean(config.build.sourcemap);
    },
    async transform(sourceCode, moduleId) {
      const fileName = moduleId.split("?", 1)[0];
      if (
        fileName == null ||
        !REACT_SOURCE_PATTERN.test(fileName) ||
        NODE_MODULES_PATTERN.test(fileName) ||
        !REACT_CODE_PATTERN.test(sourceCode)
      ) {
        return null;
      }

      const result = await transformReact(fileName, sourceCode, {
        jsx: {
          runtime: "automatic",
          development: isDevelopment,
          refresh: false,
        },
        reactCompiler: compilerOptions,
        sourcemap: shouldGenerateSourceMap,
      });
      const diagnostics = result.errors.map(
        (error) =>
          `${error.message}${error.codeframe ? `\n${error.codeframe}` : ""}`
      );
      if (result.fatal) {
        this.error(
          diagnostics.join("\n\n") || "React Compiler transform failed."
        );
      }
      // Recoverable compiler bailouts are reported by Oxlint. Keeping them out
      // of Vite avoids repeating the same diagnostics in every build and test.
      return { code: result.code, map: result.map };
    },
  };
}

export default defineConfig(() => {
  const plugins = [
    // disable react's built-in 300ms suspense fallback timer
    // without this build plugin we see a 300ms delay on most UI interactions
    reactFallbackThrottlePlugin(),
    createReactCompilerPlugin(),
    react(),
    relay,
    lezer(),
  ];
  // Uncomment below to visualize the bundle size after running the build command also uncomment import { visualizer } from "rollup-plugin-visualizer";
  // plugins.push(visualizer());
  return {
    // Use a relative base so lazy-loaded chunk deps (__vite__mapDeps) resolve
    // relative to the importing module's URL instead of being baked in as
    // absolute "/assets/..." paths. This lets the bundle work when Phoenix is
    // served under a path prefix (PHOENIX_HOST_ROOT_PATH, e.g. "/phoenix")
    // behind a reverse proxy. The server's index.html template handles the
    // prefix for entry assets via `basename`; this handles everything loaded
    // from within the JS bundle. See https://github.com/Arize-ai/phoenix/issues/15178
    base: "./",
    root: resolve(__dirname, "src"),
    plugins,
    publicDir: resolve(__dirname, "static"),
    server: {
      port: parseInt(process.env.VITE_PORT || "5173"),
      warmup: {
        clientFiles: ["./index.tsx", "./App.tsx", "./Routes.tsx"],
      },
      headers: {
        // Prevent browser caching during development to ensure fresh assets
        // after code changes. This fixes 304 responses causing stale files.
        "Cache-Control": "no-store",
      },
    },
    preview: {
      port: 6006,
    },
    resolve: {
      alias: {
        "@phoenix": resolve(__dirname, "src"),
        "@codemirror/state": resolve(
          __dirname,
          "./node_modules/@codemirror/state/dist/index.cjs"
        ),
      },
    },
    test: {
      include: ["../__tests__/*.test.{ts,tsx}", "**/__tests__/*.test.{ts,tsx}"],
      exclude: ["../node_modules/**"],
      environment: "jsdom",
      setupFiles: [resolve(__dirname, "./vitest.setup.ts")],
      globals: true,
      server: {
        deps: {
          // codemirror-json-schema ships ESM with extensionless relative
          // imports that Node's resolver rejects when externalized
          inline: ["codemirror-json-schema"],
        },
      },
    },
    build: {
      manifest: true,
      outDir: resolve(__dirname, "../../src/phoenix/server/static"),
      emptyOutDir: true,
      sourcemap: enableSourceMap,
      rolldownOptions: {
        input: resolve(__dirname, "src/index.tsx"),
        output: {
          codeSplitting: {
            groups: [
              {
                name: "vendor-codemirror",
                test: /codemirror/,
              },
              {
                name: "vendor-recharts",
                test: /recharts/,
              },
              {
                name: "vendor-shiki",
                test: /shiki/,
              },
              {
                name: "vendor-ai-sdk-react",
                test: /@ai-sdk\/react|\/node_modules\/ai\//,
              },
              {
                name: "vendor-streamdown",
                test: /streamdown/,
              },
              // Catch-all for remaining node_modules
              {
                name: "vendor",
                test: /node_modules/,
              },
            ],
          },
        },
      },
    },
  };
});
