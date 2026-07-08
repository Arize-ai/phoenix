import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "/oidc/", // Must include route prefix like Phoenix does
  build: {
    outDir: "../dist-frontend",
  },
});
