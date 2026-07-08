/* eslint-disable no-console */
import { createClient } from "../src/client";
import { deleteSpan } from "../src/spans/deleteSpan";
import { getSpans } from "../src/spans/getSpans";

/**
 * Example: Delete spans from a project
 *
 * This example demonstrates how to:
 * 1. Find spans in a project
 * 2. Delete specific spans by their identifier
 * 3. Handle errors when spans don't exist
 */
async function main() {
  const client = createClient({
    options: {
      baseUrl: "http://localhost:6006",
    },
  });

  try {
    console.log("🔍 Getting spans to demonstrate deletion...");

    // Get some spans to work with
    const { spans } = await getSpans({
      client,
      project: { projectName: "default" },
      limit: 5,
    });

    console.log(`Found ${spans.length} spans`);

    if (spans.length === 0) {
      console.log("No spans found to delete. Please add some spans first.");
      return;
    }

    // Show available spans
    spans.forEach((span, index) => {
      console.log(
        `${index + 1}. ${span.name || "unnamed"} (ID: ${span.context.span_id})`
      );
    });

    // Example 1: Delete by OpenTelemetry span_id
    const firstSpan = spans[0]!;
    console.log(`\n🗑️  Deleting span: ${firstSpan.name || "unnamed"}`);

    try {
      await deleteSpan({
        client,
        spanIdentifier: firstSpan.context.span_id,
      });
      console.log("✅ Span deleted successfully");
    } catch (error) {
      console.log("❌ Failed to delete span:", error);
    }

    // Example 2: Delete by Phoenix Global ID (if available)
    if (spans.length > 1 && spans[1]?.id) {
      const secondSpan = spans[1]!;
      console.log(
        `\n🗑️  Deleting span by Global ID: ${secondSpan.name || "unnamed"}`
      );

      try {
        await deleteSpan({
          client,
          spanIdentifier: secondSpan.id!,
        });
        console.log("✅ Span deleted successfully by Global ID");
      } catch (error) {
        console.log("❌ Failed to delete span by Global ID:", error);
      }
    }

    // Example 3: Try to delete a non-existent span (demonstrates error handling)
    console.log("\n🔍 Testing error handling with non-existent span...");
    try {
      await deleteSpan({
        client,
        spanIdentifier: "nonexistent-span-id",
      });
    } catch (error) {
      console.log("✅ Correctly caught error for non-existent span:", error);
    }

    console.log("\n✅ Delete spans example completed");
    console.log(
      "\n⚠️  Important: Child spans become orphaned when parent is deleted"
    );
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
