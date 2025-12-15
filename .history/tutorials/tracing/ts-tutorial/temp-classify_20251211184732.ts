// Import instrumentation first - this must be at the top to enable tracing
import { provider } from "./instrumentation.js";

import { generateText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { z } from "zod";

// Create a tracer instance - this is what we use to create custom spans
const tracer = trace.getTracer("support-agent");

// Simulated order database (in a real app, this would be a database call)
const orderDatabase: Record<string, { status: string; carrier: string; eta: string }> = {
  "ORD-12345": { status: "shipped", carrier: "FedEx", eta: "December 11, 2025" },
  "ORD-67890": { status: "processing", carrier: "pending", eta: "December 15, 2025" },
};

async function handleOrderQuery(userQuery: string) {
  // KEY: Wrap everything in a parent span so all operations appear under ONE trace
  // Without this, each generateText call would create its own separate root trace
  return tracer.startActiveSpan(
    "handle-order-query",  // This name appears in Phoenix as the trace name
    { attributes: { "openinference.span.kind": "CHAIN", "input.value": userQuery } },
    async (span) => {
      try {
        // Step 1: LLM decides which tool to call based on the user's query
        // This generateText call will appear as a child span under "handle-order-query"
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

        // Step 2: Extract the tool result from the response
        // The AI SDK returns tool results in a nested structure
        let orderInfo = null;
        for (const step of toolDecision.steps || []) {
          if (step.toolResults?.length > 0) {
            orderInfo = (step.toolResults[0] as any).output;
            break;
          }
        }

        // Handle case where no order ID was found in the query
        if (!orderInfo) {
          const response = "Please provide your order ID (e.g., ORD-12345).";
          span.setAttribute("output.value", response);  // Record output for debugging
          span.setStatus({ code: SpanStatusCode.OK });
          return response;
        }

        // Step 3: Make a SECOND LLM call to summarize the tool result
        // This also appears as a child span under "handle-order-query"
        const response = await generateText({
          model: openai.chat("gpt-4o-mini"),
          system: "Summarize order information in a friendly way.",
          prompt: `Order info: ${JSON.stringify(orderInfo)}. Write a helpful response.`,
          experimental_telemetry: { isEnabled: true },
        });

        // Record the final output on the parent span - useful for debugging
        span.setAttribute("output.value", response.text);
        span.setStatus({ code: SpanStatusCode.OK });
        return response.text;
      } catch (error) {
        // Mark the span as errored if anything fails
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        // Always end the span - this is required!
        span.end();
      }
    }
  );
}

async function main() {
  const response = await handleOrderQuery("What's the status of order ORD-12345?");
  console.log(response);
  
  // Ensure all traces are sent to Phoenix before the script exits
  await provider.forceFlush();
}

main();
