import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/mail/", // Must include route prefix like Phoenix does
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:8025",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
  },
});
