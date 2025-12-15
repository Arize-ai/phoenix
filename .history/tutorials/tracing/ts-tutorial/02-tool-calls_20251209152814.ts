/**
 * Phoenix Tracing Tutorial - Chapter 1.2: Tracing Tool Calls
 *
 * This script demonstrates how to trace LLM tool calls with Phoenix.
 * You'll learn to:
 * - Define tools using the AI SDK
 * - See tool spans nested under LLM spans
 * - Understand tool execution flow and timing
 *
 * Run with: pnpm run 02
 */

// Import instrumentation first - this must be at the top!
import "./instrumentation.js";

import { generateText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

// Simulated order database
const orderDatabase: Record<
  string,
  { status: string; carrier: string; trackingNumber: string; eta: string }
> = {
  "ORD-12345": {
    status: "shipped",
    carrier: "FedEx",
    trackingNumber: "1234567890",
    eta: "December 11, 2025",
  },
  "ORD-67890": {
    status: "processing",
    carrier: "pending",
    trackingNumber: "pending",
    eta: "December 15, 2025",
  },
  "ORD-11111": {
    status: "delivered",
    carrier: "UPS",
    trackingNumber: "9876543210",
    eta: "Delivered December 5, 2025",
  },
};

async function main() {
  console.log("=".repeat(60));
  console.log("Chapter 1.2: Tracing Tool Calls");
  console.log("=".repeat(60));
  console.log("");

  // Scenario: Customer asks about their order status
  const customerQuery = "What's the status of order ORD-12345?";

  console.log(`📨 Customer query: "${customerQuery}"`);
  console.log("");
  console.log("🤖 Processing with tools...");

  // Define and use tools with the AI SDK
  // Using openai.chat() to use the Chat Completions API
  const result = await generateText({
    model: openai.chat("gpt-4o-mini"),
    system: `You are a helpful customer support agent. When customers ask about order status, use the lookupOrderStatus tool to get the information, then provide a friendly response.`,
    prompt: customerQuery,
    tools: {
      lookupOrderStatus: tool({
        description:
          "Look up the current status of a customer order by order ID",
        inputSchema: z.object({
          orderId: z.string().describe("The order ID to look up (e.g., ORD-12345)"),
        }),
        execute: async ({ orderId }) => {
          console.log(`   🔧 Tool called: lookupOrderStatus(${orderId})`);

          // Simulate API latency
          await new Promise((resolve) => setTimeout(resolve, 500));

          const order = orderDatabase[orderId];
          if (!order) {
            return { error: `Order ${orderId} not found` };
          }

          console.log(`   ✅ Tool returned: ${JSON.stringify(order)}`);
          return {
            orderId,
            ...order,
          };
        },
      }),
    },
    // Allow multiple steps so the model can:
    // 1. Decide to call the tool
    // 2. Receive the tool result
    // 3. Generate a final response
    maxSteps: 3,
    experimental_telemetry: { isEnabled: true },
  });

  console.log("");
  console.log("✅ Response generated!");
  console.log("");
  console.log("📤 Agent response:");
  console.log(`   ${result.text}`);
  console.log("");
  console.log(`   Steps taken: ${result.steps.length}`);
  console.log(`   Tool calls made: ${result.toolCalls.length}`);
  console.log("");
  console.log("=".repeat(60));
  console.log("👀 Open Phoenix UI at http://localhost:6006");
  console.log("");
  console.log("What to look for in the trace:");
  console.log("   - Multiple LLM spans (one per step)");
  console.log("   - Tool span nested under the LLM span");
  console.log("   - Tool parameters: orderId");
  console.log("   - Tool result: order status details");
  console.log("   - Tool execution time (~500ms simulated delay)");
  console.log("=".repeat(60));
}

main().catch(console.error);
