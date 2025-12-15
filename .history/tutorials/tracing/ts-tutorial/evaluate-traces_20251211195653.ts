/**
 * Phoenix Tracing Tutorial - LLM-as-Judge Evaluation
 *
 * This script demonstrates how to:
 * 1. Fetch spans from Phoenix
 * 2. Create evaluators for different span types:
 *    - Agent spans: "answered" vs "unanswered"
 *    - Tool spans: "success" vs "error"
 *    - Retrieval spans: "relevant" vs "irrelevant" context
 * 3. Log evaluation results back to Phoenix as annotations
 *
 * This automates the debugging process - instead of manually reviewing each
 * trace, the evaluators identify failures at every level.
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
  promptTemplate: `You are evaluating whether the retrieved context is relevant to answering the user's question.

Classify the retrieval as:
- RELEVANT: The context contains information that directly helps answer the question
- IRRELEVANT: The context does NOT contain useful information for the question

[User Question]: {{input}}

[Retrieved Context]: {{output}}

Is this context relevant to the question?
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

  // Step 2: Filter spans by type
  const agentSpans = spans.filter((span) => span.name === "support-agent");
  const toolSpans = spans.filter((span) => span.name === "lookupOrderStatus");
  const llmSpans = spans.filter((span) => 
    span.name === "ai.generateText" && 
    String(span.attributes["gen_ai.system"] || "").includes("Answer using ONLY this context")
  );

  console.log(`   Found ${agentSpans.length} agent spans`);
  console.log(`   Found ${toolSpans.length} tool spans`);
  console.log(`   Found ${llmSpans.length} RAG generation spans`);

  if (agentSpans.length === 0) {
    console.log("\n⚠️  No agent spans found. Run 'pnpm start' first to generate traces.");
    return;
  }

  // Step 3: Evaluate spans
  console.log("\n🔍 Running evaluations...");
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

  // Step 3b: Evaluate tool spans (simple code-based check)
  console.log("\n🔧 Evaluating tool calls...");
  console.log("-".repeat(60));

  for (const span of toolSpans) {
    const spanId = span.context.span_id;
    const output = JSON.stringify(span.attributes["output.value"] || "");

    // Simple check: does the output contain "error" or "not found"?
    const hasError = output.toLowerCase().includes("error") || 
                     output.toLowerCase().includes("not found");
    
    const status = hasError ? "❌ ERROR" : "✅ SUCCESS";
    console.log(`   Tool span ${spanId.substring(0, 8)}... ${status}`);

    annotations.push({
      spanId,
      name: "tool_result",
      label: hasError ? "error" : "success",
      score: hasError ? 0 : 1,
      explanation: hasError ? "Tool returned an error or 'not found' response" : "Tool executed successfully",
      annotatorKind: "LLM" as const,  // Using "LLM" for consistency, though this is code-based
      metadata: {
        evaluator: "tool_result",
        type: "code",
      },
    });
  }

  // Step 3c: Evaluate retrieval relevance (requires finding the query context)
  // This is more complex - we need to extract the context from the LLM span's system prompt
  // For simplicity, we'll check if the RAG spans have relevant context by looking at the generation
  console.log("\n📚 Evaluating retrieval relevance...");
  console.log("-".repeat(60));

  for (const span of llmSpans) {
    const spanId = span.context.span_id;
    
    // Extract the system prompt (which contains the retrieved context)
    const messages = span.attributes["llm.input_messages"] as string || "";
    const prompt = span.attributes["llm.prompts"] as string || "";
    const systemPrompt = messages || prompt;
    
    // Try to extract the user query and context from the prompt
    // The format is: "Answer using ONLY this context:\n\n{context}" with the user query as the prompt
    const userPrompt = span.attributes["gen_ai.prompt"] as string || 
                       span.attributes["input.value"] as string || "";
    
    if (!systemPrompt || !userPrompt) {
      console.log(`   ⏭️  Skipping span ${spanId.substring(0, 8)}... - missing data`);
      continue;
    }

    // Extract context from system prompt (everything after "context:")
    const contextMatch = systemPrompt.match(/context[:\s]*([\s\S]*)/i);
    const context = contextMatch ? contextMatch[1].trim() : systemPrompt;

    try {
      const result = await retrievalRelevanceEvaluator.evaluate({
        input: userPrompt,
        output: context,
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

  // Agent span summary
  const answerAnnotations = annotations.filter((a) => a.name === "answer_status");
  if (answerAnnotations.length > 0) {
    const answeredCount = answerAnnotations.filter((a) => a.label === "answered").length;
    const unansweredCount = answerAnnotations.filter((a) => a.label === "unanswered").length;

    console.log(`\n   🤖 Agent Responses:`);
    console.log(`      Answered: ${answeredCount} | Unanswered: ${unansweredCount}`);
  }

  // Tool span summary
  const toolAnnotations = annotations.filter((a) => a.name === "tool_result");
  if (toolAnnotations.length > 0) {
    const successCount = toolAnnotations.filter((a) => a.label === "success").length;
    const errorCount = toolAnnotations.filter((a) => a.label === "error").length;

    console.log(`\n   🔧 Tool Calls:`);
    console.log(`      Success: ${successCount} | Errors: ${errorCount}`);
  }

  // Retrieval span summary
  const retrievalAnnotations = annotations.filter((a) => a.name === "retrieval_relevance");
  if (retrievalAnnotations.length > 0) {
    const relevantCount = retrievalAnnotations.filter((a) => a.label === "relevant").length;
    const irrelevantCount = retrievalAnnotations.filter((a) => a.label === "irrelevant").length;

    console.log(`\n   📚 Retrieval:`);
    console.log(`      Relevant: ${relevantCount} | Irrelevant: ${irrelevantCount}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("👀 Open Phoenix UI at http://localhost:6006");
  console.log("");
  console.log("What to look for:");
  console.log("   - Filter by 'answer_status' = 'unanswered' to find failures");
  console.log("   - Filter by 'tool_result' = 'error' to find tool issues");
  console.log("   - Filter by 'retrieval_relevance' = 'irrelevant' for bad retrieval");
  console.log("=".repeat(60));
}

// Run the evaluation
evaluateTraces().catch(console.error);


