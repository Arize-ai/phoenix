import { generateText, tool } from "ai";
import { z } from "zod";
import "./instrumentation.js";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

// Simulated order database
const orderDatabase: Record<string, { status: string; carrier: string; eta: string }> = {
  "ORD-12345": { status: "shipped", carrier: "FedEx", eta: "December 11, 2025" },
  "ORD-67890": { status: "processing", carrier: "pending", eta: "December 15, 2025" },
};

async function handleOrderQuery(userQuery: string) {
  // Step 1: LLM decides to use the tool
  const toolDecision = await generateText({
    model: openai.chat("gpt-4o-mini"),
    system: "You are a support agent. Use the lookupOrderStatus tool when customers ask about orders.",
    prompt: userQuery,
    tools: {
      lookupOrderStatus: tool({
        description: "Look up order status by order ID",
        inputSchema: z.object({
          orderId: z.string().describe("The order ID (e.g., ORD-12345)"),
        }),
        execute: async ({ orderId }) => {
          const order = orderDatabase[orderId];
          if (!order) return { error: `Order ${orderId} not found` };
          return { orderId, ...order };
        },
      }),
    },
    maxSteps: 2,
    experimental_telemetry: { isEnabled: true },
  });

  // Step 2: Extract tool result
  let orderInfo = null;
  for (const step of toolDecision.steps || []) {
    if (step.toolResults?.length > 0) {
      orderInfo = (step.toolResults[0] as any).output;
      break;
    }
  }

  if (!orderInfo) {
    return "Please provide your order ID (e.g., ORD-12345).";
  }

  // Step 3: LLM summarizes the tool result
  const response = await generateText({
    model: openai.chat("gpt-4o-mini"),
    system: "Summarize order information in a friendly way.",
    prompt: `Order info: ${JSON.stringify(orderInfo)}. Write a helpful response.`,
    experimental_telemetry: { isEnabled: true },
  });

  return response.text;
}