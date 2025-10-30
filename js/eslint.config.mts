import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  { ignores: ["**/*.{js,jsx,cjs,mjs}", "**/dist/**"] },
  {
    files: ["**/*.{ts,mts,cts}"],
    plugins: { js, "simple-import-sort": simpleImportSort },
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
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            // Arize packages.
            ["^(@arizeai)(/.*|$)"],
            // internal packages.
            ["^(@phoenix)(/.*|$)"],
            // Side effect imports.
            ["^\\u0000"],
            // Parent imports. Put `..` last.
            ["^\\.\\.(?!/?$)", "^\\.\\./?$"],
            // Other relative imports. Put same-folder imports and `.` last.
            ["^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"],
            // Style imports.
            ["^.+\\.?(css)$"],
          ],
        },
      ],
    },
  },
  tseslint.configs.recommended,
]);
