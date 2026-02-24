import { resolve } from "path";
import { lezer } from "@lezer/generator/rollup";
import react from "@vitejs/plugin-react";
// Uncomment below to visualize the bundle size after running the build command, also uncomment plugins.push(visualizer());
// import { visualizer } from "rollup-plugin-visualizer";
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import circleDependency from "vite-plugin-circular-dependency";
import reactFallbackThrottlePlugin from "vite-plugin-react-fallback-throttle";
import relay from "vite-plugin-relay";

const useReactCompiler = process.env.PHOENIX_ENABLE_REACT_COMPILER === "True";

// We default to not exporting source maps since the JS bundle gets added to the python package.
// We however want to enable source maps on the containers for debugging purposes.
const enableSourceMap = process.env.PHOENIX_ENABLE_SOURCE_MAP === "True";

if (useReactCompiler) {
  // eslint-disable-next-line no-console
  console.log(
    "🔥 Using React Compiler. This will improve performance but also may introduce new errors. Proceed with caution."
  );
} else {
  // eslint-disable-next-line no-console
  console.log("⏼ React compiler is disabled.");
}
export default defineConfig(() => {
  const plugins = [
    // disable react's built-in 300ms suspense fallback timer
    // without this build plugin we see a 300ms delay on most UI interactions
    reactFallbackThrottlePlugin(),
    react(
      useReactCompiler
        ? {
            babel: {
              plugins: [
                ["babel-plugin-react-compiler", { panicThreshold: "none" }],
              ],
            },
          }
        : {}
    ),
    relay,
    lezer(),
    circleDependency({ circleImportThrowErr: true }),
  ];
  // Uncomment below to visualize the bundle size after running the build command also uncomment import { visualizer } from "rollup-plugin-visualizer";
  // plugins.push(visualizer());
  return {
    root: resolve(__dirname, "src"),
    plugins,
    publicDir: resolve(__dirname, "static"),
    server: {
      port: parseInt(process.env.VITE_PORT || "5173"),
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
      include: ["../__tests__/*.test.ts", "**/__tests__/*.test.ts"],
      exclude: ["../node_modules/**"],
      environment: "jsdom",
      setupFiles: ["./vitest.setup.ts"],
      globals: true,
    },
    build: {
      manifest: true,
      outDir: resolve(__dirname, "../src/phoenix/server/static"),
      emptyOutDir: true,
      sourcemap: enableSourceMap,
      rolldownOptions: {
        input: resolve(__dirname, "src/index.tsx"),
        output: {
          advancedChunks: {
            groups: [
              // === Vendor groups ===
              // includeDependenciesRecursively: true (default) makes each
              // group self-contained. Most-shared packages get the highest
              // priority so they're captured first. NO maxSize on vendor
              // groups (it causes execution order issues with ESM init).

              // React core (shared by almost everything)
              {
                name: "vendor-react",
                test: /[\\/]node_modules[\\/](react[\\/]|react-dom[\\/]|scheduler[\\/]|react-is[\\/])/,
                priority: 40,
              },
              // CodeMirror state (shared core)
              {
                name: "vendor-codemirror-state",
                test: /[\\/]node_modules[\\/]@codemirror[\\/]state/,
                priority: 36,
              },
              // CodeMirror view/UI + extensions
              {
                name: "vendor-codemirror-view",
                test: /[\\/]node_modules[\\/](@codemirror[\\/](view|autocomplete|commands|lint|search)|@uiw[\\/]|codemirror[\\/])/,
                priority: 35,
              },
              // Lezer parsing infrastructure (grammars + core)
              {
                name: "vendor-lezer",
                test: /[\\/]node_modules[\\/]@lezer[\\/]/,
                priority: 34,
              },
              // CodeMirror language integration + lang-* packages
              {
                name: "vendor-codemirror-lang",
                test: /[\\/]node_modules[\\/](@codemirror[\\/](lang-|language)|codemirror-json)/,
                priority: 33,
              },
              // React Aria UI primitives
              {
                name: "vendor-aria",
                test: /[\\/]node_modules[\\/](@react-aria|react-aria|@react-stately|react-stately|@react-types|@internationalized)/,
                priority: 30,
              },
              // Recharts charting library + D3 deps
              {
                name: "vendor-recharts",
                test: /[\\/]node_modules[\\/](recharts|d3-|internmap)/,
                priority: 30,
              },
              // Shiki syntax highlighter
              {
                name: "vendor-shiki",
                test: /[\\/]node_modules[\\/](@shikijs|shiki)/,
                priority: 30,
              },
              // GraphQL data layer (Relay)
              {
                name: "vendor-graphql",
                test: /[\\/]node_modules[\\/](relay-runtime|react-relay)/,
                priority: 25,
              },
              // React Router
              {
                name: "vendor-router",
                test: /[\\/]node_modules[\\/](react-router|turbo-stream|cookie|set-cookie-parser)/,
                priority: 20,
              },
              // Table/virtualisation (@tanstack)
              {
                name: "vendor-tanstack",
                test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
                priority: 20,
              },
              // Markdown rendering pipeline
              {
                name: "vendor-markdown",
                test: /[\\/]node_modules[\\/](react-markdown|remark-|mdast-|micromark|unified|hast-|unist-|rehype-)/,
                priority: 20,
              },
              // Forms + validation
              {
                name: "vendor-forms",
                test: /[\\/]node_modules[\\/](react-hook-form|@hookform|zod[\\/])/,
                priority: 20,
              },
              // Remaining node_modules
              {
                name: "vendor",
                test: /[\\/]node_modules[\\/]/,
                priority: 10,
              },

              // === App code groups ===
              // With includeDependenciesRecursively: true, higher-priority
              // groups "claim" their modules first, preventing lower-priority
              // groups from pulling them in as transitive deps.
              //
              // Priority order (high→low):
              //   p9: shared infra (claimed first, used by everything)
              //   p8: shared UI components (claimed next, used by pages)
              //   p7: feature groups (self-contained under features/)
              //   p1: remaining root files

              // Shared infrastructure
              {
                name: "app-infra",
                test: /[\\/]src[\\/](contexts|hooks|utils|store|constants|types|openInference|analytics)[\\/]/,
                priority: 9,
              },
              // Shared UI components - the ENTIRE directory, no exclusions
              {
                name: "app-components",
                test: /[\\/]src[\\/]components[\\/]/,
                priority: 8,
              },
              // Feature groups - one directory each
              {
                name: "app-project",
                test: /[\\/]src[\\/]features[\\/]project[\\/]/,
                priority: 7,
              },
              {
                name: "app-trace",
                test: /[\\/]src[\\/]features[\\/]trace[\\/]/,
                priority: 7,
              },
              {
                name: "app-datasets",
                test: /[\\/]src[\\/]features[\\/]datasets[\\/]/,
                priority: 7,
              },
              {
                name: "app-experiments",
                test: /[\\/]src[\\/]features[\\/]experiments[\\/]/,
                priority: 7,
              },
              {
                name: "app-playground",
                test: /[\\/]src[\\/]features[\\/]playground[\\/]/,
                priority: 7,
              },
              {
                name: "app-prompts-settings",
                test: /[\\/]src[\\/]features[\\/]prompts-settings[\\/]/,
                priority: 7,
              },
              // Remaining app code (root files, non-feature pages, misc)
              {
                name: "app",
                test: /[\\/]src[\\/]/,
                priority: 1,
              },
            ],
          },
        },
      },
    },
  };
});
