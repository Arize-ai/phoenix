import { resolve } from "path";
import { defineConfig } from "vitest/config";

// Eval suites read the same .env the dev server uses so API keys need no
// extra tooling. Loaded here in the main process so both the Phoenix
// reporter and the forked test workers see it; shell variables win.
try {
  process.loadEnvFile(resolve(__dirname, ".env"));
} catch {
  // No .env — variables may come from the shell instead.
}
if (!process.env.PHOENIX_HOST) {
  // Without a Phoenix to record to, run the suites as a local dry run.
  process.env.PHOENIX_TEST_TRACKING ??= "false";
}

export default defineConfig({
  resolve: {
    alias: {
      "@phoenix": resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["evals/**/*.eval.ts"],
    environment: "node",
    reporters: ["default", "@arizeai/phoenix-client/vitest/reporter"],
    // Small models are slow, and a miss costs a judge round on top. The
    // on-device proxy (Gemma) averages ~20s a case and has crossed 120s on
    // long cross-experiment expressions, failing the run on a timeout the
    // acceptance criteria had already survived.
    testTimeout: 300_000,
  },
});
