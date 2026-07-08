/* eslint-disable no-console */
import { createClient } from "../src/client";
import { getSessionTurns } from "../src/sessions/getSessionTurns";

/**
 * Example: Get the turns (root span I/O) for a session
 *
 * This fetches all traces in a session and extracts the input/output
 * from root spans to present them as ordered session turns.
 *
 * Usage:
 *   npx tsx examples/get_session_turns.ts [session-id]
 */
async function main() {
  const sessionId = process.argv[2] || "my-session-id";

  const client = createClient({
    options: {
      baseUrl: "http://localhost:6006",
    },
  });

  try {
    console.log(`Fetching turns for session: ${sessionId}`);

    const turns = await getSessionTurns({ client, sessionId });

    if (turns.length === 0) {
      console.log("No turns found.");
      return;
    }

    console.log(`Found ${turns.length} turn(s):\n`);

    for (const turn of turns) {
      console.log(`--- Turn (trace: ${turn.traceId}) ---`);
      console.log(`  Time: ${turn.startTime} -> ${turn.endTime}`);
      if (turn.input) {
        const mime = turn.input.mimeType ? ` [${turn.input.mimeType}]` : "";
        console.log(`  Input${mime}: ${turn.input.value}`);
      }
      if (turn.output) {
        const mime = turn.output.mimeType ? ` [${turn.output.mimeType}]` : "";
        console.log(`  Output${mime}: ${turn.output.value}`);
      }
      console.log();
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
