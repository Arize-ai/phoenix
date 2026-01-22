import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/dashboard/",
  server: {
    proxy: {
      "/api": "http://localhost:57593",
      "/ws": {
        target: "ws://localhost:57593",
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
