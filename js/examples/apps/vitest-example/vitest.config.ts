import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.eval.?(c|m)[jt]s"],
    reporters: ["default", "@arizeai/phoenix-client/vitest/reporter"],
    setupFiles: ["dotenv/config"],
    testTimeout: 30_000,
  },
});
