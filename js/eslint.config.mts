import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { ignores: ["**/*.{js,jsx,cjs,mjs}", "**/dist/**"] },
  {
    files: ["**/*.{ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.node },
    rules: {
      "no-console": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "no-duplicate-imports": "error",
      eqeqeq: ["error", "smart"],
    },
  },
  tseslint.configs.recommended,
]);
