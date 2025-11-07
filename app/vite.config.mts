import { lezer } from "@lezer/generator/rollup";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
// Uncomment below to visualize the bundle size after running the build command, also uncomment plugins.push(visualizer());
// import { visualizer } from "rollup-plugin-visualizer";
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import reactFallbackThrottlePlugin from "vite-plugin-react-fallback-throttle";
import relay from "vite-plugin-relay";

export default defineConfig(() => {
  const plugins = [
    // disable react's built-in 300ms suspense fallback timer
    // without this build plugin we see a 300ms delay on most UI interactions
    reactFallbackThrottlePlugin(),
    react(),
    relay,
    lezer(),
  ];
  // Uncomment below to visualize the bundle size after running the build command also uncomment import { visualizer } from "rollup-plugin-visualizer";
  // plugins.push(visualizer());
  return {
    root: resolve(__dirname, "src"),
    plugins,
    publicDir: resolve(__dirname, "static"),
    preview: {
      port: 6006,
    },
    server: {
      open: "http://localhost:6006",
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
            if (id.includes("src/components")) {
              return "components";
            }
            if (id.includes("src/pages")) {
              return "pages";
            }
          },
        },
      },
    },
  };
});
