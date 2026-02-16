import { register } from "@arizeai/phoenix-otel";

import { randomUUID } from "node:crypto";

/**
 * Initialize Phoenix tracing for the CLI agent
 * This should be imported before any AI SDK calls
 */
const provider = register({
  projectName: "cli-agent-starter-kit",
  // Use local Phoenix by default, can be overridden with PHOENIX_COLLECTOR_ENDPOINT
  url: process.env.PHOENIX_COLLECTOR_ENDPOINT || "http://localhost:6006",
  // API key for Phoenix Cloud (optional)
  apiKey: process.env.PHOENIX_API_KEY,
  // Use batch processing for better performance
  batch: true,
});

/**
 * Generate a unique session ID for this CLI session
 * All traces created during this session will share this ID
 *
 * Use with withSpan from @arizeai/openinference-core:
 * const handler = withSpan(async () => {...}, {
 *   name: "interaction",
 *   kind: "CHAIN",
 *   attributes: { "session.id": SESSION_ID }
 * });
 */
export const SESSION_ID = randomUUID();

/**
 * Flush all pending spans before the process exits
 * This is critical for CLI applications that exit quickly
 */
export async function flush() {
  try {
    await provider.shutdown();
    // Silent shutdown - spans are flushed successfully
  } catch (error) {
    // Always log errors
    // eslint-disable-next-line no-console
    console.error("Error flushing Phoenix spans:", error);
  }
}

// Handle graceful shutdown on normal exit
process.on("beforeExit", async () => {
  await flush();
});

// Handle SIGINT (Ctrl+C)
process.on("SIGINT", async () => {
  await flush();
  process.exit(0);
});

// Handle SIGTERM
process.on("SIGTERM", async () => {
  await flush();
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", async (error) => {
  // eslint-disable-next-line no-console
  console.error("Uncaught exception:", error);
  await flush();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", async (reason) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled rejection:", reason);
  await flush();
  process.exit(1);
});
