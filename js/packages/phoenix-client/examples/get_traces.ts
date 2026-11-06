/* eslint-disable no-console */
import { createClient } from "../src/client";
import { getTraces } from "../src/traces/getTraces";

/**
 * Example: Get traces from a project
 */
async function main() {
  const client = createClient({
    options: {
      baseUrl: "http://localhost:6006",
    },
  });

  try {
    console.log("Getting traces...");

    const { traces, nextCursor } = await getTraces({
      client,
      project: { projectName: "default" },
      includeSpans: true,
      limit: 5,
      sort: "start_time",
      order: "desc",
    });

    console.log(`Found ${traces.length} trace(s)`);

    for (const trace of traces) {
      console.log(`- ${trace.trace_id}`);
    }

    if (nextCursor) {
      console.log(`Next cursor: ${nextCursor}`);
    }

    console.log("Example completed");
  } catch (error) {
    console.error("Error:", error);

    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      console.error(
        "Make sure Phoenix server is running on http://localhost:6006"
      );
    }

    process.exit(1);
  }
}

main();
