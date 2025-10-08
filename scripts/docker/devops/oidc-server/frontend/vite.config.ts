import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/oidc/", // Must include route prefix like Phoenix does
  build: {
    outDir: "../dist-frontend",
  },
});
