import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  { ignores: ["**/*.{js,jsx,cjs,mjs}", "**/dist/**", "**/build/**"] },
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
      // Import sorting handled by oxfmt
    },
  },
  tseslint.configs.recommended,
]);
