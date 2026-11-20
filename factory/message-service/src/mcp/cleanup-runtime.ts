import { DatabaseError } from "pg";

import { deleteExpiredMcpGrants } from "./cleanup";

const ONE_HOUR_IN_MILLISECONDS = 60 * 60 * 1000;
const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
]);
const runtime = globalThis as typeof globalThis & {
  factoryMcpGrantCleanup?: { timer: NodeJS.Timeout; isRunning: boolean };
};

export function startMcpGrantCleanup(): void {
  if (runtime.factoryMcpGrantCleanup) return;
  const state = {
    isRunning: false,
    timer: setInterval(async (): Promise<void> => {
      if (state.isRunning) return;
      state.isRunning = true;
      try {
        await deleteExpiredMcpGrants();
      } catch (error) {
        const isDatabaseFailure =
          error instanceof DatabaseError ||
          (error instanceof Error &&
            "code" in error &&
            typeof error.code === "string" &&
            CONNECTION_ERROR_CODES.has(error.code));
        if (!isDatabaseFailure) throw error;
        process.stderr.write(
          "Expired MCP grant cleanup failed; retrying next hour.\n"
        );
      } finally {
        state.isRunning = false;
      }
    }, ONE_HOUR_IN_MILLISECONDS),
  };
  state.timer.unref();
  runtime.factoryMcpGrantCleanup = state;
}
