/**
 * Phoenix Tracing Tutorial - LLM-as-Judge Evaluation
 *
 * This script evaluates spans to help debug why traces failed:
 * - Tool spans: Did lookupOrderStatus return an error?
 * - Retrieval spans: Was the retrieved context relevant?
 * - Session-level: Was the full conversation coherent? Was the issue resolved?
 *
 * After collecting user feedback (thumbs up/down), run this to automatically
 * annotate the child spans. Then click into unhelpful traces to see what went wrong.
 *
 * Run with: pnpm evaluate
 * Run session evals with: pnpm evaluate -- --sessions
 */

import { openai } from "@ai-sdk/openai";
import { getSpans, logSpanAnnotations } from "@arizeai/phoenix-client/spans";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import { SemanticConventions } from "@arizeai/openinference-semantic-conventions";

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
// Session-Level Evaluators
// =============================================================================

/**
 * Conversation Coherence Evaluator - Did the agent maintain context throughout
 * the conversation?
 */
const conversationCoherenceEvaluator = createClassificationEvaluator({
  name: "conversation_coherence",
  model: openai("gpt-4o-mini"),
  choices: {
    coherent: 1,
    incoherent: 0,
  },
  promptTemplate: `You are evaluating whether a customer support agent maintained context throughout a multi-turn conversation.

A conversation is COHERENT if:
- The agent remembers information from earlier turns
- The agent doesn't ask for information already provided
- Responses build on previous context appropriately
- The conversation flows naturally

A conversation is INCOHERENT if:
- The agent "forgets" things the customer said earlier
- The agent asks for the same information multiple times
- Responses seem disconnected from previous turns
- The customer has to repeat themselves

[Full Conversation]:
{{input}}

Did the agent maintain context throughout this conversation?
`,
});

/**
 * Resolution Evaluator - Was the customer's issue resolved by the end of the
 * conversation?
 */
const resolutionEvaluator = createClassificationEvaluator({
  name: "resolution_status",
  model: openai("gpt-4o-mini"),
  choices: {
    resolved: 1,
    unresolved: 0,
  },
  promptTemplate: `You are evaluating whether a customer's issue was resolved in a support conversation.

The issue is RESOLVED if:
- The customer got the information they needed
- Their question was answered
- The conversation ended with the customer's needs met

The issue is UNRESOLVED if:
- The customer didn't get what they needed
- Questions went unanswered
- The agent couldn't help with the request
- The conversation ended with the customer still needing help

[Full Conversation]:
{{input}}

Was the customer's issue resolved?
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
    const input = span.attributes["input.value"] as string || "";

    try {
      const result = await retrievalRelevanceEvaluator.evaluate({
        input: input,
      });
      const label = result.label ?? "unknown";
      const score = result.score ?? 0;
      const status = label === "relevant" ? "✅ RELEVANT" : "❌ IRRELEVANT";
      console.log(`   RAG span ${spanId.substring(0, 8)}... ${status}`);

      annotations.push({
        spanId,
        name: "retrieval_relevance",
        label,
        score,
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

// =============================================================================
// Session-Level Evaluation Function
// =============================================================================

async function evaluateSessions() {
  console.log("=".repeat(60));
  console.log("Phoenix Tracing Tutorial - Session-Level Evaluation");
  console.log("=".repeat(60));

  // Step 1: Fetch spans from Phoenix
  console.log("\n📥 Fetching spans from Phoenix...");
  console.log(`   Project: ${PROJECT_NAME}`);

  let spans: SpanData[];
  try {
    const result = await getSpans({
      project: { projectName: PROJECT_NAME },
      limit: 200,
    });
    spans = result.spans as unknown as SpanData[];
    console.log(`   Found ${spans.length} spans`);
  } catch (error) {
    console.error("❌ Failed to fetch spans:", error);
    console.log("\n💡 Make sure:");
    console.log("   1. Phoenix is running at http://localhost:6006");
    console.log("   2. You've run 'pnpm sessions' to generate session traces first");
    return;
  }

  // Step 2: Group spans by session ID
  const agentSpans = spans.filter((span) => span.name === "support-agent");
  
  // Group by session ID
  const sessionGroups: Map<string, SpanData[]> = new Map();
  
  for (const span of agentSpans) {
    const sessionId = span.attributes[SemanticConventions.SESSION_ID] as string;
    if (sessionId) {
      if (!sessionGroups.has(sessionId)) {
        sessionGroups.set(sessionId, []);
      }
      sessionGroups.get(sessionId)!.push(span);
    }
  }

  console.log(`   Found ${sessionGroups.size} sessions with agent spans`);

  if (sessionGroups.size === 0) {
    console.log("\n⚠️  No sessions found. Run 'pnpm sessions' first to generate session traces.");
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

  // Step 3: Evaluate each session
  console.log("\n🗣️  Evaluating sessions...");
  console.log("-".repeat(60));

  for (const [sessionId, sessionSpans] of sessionGroups) {
    console.log(`\n📋 Session: ${sessionId.substring(0, 8)}...`);
    console.log(`   Turns: ${sessionSpans.length}`);

    // Sort by turn number if available, otherwise by span order
    sessionSpans.sort((a, b) => {
      const turnA = (a.attributes["conversation.turn"] as number) || 0;
      const turnB = (b.attributes["conversation.turn"] as number) || 0;
      return turnA - turnB;
    });

    // Build conversation transcript
    const transcript = sessionSpans.map((span, i) => {
      const input = span.attributes["input.value"] as string || "";
      const output = span.attributes["output.value"] as string || "";
      return `Turn ${i + 1}:\nUser: ${input}\nAgent: ${output}`;
    }).join("\n\n");

    console.log("   Transcript preview:", transcript.substring(0, 100) + "...");

    // Get the last span in the session for annotation
    const lastSpan = sessionSpans[sessionSpans.length - 1];
    const lastSpanId = lastSpan.context.span_id;

    // Evaluate coherence
    try {
      const coherenceResult = await conversationCoherenceEvaluator.evaluate({
        input: transcript,
      });
      const coherenceLabel = coherenceResult.label ?? "unknown";
      const coherenceScore = coherenceResult.score ?? 0;
      const status = coherenceLabel === "coherent" ? "✅ COHERENT" : "❌ INCOHERENT";
      console.log(`   Coherence: ${status}`);

      annotations.push({
        spanId: lastSpanId,
        name: "conversation_coherence",
        label: coherenceLabel,
        score: coherenceScore,
        explanation: coherenceResult.explanation,
        annotatorKind: "LLM",
        metadata: {
          model: "gpt-4o-mini",
          evaluator: "conversation_coherence",
          sessionId,
          turnCount: sessionSpans.length,
        },
      });
    } catch (error) {
      console.error(`   ❌ Coherence evaluation failed`);
    }

    // Evaluate resolution
    try {
      const resolutionResult = await resolutionEvaluator.evaluate({
        input: transcript,
      });
      const resolutionLabel = resolutionResult.label ?? "unknown";
      const resolutionScore = resolutionResult.score ?? 0;
      const status = resolutionLabel === "resolved" ? "✅ RESOLVED" : "❌ UNRESOLVED";
      console.log(`   Resolution: ${status}`);

      annotations.push({
        spanId: lastSpanId,
        name: "resolution_status",
        label: resolutionLabel,
        score: resolutionScore,
        explanation: resolutionResult.explanation,
        annotatorKind: "LLM",
        metadata: {
          model: "gpt-4o-mini",
          evaluator: "resolution_status",
          sessionId,
          turnCount: sessionSpans.length,
        },
      });
    } catch (error) {
      console.error(`   ❌ Resolution evaluation failed`);
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
        sync: false,
      });
      console.log(`✅ Logged ${annotations.length} session evaluation annotations`);
    } catch (error) {
      console.error("❌ Failed to log annotations:", error);
    }
  }

  // Step 5: Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Session Evaluation Summary");
  console.log("=".repeat(60));

  const coherenceAnnotations = annotations.filter((a) => a.name === "conversation_coherence");
  const resolutionAnnotations = annotations.filter((a) => a.name === "resolution_status");

  if (coherenceAnnotations.length > 0) {
    const coherentCount = coherenceAnnotations.filter((a) => a.label === "coherent").length;
    console.log(`\n   🧠 Conversation Coherence:`);
    console.log(`      Coherent: ${coherentCount}/${coherenceAnnotations.length}`);
  }

  if (resolutionAnnotations.length > 0) {
    const resolvedCount = resolutionAnnotations.filter((a) => a.label === "resolved").length;
    console.log(`\n   ✅ Issue Resolution:`);
    console.log(`      Resolved: ${resolvedCount}/${resolutionAnnotations.length}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("👀 Open Phoenix UI at http://localhost:6006");
  console.log("");
  console.log("What to look for:");
  console.log("   1. Go to the Sessions tab to see all conversations");
  console.log("   2. Click into a session to see the full conversation");
  console.log("   3. Check annotations on the last turn of each session:");
  console.log("      - 'conversation_coherence' shows if context was maintained");
  console.log("      - 'resolution_status' shows if the issue was resolved");
  console.log("=".repeat(60));
}

// =============================================================================
// Main Entry Point
// =============================================================================

async function main() {
  const runSessions = process.argv.includes("--sessions");

  if (runSessions) {
    await evaluateSessions();
  } else {
    await evaluateTraces();
  }
}

// Run the evaluation
main().catch(console.error);


