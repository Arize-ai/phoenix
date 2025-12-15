/**
 * Phoenix Tracing Tutorial - LLM-as-Judge Evaluation
 *
 * This script demonstrates how to:
 * 1. Fetch spans from Phoenix
 * 2. Create an LLM evaluator using @arizeai/phoenix-evals
 * 3. Automatically classify responses as "answered" or "unanswered"
 * 4. Log evaluation results back to Phoenix as annotations
 *
 * This automates the debugging process - instead of manually reviewing each
 * trace, the evaluator identifies which queries the agent failed to answer.
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
// Create Evaluator
// =============================================================================

/**
 * Answer Status Evaluator - Determines if the agent successfully answered the query
 * or if it remained unanswered (deflected, asked for clarification, couldn't help).
 */
const answerStatusEvaluator = createClassificationEvaluator({
  name: "answer_status",
  model: openai("gpt-4o-mini"),
  choices: {
    answered: 1,
    unanswered: 0,
  },
  promptTemplate: `You are evaluating whether a customer support agent successfully answered the user's question.

Classify the response as:
- ANSWERED: The agent provided the specific information the user asked for (e.g., actual order status, clear instructions, concrete answers)
- UNANSWERED: The agent could NOT fully help - this includes:
  - Saying "I couldn't find that information"
  - Asking for more details or clarification
  - Giving generic responses that don't address the specific question
  - Admitting the question is outside their scope
  - Order/item not found errors
  - Questions not covered in their knowledge base

[Customer Query]: {{input}}

[Agent Response]: {{output}}

Was the user's question actually answered with the information they needed?
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
  console.log("Phoenix Tracing Tutorial - LLM-as-Judge Evaluation");
  console.log("=".repeat(60));

  // Step 1: Fetch spans from Phoenix
  console.log("\n📥 Fetching spans from Phoenix...");
  console.log(`   Project: ${PROJECT_NAME}`);

  let spans: SpanData[];
  try {
    const result = await getSpans({
      project: { projectName: PROJECT_NAME },
      limit: 50,
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

  // Step 2: Filter for agent spans (the parent spans we want to evaluate)
  const agentSpans = spans.filter((span) => span.name === "support-agent");
  console.log(`   Found ${agentSpans.length} agent spans to evaluate`);

  if (agentSpans.length === 0) {
    console.log("\n⚠️  No agent spans found. Run 'pnpm start' first to generate traces.");
    return;
  }

  // Step 3: Evaluate each span
  console.log("\n🔍 Running LLM-as-Judge evaluations...");
  console.log("-".repeat(60));

  const annotations: Array<{
    spanId: string;
    name: string;
    label: string;
    score: number;
    explanation?: string;
    annotatorKind: "LLM";
    metadata: Record<string, unknown>;
  }> = [];

  for (const span of agentSpans) {
    const spanId = span.context.span_id;
    const input = span.attributes["input.value"] as string;
    const output = span.attributes["output.value"] as string;

    if (!input || !output) {
      console.log(`   ⏭️  Skipping span ${spanId} - missing input/output`);
      continue;
    }

    console.log(`\n📋 Evaluating span: ${spanId}`);
    console.log(`   Query: "${input.substring(0, 50)}..."`);

    // Run answer status evaluation
    try {
      const result = await answerStatusEvaluator.evaluate({
        input,
        output,
      });
      const status = result.label === "answered" ? "✅ ANSWERED" : "❌ UNANSWERED";
      console.log(`   ${status}`);
      if (result.explanation) {
        console.log(`   Reason: ${result.explanation.substring(0, 100)}...`);
      }

      annotations.push({
        spanId,
        name: "answer_status",
        label: result.label,
        score: result.score,
        explanation: result.explanation,
        annotatorKind: "LLM",
        metadata: {
          model: "gpt-4o-mini",
          evaluator: "answer_status",
        },
      });
    } catch (error) {
      console.error(`   ❌ Evaluation failed:`, error);
    }

    // Small delay to avoid rate limiting
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

  if (annotations.length > 0) {
    const answeredCount = annotations.filter((a) => a.label === "answered").length;
    const unansweredCount = annotations.filter((a) => a.label === "unanswered").length;
    const answerRate = (answeredCount / annotations.length) * 100;

    console.log(`\n   Answer Status:`);
    console.log(`   - Answered: ${answeredCount}/${annotations.length} (${answerRate.toFixed(0)}%)`);
    console.log(`   - Unanswered: ${unansweredCount}/${annotations.length}`);

    if (unansweredCount > 0) {
      console.log(`\n   ⚠️  ${unansweredCount} queries went unanswered - review these traces to understand why!`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("👀 Open Phoenix UI at http://localhost:6006");
  console.log("");
  console.log("What to look for:");
  console.log("   - Filter traces by 'answer_status' = 'unanswered'");
  console.log("   - Click into unanswered traces to see what went wrong");
  console.log("   - Check classification confidence, tool results, retrieved context");
  console.log("=".repeat(60));
}

// Run the evaluation
evaluateTraces().catch(console.error);


