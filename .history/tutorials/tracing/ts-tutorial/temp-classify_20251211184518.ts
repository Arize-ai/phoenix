import { provider } from "./instrumentation.js";
import { generateText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { z } from "zod";

const tracer = trace.getTracer("support-agent");

// Simulated order database
const orderDatabase: Record<string, { status: string; carrier: string; eta: string }> = {
  "ORD-12345": { status: "shipped", carrier: "FedEx", eta: "December 11, 2025" },
  "ORD-67890": { status: "processing", carrier: "pending", eta: "December 15, 2025" },
};

async function handleOrderQuery(userQuery: string) {
  // Wrap everything in a parent span so all operations appear under one trace
  return tracer.startActiveSpan(
    "handle-order-query",
    { attributes: { "openinference.span.kind": "CHAIN", "input.value": userQuery } },
    async (span) => {
      try {
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
          const response = "Please provide your order ID (e.g., ORD-12345).";
          span.setAttribute("output.value", response);
          span.setStatus({ code: SpanStatusCode.OK });
          return response;
        }

        // Step 3: LLM summarizes the tool result
        const response = await generateText({
          model: openai.chat("gpt-4o-mini"),
          system: "Summarize order information in a friendly way.",
          prompt: `Order info: ${JSON.stringify(orderInfo)}. Write a helpful response.`,
          experimental_telemetry: { isEnabled: true },
        });

        span.setAttribute("output.value", response.text);
        span.setStatus({ code: SpanStatusCode.OK });
        return response.text;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

async function main() {
  const response = await handleOrderQuery("What's the status of order ORD-12345?");
  console.log(response);
  await provider.forceFlush();
}

main();
