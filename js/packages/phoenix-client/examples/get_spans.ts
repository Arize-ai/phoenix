/* eslint-disable no-console */
import { getSpans } from "../src/spans/getSpans";
import { createClient } from "../src/client";

/**
 * Example: Get spans from a project with various filtering criteria
 *
 * This example demonstrates how to use the getSpans function to retrieve
 * spans from a Phoenix project with different filtering options.
 *
 * Prerequisites:
 * - Phoenix server running (default: http://localhost:6006)
 * - Some traces/spans in your Phoenix project
 */
async function main() {
  // Create a client pointing to your Phoenix server
  const client = createClient({
    options: {
      baseUrl: "http://localhost:6006", // Adjust if your Phoenix server is elsewhere
    },
  });

  try {
    console.log("🔍 Getting recent spans from project...");

    // Basic usage - get recent spans from a project
    const recentSpans = await getSpans({
      client,
      projectIdentifier: "default", // or use a specific project name/ID
      limit: 5,
      sortDirection: "desc",
    });

    console.log(`Found ${recentSpans.data.length} recent spans`);

    if (recentSpans.data.length > 0) {
      console.log("\n📋 Span Details:");
      recentSpans.data.forEach((span, index) => {
        console.log(
          `  ${index + 1}. ${span.name || "unnamed"} (${span.span_id})`
        );
        console.log(`     Trace: ${span.trace_id}`);
        console.log(
          `     Status: ${span.status?.code} (${span.status?.message || "no message"})`
        );
        console.log(
          `     Duration: ${span.start_time_unix_nano} - ${span.end_time_unix_nano}`
        );

        // Show some key attributes
        if (span.attributes && span.attributes.length > 0) {
          console.log(`     Key Attributes:`);
          span.attributes.slice(0, 3).forEach((attr) => {
            const value =
              attr.value?.string_value ||
              attr.value?.int_value ||
              attr.value?.double_value ||
              attr.value?.bool_value ||
              "complex_value";
            console.log(`       - ${attr.key}: ${value}`);
          });
          if (span.attributes.length > 3) {
            console.log(
              `       ... and ${span.attributes.length - 3} more attributes`
            );
          }
        }
      });

      // Show complete structure of first span for reference
      console.log("\n🔍 Complete structure of first span:");
      console.log("=====================================");
      console.log(JSON.stringify(recentSpans.data[0], null, 2));
    } else {
      console.log("ℹ️  No spans found in the default project.");
      console.log(
        "   Make sure you have traces in Phoenix or try a different project."
      );
    }

    console.log("\n🕒 Getting spans from a specific time range...");

    // Get spans from a specific time range
    const timeRangeSpans = await getSpans({
      client,
      projectIdentifier: "default",
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      limit: 10,
    });

    console.log(
      `Found ${timeRangeSpans.data.length} spans from the last 24 hours`
    );

    console.log("\n🏷️ Getting spans with specific annotations...");

    // Get spans that have specific annotations
    const annotatedSpans = await getSpans({
      client,
      projectIdentifier: "default",
      annotationNames: ["quality_score", "relevance", "helpfulness"],
      limit: 3,
    });

    console.log(
      `Found ${annotatedSpans.data.length} spans with quality annotations`
    );

    console.log("\n📄 Demonstrating pagination...");

    // Demonstrate pagination
    let cursor: string | undefined = recentSpans.next_cursor || undefined;
    let pageCount = 1; // We already have page 1
    const maxPages = 3;

    if (cursor) {
      console.log(
        `Page 1: ${recentSpans.data.length} spans (already retrieved)`
      );

      while (cursor && pageCount < maxPages) {
        const page = await getSpans({
          client,
          projectIdentifier: "default",
          cursor,
          limit: 3,
        });

        pageCount++;
        console.log(`Page ${pageCount}: ${page.data.length} spans`);

        page.data.forEach((span, index) => {
          console.log(
            `  ${index + 1}. ${span.name || "unnamed"} (${span.span_id})`
          );
        });

        cursor = page.next_cursor || undefined;
      }

      if (pageCount >= maxPages && cursor) {
        console.log("  ... (stopping pagination for example)");
      }
    } else {
      console.log("No more pages available for pagination demo");
    }

    console.log("\n🎯 Response Structure Analysis:");
    console.log("===============================");
    console.log("The getSpans function returns an object with:");
    console.log("- data: Array of OTLP-compliant span objects");
    console.log(
      "- next_cursor: Base64-encoded cursor for pagination (if more data available)"
    );
    console.log("\nEach span contains:");
    console.log("- Core fields: trace_id, span_id, name, start/end times");
    console.log(
      "- Attributes: Key-value pairs with typed values (string, int, double, bool, etc.)"
    );
    console.log("- Status: Code (1=OK, 2=ERROR) and optional message");
    console.log("- Events: Array of timestamped events (e.g., exceptions)");
    console.log("- Links: References to other spans (typically null)");

    console.log("\n📄 Example Response Object Snippet:");
    console.log("===================================");
    if (recentSpans.data.length > 0) {
      // Create a simplified version of the response for demonstration
      const firstSpan = recentSpans.data[0]!;
      const exampleResponse = {
        data: [
          {
            trace_id: firstSpan.trace_id,
            span_id: firstSpan.span_id,
            name: firstSpan.name,
            kind: firstSpan.kind,
            start_time_unix_nano: firstSpan.start_time_unix_nano,
            end_time_unix_nano: firstSpan.end_time_unix_nano,
            status: firstSpan.status,
            attributes:
              firstSpan.attributes?.slice(0, 2).map((attr) => ({
                key: attr.key,
                value: attr.value,
              })) || [],
            "...": `${(firstSpan.attributes?.length || 0) - 2} more attributes`,
            events: firstSpan.events?.slice(0, 1) || null,
            parent_span_id: firstSpan.parent_span_id,
            flags: firstSpan.flags,
            trace_state: firstSpan.trace_state,
          },
          "... more spans",
        ],
        next_cursor: recentSpans.next_cursor,
      };
      console.log(JSON.stringify(exampleResponse, null, 2));
    } else {
      console.log(`{
  "data": [],
  "next_cursor": null
}`);
    }

    console.log("\n✅ Example completed successfully!");
    console.log("\n💡 Next steps:");
    console.log("- Try different projectIdentifier values");
    console.log("- Experiment with time range filtering");
    console.log("- Use annotation filtering for spans with specific metadata");
    console.log("- Implement pagination for large datasets");
  } catch (error) {
    console.error("❌ Error getting spans:", error);

    if (error instanceof Error) {
      if (error.message.includes("ECONNREFUSED")) {
        console.error(
          "💡 Make sure Phoenix server is running on http://localhost:6006"
        );
        console.error("   Start it with: python -m phoenix.server.main serve");
      } else if (error.message.includes("404")) {
        console.error("💡 Check that the project identifier exists");
      }
    }

    process.exit(1);
  }
}

// Run the example
main();
