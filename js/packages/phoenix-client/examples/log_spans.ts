/* eslint-disable no-console */
import { createClient } from "../src/client";
import { getSpans, logSpans, SpanCreationError } from "../src/spans";
import type { Span } from "../src/spans";

/**
 * Example: Log spans of different OpenInference kinds to a project
 *
 * This example demonstrates how to:
 * 1. Build a small trace made up of several span kinds (AGENT, RETRIEVER,
 *    EMBEDDING, LLM, TOOL, CHAIN) using Phoenix's simplified span structure
 * 2. Submit them all in a single `logSpans` call — no OpenTelemetry SDK
 *    required
 * 3. Handle a `SpanCreationError` if any span is invalid or a duplicate
 * 4. Read the spans back with `getSpans` to confirm every kind was ingested
 */

function randomHexId(byteLength: number): string {
  return Array.from({ length: byteLength }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0")
  ).join("");
}

async function main() {
  const client = createClient({
    options: {
      baseUrl: "http://localhost:6006",
    },
  });

  const projectName = "log-spans-example";
  const traceId = randomHexId(16); // 32 hex chars, like an OTel trace ID
  const startedAt = Date.now();
  const at = (offsetMs: number) => new Date(startedAt + offsetMs).toISOString();

  const rootSpanId = randomHexId(8);
  const retrieverSpanId = randomHexId(8);
  const llmSpanId = randomHexId(8);

  // One small trace covering six different OpenInference span kinds
  const spans: Span[] = [
    {
      name: "answer_question",
      span_kind: "AGENT",
      context: { trace_id: traceId, span_id: rootSpanId },
      start_time: at(0),
      end_time: at(500),
      status_code: "OK",
      attributes: { "input.value": "What is Phoenix?" },
    },
    {
      name: "retrieve_documents",
      span_kind: "RETRIEVER",
      context: { trace_id: traceId, span_id: retrieverSpanId },
      parent_id: rootSpanId,
      start_time: at(10),
      end_time: at(120),
      status_code: "OK",
      attributes: {
        "retrieval.documents.0.document.content":
          "Phoenix is an open-source observability library for LLM apps.",
        "retrieval.documents.0.document.score": 0.92,
      },
    },
    {
      name: "embed_query",
      span_kind: "EMBEDDING",
      context: { trace_id: traceId, span_id: randomHexId(8) },
      parent_id: retrieverSpanId,
      start_time: at(15),
      end_time: at(40),
      status_code: "OK",
      attributes: {
        "embedding.model_name": "text-embedding-3-small",
        "embedding.embeddings.0.embedding.text": "What is Phoenix?",
      },
    },
    {
      name: "chat_completion",
      span_kind: "LLM",
      context: { trace_id: traceId, span_id: llmSpanId },
      parent_id: rootSpanId,
      start_time: at(130),
      end_time: at(430),
      status_code: "OK",
      attributes: {
        "llm.model_name": "gpt-4o-mini",
        "llm.token_count.prompt": 42,
        "llm.token_count.completion": 18,
      },
    },
    {
      name: "search_docs",
      span_kind: "TOOL",
      context: { trace_id: traceId, span_id: randomHexId(8) },
      parent_id: llmSpanId,
      start_time: at(200),
      end_time: at(260),
      status_code: "OK",
      attributes: {
        "tool.name": "search_docs",
        "tool.parameters": JSON.stringify({ query: "Phoenix" }),
      },
    },
    {
      name: "format_response",
      span_kind: "CHAIN",
      context: { trace_id: traceId, span_id: randomHexId(8) },
      parent_id: rootSpanId,
      start_time: at(440),
      end_time: at(490),
      status_code: "OK",
      attributes: {
        "output.value":
          "Phoenix is an open-source observability library for LLM apps.",
      },
    },
  ];

  try {
    const kinds = new Set(spans.map((span) => span.span_kind));
    console.log(
      `📝 Logging ${spans.length} spans across ${kinds.size} kinds (${[...kinds].join(", ")})...`
    );

    const result = await logSpans({
      client,
      project: { projectName },
      spans,
    });
    console.log(
      `✅ Queued ${result.totalQueued} of ${result.totalReceived} spans in project "${projectName}"`
    );

    // Spans are enqueued asynchronously server-side; give it a moment before reading them back.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const { spans: ingested } = await getSpans({
      client,
      project: { projectName },
      traceIds: [traceId],
      limit: spans.length,
    });

    console.log(`\n🔍 Read back ${ingested.length} spans:`);
    ingested.forEach((span) => {
      console.log(`  - ${span.name} (${span.span_kind})`);
    });

    console.log("\n✅ Log spans example completed");
  } catch (error) {
    if (error instanceof SpanCreationError) {
      console.error(`❌ Failed to log spans: ${error.message}`);
      console.error(
        `   invalid: ${error.totalInvalid}, duplicates: ${error.totalDuplicates}`
      );
    } else {
      console.error("❌ Error:", error);

      if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
        console.error(
          "💡 Make sure Phoenix server is running on http://localhost:6006"
        );
      }
    }
  }
}

main();
