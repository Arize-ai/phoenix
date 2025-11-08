import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import pluginReact from "eslint-plugin-react";
import pluginReactCompiler from "eslint-plugin-react-compiler";
import pluginReactHooks from "eslint-plugin-react-hooks";
// @ts-expect-error - No types available for this plugin
import pluginSimpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: {
      js,
      react: pluginReact,
      "react-compiler": pluginReactCompiler,
      "simple-import-sort": pluginSimpleImportSort,
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

      // React compiler rules
      ...pluginReactCompiler.configs.recommended.rules,
      "react-compiler/react-compiler": "error",

      // General rules
      "no-console": "error",
      "no-duplicate-imports": "error",

      // Import sorting rules
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            // Packages `react` related packages come first.
            ["^react", "^@?\\w", "^@emotion"],
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
  pluginReactHooks.configs.flat.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // TODO: Re-enable this rule once we've addressed the incompatible library warnings
      // This rule warns about using APIs from libraries like React Hook Form and TanStack Table
      // that return functions which cannot be safely memoized by React Compiler
      "react-hooks/incompatible-library": "off",

      // TODO: Re-enable this rule once we've addressed impure function calls during render
      // This rule prevents calling impure functions like Date.now() during component render
      // which can cause unstable results when components re-render
      "react-hooks/purity": "off",

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
  {
    files: ["**/*.stories.@(js|jsx|ts|tsx)"],
    rules: {
      // Basic storybook rules without plugin complexity
      "import/no-anonymous-default-export": "off",
    },
  },
]);
