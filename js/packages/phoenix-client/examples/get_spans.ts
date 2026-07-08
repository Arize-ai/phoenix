/* eslint-disable no-console */
import { createClient } from "../src/client";
import { getSpans } from "../src/spans/getSpans";

/**
 * Example: Get spans from a project
 */
async function main() {
  const client = createClient({
    options: {
      baseUrl: "http://localhost:6006",
    },
  });

  try {
    console.log("Getting spans...");

    // Basic usage - get recent spans
    const { spans, nextCursor } = await getSpans({
      client,
      project: { projectName: "default" },
      limit: 5,
    });

    console.log(`Found ${spans.length} spans`);

    if (spans.length > 0) {
      spans.forEach((span, index) => {
        console.log(
          `${index + 1}. ${span.name || "unnamed"} (${span.context.span_id})`
        );
      });
    }

    // Demonstrate pagination if available
    if (nextCursor) {
      const { spans: nextPage } = await getSpans({
        client,
        project: { projectName: "default" },
        cursor: nextCursor,
        limit: 3,
      });
      console.log(`Next page: ${nextPage.length} more spans`);
    }

    console.log("✅ Example completed");
  } catch (error) {
    console.error("❌ Error:", error);

    if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
      console.error(
        "💡 Make sure Phoenix server is running on http://localhost:6006"
      );
    }

    process.exit(1);
  }
}

main();
