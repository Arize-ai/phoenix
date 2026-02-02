import { lezer } from "@lezer/generator/rollup";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
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
      rollupOptions: {
        input: resolve(__dirname, "src/index.tsx"),
        output: {
          manualChunks: (id) => {
            if (id.includes("node_modules")) {
              if (id.includes("three/build")) {
                return "vendor-three";
              }
              if (id.includes("recharts")) {
                return "vendor-recharts";
              }
              if (id.includes("shiki")) {
                return "vendor-shiki";
              }
              if (id.includes("codemirror")) {
                return "vendor-codemirror";
              }
              return "vendor";
            }
          },
        },
      },
    },
  };
});
