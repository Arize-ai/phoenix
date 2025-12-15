/**
 * Phoenix Tracing Tutorial - LLM-as-Judge Evaluation
 *
 * This script demonstrates how to:
 * 1. Fetch spans from Phoenix
 * 2. Create LLM evaluators using @arizeai/phoenix-evals
 * 3. Evaluate agent responses for correctness
 * 4. Log evaluation results back to Phoenix as annotations
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
 * Correctness Evaluator - Determines if the agent's response correctly
 * addresses the user's query.
 */
const correctnessEvaluator = createClassificationEvaluator({
  name: "correctness",
  model: openai("gpt-4o-mini"),
  choices: {
    correct: 1,
    incorrect: 0,
  },
  promptTemplate: `You are evaluating a customer support agent's response.

Determine if the agent's response correctly and helpfully addresses the customer's query.

A response is CORRECT if:
- It directly answers the question asked
- The information provided is accurate (based on what a support agent would know)
- It's helpful and actionable for the customer

A response is INCORRECT if:
- It doesn't address the customer's question
- It provides wrong or misleading information
- It's unhelpful or confusing

[Customer Query]: {{input}}

[Agent Response]: {{output}}

Based on the above, is the agent's response correct or incorrect?
`,
});

/**
 * Helpfulness Evaluator - Rates how helpful the response is on a scale.
 */
const helpfulnessEvaluator = createClassificationEvaluator({
  name: "helpfulness",
  model: openai("gpt-4o-mini"),
  choices: {
    very_helpful: 1.0,
    helpful: 0.75,
    somewhat_helpful: 0.5,
    not_helpful: 0.25,
    unhelpful: 0,
  },
  promptTemplate: `You are evaluating a customer support agent's response for helpfulness.

Rate the helpfulness of the agent's response:
- VERY_HELPFUL: Response fully addresses the query with clear, actionable information
- HELPFUL: Response addresses the query well with useful information
- SOMEWHAT_HELPFUL: Response partially addresses the query but could be better
- NOT_HELPFUL: Response barely addresses the query
- UNHELPFUL: Response doesn't help at all or makes things worse

[Customer Query]: {{input}}

[Agent Response]: {{output}}

How helpful is this response?
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

    // Run correctness evaluation
    try {
      const correctnessResult = await correctnessEvaluator.evaluate({
        input,
        output,
      });
      console.log(`   ✅ Correctness: ${correctnessResult.label} (score: ${correctnessResult.score})`);

      annotations.push({
        spanId,
        name: "correctness",
        label: correctnessResult.label,
        score: correctnessResult.score,
        explanation: correctnessResult.explanation,
        annotatorKind: "LLM",
        metadata: {
          model: "gpt-4o-mini",
          evaluator: "correctness",
        },
      });
    } catch (error) {
      console.error(`   ❌ Correctness eval failed:`, error);
    }

    // Run helpfulness evaluation
    try {
      const helpfulnessResult = await helpfulnessEvaluator.evaluate({
        input,
        output,
      });
      console.log(`   ✅ Helpfulness: ${helpfulnessResult.label} (score: ${helpfulnessResult.score})`);

      annotations.push({
        spanId,
        name: "helpfulness",
        label: helpfulnessResult.label,
        score: helpfulnessResult.score,
        explanation: helpfulnessResult.explanation,
        annotatorKind: "LLM",
        metadata: {
          model: "gpt-4o-mini",
          evaluator: "helpfulness",
        },
      });
    } catch (error) {
      console.error(`   ❌ Helpfulness eval failed:`, error);
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

  const correctnessAnnotations = annotations.filter((a) => a.name === "correctness");
  const helpfulnessAnnotations = annotations.filter((a) => a.name === "helpfulness");

  if (correctnessAnnotations.length > 0) {
    const avgCorrectness =
      correctnessAnnotations.reduce((sum, a) => sum + a.score, 0) / correctnessAnnotations.length;
    const correctCount = correctnessAnnotations.filter((a) => a.label === "correct").length;
    console.log(`\n   Correctness:`);
    console.log(`   - ${correctCount}/${correctnessAnnotations.length} responses marked correct`);
    console.log(`   - Average score: ${(avgCorrectness * 100).toFixed(1)}%`);
  }

  if (helpfulnessAnnotations.length > 0) {
    const avgHelpfulness =
      helpfulnessAnnotations.reduce((sum, a) => sum + a.score, 0) / helpfulnessAnnotations.length;
    console.log(`\n   Helpfulness:`);
    console.log(`   - Average score: ${(avgHelpfulness * 100).toFixed(1)}%`);
    console.log(`   - Breakdown:`);
    const labels = ["very_helpful", "helpful", "somewhat_helpful", "not_helpful", "unhelpful"];
    labels.forEach((label) => {
      const count = helpfulnessAnnotations.filter((a) => a.label === label).length;
      if (count > 0) {
        console.log(`     • ${label}: ${count}`);
      }
    });
  }

  console.log("\n" + "=".repeat(60));
  console.log("👀 Open Phoenix UI at http://localhost:6006");
  console.log("");
  console.log("What to look for:");
  console.log("   - Check the Annotations tab on each trace");
  console.log("   - Filter traces by correctness or helpfulness labels");
  console.log("   - Find patterns: which query types have lower scores?");
  console.log("=".repeat(60));
}

// Run the evaluation
evaluateTraces().catch(console.error);


