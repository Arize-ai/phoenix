import { register } from "@arizeai/phoenix-otel";

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
 * Ensure spans are flushed before the process exits
 * This is critical for CLI applications that exit quickly
 */
export async function shutdown() {
  try {
    await provider.shutdown();
    // Silent shutdown - spans are flushed successfully
  } catch (error) {
    // Always log errors
    // eslint-disable-next-line no-console
    console.error("Error shutting down Phoenix tracing:", error);
  }
}

// Handle graceful shutdown on normal exit
process.on("beforeExit", async () => {
  await shutdown();
});

// Handle SIGINT (Ctrl+C)
process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});

// Handle SIGTERM
process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", async (error) => {
  // eslint-disable-next-line no-console
  console.error("Uncaught exception:", error);
  await shutdown();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", async (reason) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled rejection:", reason);
  await shutdown();
  process.exit(1);
});
