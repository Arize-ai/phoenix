import js from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: ["playwright-report/**", "test-results/**"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: {
      js,
      react: pluginReact,
    },
    languageOptions: {
      globals: globals.browser,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // JavaScript recommended rules
      ...js.configs.recommended.rules,

      // React rules
      ...pluginReact.configs.recommended.rules,
      "react/no-unknown-property": ["error", { ignore: ["css"] }],
      "react/jsx-uses-react": "off", // Not needed with new JSX transform
      "react/react-in-jsx-scope": "off", // Not needed with new JSX transform

      // General rules
      "no-console": "error",
      "no-duplicate-imports": "error",

      // Import sorting handled by oxfmt
    },
  },
  pluginReactHooks.configs.flat["recommended-latest"],
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // this is made an error so that it forces us to validate it works with the react compiler
      "react-hooks/incompatible-library": "error",
      // TODO: Re-enable this rule once we've addressed the issue with setState in useEffect
      // This rule prevents calling setState in useEffect which can cause unstable results when components re-render
      "react-hooks/set-state-in-effect": "off",
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-empty-object-type": [
        "error",
        {
          allowInterfaces: "with-single-extends",
        },
      ],
    },
  },
]);
