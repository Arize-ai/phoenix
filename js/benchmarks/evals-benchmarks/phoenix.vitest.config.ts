import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.eval.?(c|m)[jt]s"],
    reporters: ["default", "@arizeai/phoenix-client/vitest/reporter"],
    setupFiles: ["dotenv/config"],
    // Each case makes at least one LLM-as-a-judge call, so give them room.
    testTimeout: 60000,
    // LLM-judge benchmarks are slow; run files concurrently.
    fileParallelism: true,
  },
});
