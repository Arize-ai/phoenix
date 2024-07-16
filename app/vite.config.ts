import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import relay from "vite-plugin-relay";

export default defineConfig(({ command, mode }) => {
  return {
    root: resolve(__dirname, "src"),
    plugins: [react(), relay],
    publicDir: resolve(__dirname, "../src/phoenix/server/static"),
    preview: {
      port: 6006,
    },
    server: {
      origin: "http://127.0.0.1:5173",
    },
    resolve: {
      alias: {
        "@phoenix": resolve(__dirname, "src"),
      },
    },
    build: {
      manifest: true,
      outDir: resolve(__dirname, "../src/phoenix/server/dist"),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(__dirname, "src/index.tsx"),
        output: "index.js",
      },
    },
  };
});
