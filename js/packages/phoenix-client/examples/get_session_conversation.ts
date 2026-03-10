/* eslint-disable no-console */
import { createClient } from "../src/client";
import { getSessionConversation } from "../src/sessions/getSessionConversation";

/**
 * Example: Get a conversation view of a session
 *
 * This fetches all traces in a session and extracts the input/output
 * from root spans to present them as ordered conversation turns.
 *
 * Usage:
 *   npx tsx examples/get_session_conversation.ts [session-id]
 */
async function main() {
  const sessionId = process.argv[2] || "my-session-id";

  const client = createClient({
    options: {
      baseUrl: "http://localhost:6006",
    },
  });

  try {
    console.log(`Fetching conversation for session: ${sessionId}`);

    const turns = await getSessionConversation({ client, sessionId });

    if (turns.length === 0) {
      console.log("No conversation turns found.");
      return;
    }

    console.log(`Found ${turns.length} conversation turn(s):\n`);

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
