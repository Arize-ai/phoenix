/**
 * Phoenix Tracing Tutorial - Chapter 1.1: Tracing a Simple LLM Call
 *
 * This script demonstrates how to trace a basic LLM call with Phoenix.
 * You'll learn to:
 * - Set up instrumentation for the AI SDK
 * - Make a traced LLM call
 * - View the trace in Phoenix UI
 *
 * Run with: pnpm run 01
 */

// Import instrumentation first - this must be at the top!
import "./instrumentation.js";

import { generateText } from "ai";

async function main() {
  console.log("=".repeat(60));
  console.log("Chapter 1.1: Tracing a Simple LLM Call");
  console.log("=".repeat(60));
  console.log("");

  // Scenario: A customer support bot that classifies incoming queries
  const supportQuery = "My order hasn't arrived yet";

  console.log(`📨 Incoming support query: "${supportQuery}"`);
  console.log("");
  console.log("🤖 Classifying query...");

  // Make an LLM call with telemetry enabled
  // The key is `experimental_telemetry: { isEnabled: true }`
  const { text, usage } = await generateText({
    model: "openai/gpt-4o-mini",
    system: `You are a support query classifier. Classify the user's query into exactly one of these categories:
- Order Status
- Billing
- Technical Issue
- General

Respond with ONLY the category name, nothing else.`,
    prompt: supportQuery,
    experimental_telemetry: { isEnabled: true },
  });

  console.log("");
  console.log("✅ Classification complete!");
  console.log(`   Category: ${text}`);
  console.log(`   Tokens used: ${usage?.totalTokens || "N/A"}`);
  console.log("");
  console.log("=".repeat(60));
  console.log("👀 Open Phoenix UI at http://localhost:6006");
  console.log("   Look for your trace in the 'support-bot' project");
  console.log("");
  console.log("What to look for in the trace:");
  console.log("   - Input: The system prompt and user message");
  console.log("   - Output: The classification result");
  console.log("   - Latency: How long the call took");
  console.log("   - Tokens: Prompt and completion token counts");
  console.log("=".repeat(60));
}

main().catch(console.error);
