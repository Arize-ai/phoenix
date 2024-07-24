import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import relay from "vite-plugin-relay";

export default defineConfig(({ command }) => {
  const plugins = [react(), relay];
  // Development uses the serve command
  if (command === "serve") {
    plugins.push(visualizer());
  }
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
      },
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
              if (id.includes("codemirror")) {
                return "vendor-codemirror";
              }
              if (id.includes("@arizeai/components")) {
                return "vendor-arizeai";
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
