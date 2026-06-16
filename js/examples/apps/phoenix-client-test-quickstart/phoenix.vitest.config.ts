import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only the Vitest examples; the `jest/` folder is run by Jest.
    include: ["evals/**/*.eval.?(c|m)[jt]s"],
    // The Phoenix reporter prints the end-of-run summary (output table,
    // annotation scores, dataset / experiment links).
    reporters: ["default", "@arizeai/phoenix-client/vitest/reporter"],
    // Loads `.env` so PHOENIX_* / OPENAI_API_KEY are available to CLI *and*
    // editor-launched runs (VS Code Vitest extension).
    setupFiles: ["dotenv/config"],
    testTimeout: 30000,
  },
});
