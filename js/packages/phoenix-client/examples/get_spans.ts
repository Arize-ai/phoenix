/* eslint-disable no-console */
import { getSpans } from "../src/spans/getSpans";

/**
 * Example: Get spans from a project with various filtering criteria
 *
 * This example demonstrates how to use the getSpans function to retrieve
 * spans from a Phoenix project with different filtering options.
 */
async function main() {
  try {
    console.log("🔍 Getting recent spans from project...");

    // Basic usage - get recent spans from a project
    const recentSpans = await getSpans({
      projectIdentifier: "default", // or use a specific project name/ID
      limit: 10,
      sortDirection: "desc",
    });

    console.log(`Found ${recentSpans.data.length} recent spans`);
    recentSpans.data.forEach((span, index) => {
      console.log(`  ${index + 1}. ${span.name} (${span.span_id})`);
      console.log(`     Trace: ${span.trace_id}`);
      console.log(
        `     Duration: ${span.start_time_unix_nano} - ${span.end_time_unix_nano}`
      );
    });

    console.log("\n🕒 Getting spans from a specific time range...");

    // Get spans from a specific time range
    const timeRangeSpans = await getSpans({
      projectIdentifier: "default",
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      endTime: new Date(),
      limit: 5,
    });

    console.log(
      `Found ${timeRangeSpans.data.length} spans from the last 24 hours`
    );

    console.log("\n🏷️ Getting spans with specific annotations...");

    // Get spans that have specific annotations
    const annotatedSpans = await getSpans({
      projectIdentifier: "default",
      annotationNames: ["quality_score", "relevance", "helpfulness"],
      limit: 5,
    });

    console.log(
      `Found ${annotatedSpans.data.length} spans with quality annotations`
    );

    console.log("\n📄 Demonstrating pagination...");

    // Demonstrate pagination
    let cursor: string | undefined;
    let pageCount = 0;
    const maxPages = 3;

    do {
      const page = await getSpans({
        projectIdentifier: "default",
        cursor,
        limit: 5,
      });

      pageCount++;
      console.log(`Page ${pageCount}: ${page.data.length} spans`);

      page.data.forEach((span, index) => {
        console.log(`  ${index + 1}. ${span.name} (${span.span_id})`);
      });

      cursor = page.next_cursor || undefined;

      // Limit to prevent infinite loop in example
      if (pageCount >= maxPages) {
        console.log("  ... (stopping pagination for example)");
        break;
      }
    } while (cursor);

    console.log("\n✅ Example completed successfully!");
  } catch (error) {
    console.error("❌ Error getting spans:", error);
    process.exit(1);
  }
}

// Run the example
main();
