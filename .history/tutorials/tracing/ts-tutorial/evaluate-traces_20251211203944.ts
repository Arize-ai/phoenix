/**
 * Phoenix Tracing Tutorial - LLM-as-Judge Evaluation
 *
 * This script evaluates child spans to help debug why traces failed:
 * - Tool spans: Did lookupOrderStatus return an error?
 * - Retrieval spans: Was the retrieved context relevant?
 *
 * After collecting user feedback (thumbs up/down), run this to automatically
 * annotate the child spans. Then click into unhelpful traces to see what went wrong.
 *
 * Run with: pnpm evaluate
 */

import { openai } from "@ai-sdk/openai";
import { getSpans, logSpanAnnotations } from "@arizeai/phoenix-client/spans";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";

// =============================================================================
// Configuration
// =============================================================================

const PROJECT_NAME = "support-bot";

// =============================================================================
// Create Evaluators
// =============================================================================

/**
 * Retrieval Relevance Evaluator - Determines if retrieved context was relevant
 * to the user's question.
 */
const retrievalRelevanceEvaluator = createClassificationEvaluator({
  name: "retrieval_relevance",
  model: openai("gpt-4o-mini"),
  choices: {
    relevant: 1,
    irrelevant: 0,
  },
  promptTemplate: `You are evaluating whether the retrieved context is relevant to answering the user's prompt.

Classify the retrieval as:
- RELEVANT: The context contains information that directly helps answer the question
- IRRELEVANT: The context does NOT contain useful information for the question

You are comparing the "Context" object and the "prompt" object.

[Context and Prompt]: {{input}}
`,
});

// =============================================================================
// Main Evaluation Function
// =============================================================================

interface SpanData {
  context: {
    span_id: string;
    trace_id: string;
  };
  name: string;
  attributes: Record<string, unknown>;
}

async function evaluateTraces() {
  console.log("=".repeat(60));
  console.log("Phoenix Tracing Tutorial - Child Span Evaluation");
  console.log("=".repeat(60));

  // Step 1: Fetch spans from Phoenix
  console.log("\n📥 Fetching spans from Phoenix...");
  console.log(`   Project: ${PROJECT_NAME}`);

  let spans: SpanData[];
  try {
    const result = await getSpans({
      project: { projectName: PROJECT_NAME },
      limit: 100,
    });
    spans = result.spans as unknown as SpanData[];
    console.log(`   Found ${spans.length} spans`);
  } catch (error) {
    console.error("❌ Failed to fetch spans:", error);
    console.log("\n💡 Make sure:");
    console.log("   1. Phoenix is running at http://localhost:6006");
    console.log("   2. You've run 'pnpm start' to generate traces first");
    return;
  }

  // Step 2: Filter spans by type
  const toolSpans = spans.filter((span) => span.name === "ai.toolCall");
  const llmSpans = spans.filter((span) => 
    span.name === "ai.generateText" && 
    String(span.attributes["input.value"] || "").includes("Answer the user's question using ONLY the information provided in the context below. Be friendly and concise.")
  );

  console.log(`   Found ${toolSpans.length} tool spans`);
  console.log(`   Found ${llmSpans.length} RAG generation spans`);

  if (toolSpans.length === 0 && llmSpans.length === 0) {
    console.log("\n⚠️  No tool or RAG spans found. Run 'pnpm start' first to generate traces.");
    return;
  }

  const annotations: Array<{
    spanId: string;
    name: string;
    label: string;
    score: number;
    explanation?: string;
    annotatorKind: "LLM";
    metadata: Record<string, unknown>;
  }> = [];

  // Step 3: Evaluate tool spans (simple code-based check)
  console.log("\n🔧 Evaluating tool calls...");
  console.log("-".repeat(60));

  // for (const span of toolSpans) {
  //   const spanId = span.context.span_id;
  //   const output = JSON.stringify(span.attributes["output.value"] || "");

  //   // Simple check: does the output contain "error" or "not found"?
  //   const hasError = output.toLowerCase().includes("error") || 
  //                    output.toLowerCase().includes("not found");
    
  //   const status = hasError ? "❌ ERROR" : "✅ SUCCESS";
  //   console.log(`   Tool span ${spanId.substring(0, 8)}... ${status}`);

  //   annotations.push({
  //     spanId,
  //     name: "tool_result",
  //     label: hasError ? "error" : "success",
  //     score: hasError ? 0 : 1,
  //     explanation: hasError ? "Tool returned an error or 'not found' response" : "Tool executed successfully",
  //     annotatorKind: "LLM" as const,  // Using "LLM" for consistency, though this is code-based
  //     metadata: {
  //       evaluator: "tool_result",
  //       type: "code",
  //     },
  //   });
  // }

  // Step 3c: Evaluate retrieval relevance (requires finding the query context)
  // This is more complex - we need to extract the context from the LLM span's system prompt
  // For simplicity, we'll check if the RAG spans have relevant context by looking at the generation
  console.log("\n📚 Evaluating retrieval relevance...");
  console.log("-".repeat(60));

  for (const span of llmSpans) {
    const spanId = span.context.span_id;
    
    // Extract the system prompt (which contains the retrieved context)
    const input = span.attributes["input.value"] as string || "";

    try {
      const result = await retrievalRelevanceEvaluator.evaluate({
        input: input,
      });
      const status = result.label === "relevant" ? "✅ RELEVANT" : "❌ IRRELEVANT";
      console.log(`   RAG span ${spanId.substring(0, 8)}... ${status}`);

      annotations.push({
        spanId,
        name: "retrieval_relevance",
        label: result.label,
        score: result.score,
        explanation: result.explanation,
        annotatorKind: "LLM",
        metadata: {
          model: "gpt-4o-mini",
          evaluator: "retrieval_relevance",
        },
      });
    } catch (error) {
      console.error(`   ❌ Evaluation failed for ${spanId.substring(0, 8)}...`);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Step 4: Log annotations to Phoenix
  console.log("\n" + "-".repeat(60));
  console.log("📤 Logging evaluation results to Phoenix...");

  if (annotations.length > 0) {
    try {
      await logSpanAnnotations({
        spanAnnotations: annotations,
        sync: false,  // async mode - Phoenix processes in background
      });
      console.log(`✅ Logged ${annotations.length} evaluation annotations`);
    } catch (error) {
      console.error("❌ Failed to log annotations:", error);
    }
  }

  // Step 5: Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Evaluation Summary");
  console.log("=".repeat(60));

  // Tool span summary
  const toolAnnotations = annotations.filter((a) => a.name === "tool_result");
  if (toolAnnotations.length > 0) {
    const successCount = toolAnnotations.filter((a) => a.label === "success").length;
    const errorCount = toolAnnotations.filter((a) => a.label === "error").length;

    console.log(`\n   🔧 Tool Calls (lookupOrderStatus):`);
    console.log(`      Success: ${successCount} | Errors: ${errorCount}`);
  }

  // Retrieval span summary
  const retrievalAnnotations = annotations.filter((a) => a.name === "retrieval_relevance");
  if (retrievalAnnotations.length > 0) {
    const relevantCount = retrievalAnnotations.filter((a) => a.label === "relevant").length;
    const irrelevantCount = retrievalAnnotations.filter((a) => a.label === "irrelevant").length;

    console.log(`\n   📚 FAQ Retrieval:`);
    console.log(`      Relevant: ${relevantCount} | Irrelevant: ${irrelevantCount}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("👀 Open Phoenix UI at http://localhost:6006");
  console.log("");
  console.log("Now click into traces you marked as unhelpful to see:");
  console.log("   - 'tool_result' = 'error' → Order not found");
  console.log("   - 'retrieval_relevance' = 'irrelevant' → FAQ not in knowledge base");
  console.log("=".repeat(60));
}

// Run the evaluation
evaluateTraces().catch(console.error);


