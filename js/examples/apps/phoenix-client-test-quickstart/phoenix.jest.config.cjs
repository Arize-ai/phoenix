/** @type {import('jest').Config} */
module.exports = {
  // Only the Jest examples; the `evals/` folder is run by Vitest.
  testMatch: ["**/jest/**/*.eval.?(c|m)[jt]s"],
  // ts-jest transpiles the TypeScript eval files. `isolatedModules` makes it
  // transpile-only (no type-checking) so it doesn't trip over the package's
  // `exports` subpaths — type-checking is done separately via `pnpm typecheck`.
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.[cm]?tsx?$": [
      "ts-jest",
      {
        // The package is `"type": "module"`, but Jest's runtime is CommonJS —
        // tell ts-jest to emit CJS so `import` becomes `require`. (`tsconfig.json`
        // sets `isolatedModules` so ts-jest transpiles without type-checking.)
        tsconfig: { module: "CommonJS", esModuleInterop: true },
      },
    ],
  },
  // "default" prints test results; the Phoenix reporter prints the end-of-run
  // summary (output table, annotation scores, dataset / experiment links).
  reporters: ["default", "@arizeai/phoenix-client/jest/reporter"],
  // Loads `.env` so PHOENIX_* are available to CLI and editor-launched runs.
  setupFiles: ["dotenv/config"],
  testTimeout: 30000,
};
