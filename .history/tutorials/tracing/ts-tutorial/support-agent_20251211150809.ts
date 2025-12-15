/**
 * Phoenix Tracing Tutorial - Support Agent
 *
 * A complete support agent that demonstrates all three tracing patterns:
 * - LLM calls (query classification)
 * - Tool calls (order status lookup)
 * - RAG pipeline (FAQ search + generation)
 *
 * All operations are traced under a single parent span.
 * After generating responses, prompts for interactive user feedback
 * (thumbs up/down) which is sent to Phoenix as annotations.
 *
 * Run with: pnpm start
 */

// Import instrumentation first - this must be at the top!
import { provider } from "./instrumentation.js";

import { embed, generateText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { z } from "zod";
import { logSpanAnnotations } from "@arizeai/phoenix-client/spans";
import { createClient } from "@arizeai/phoenix-client";

// Create Phoenix client with the same endpoint as tracing
const PHOENIX_HOST = process.env.PHOENIX_COLLECTOR_ENDPOINT || "http://localhost:6006";
const phoenixClient = createClient({ baseUrl: PHOENIX_HOST });

// Get a tracer for creating custom spans
const tracer = trace.getTracer("support-agent");

// =============================================================================
// Order Database (for tool calls)
// =============================================================================

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

// =============================================================================
// FAQ Database (for RAG)
// =============================================================================

interface FAQEntry {
  id: number;
  question: string;
  answer: string;
  category: string;
  embedding: number[] | null;
}

const FAQ_DATABASE: FAQEntry[] = [
  {
    id: 1,
    question: "How do I reset my password?",
    answer:
      "Go to Settings > Security > Reset Password. You'll receive an email with a reset link that expires in 24 hours.",
    category: "Account",
    embedding: null,
  },
  {
    id: 2,
    question: "What's your refund policy?",
    answer:
      "We offer full refunds within 30 days of purchase for unused items. Contact support with your order number to initiate a refund.",
    category: "Billing",
    embedding: null,
  },
  {
    id: 3,
    question: "How do I cancel my subscription?",
    answer:
      "Go to Account Settings > Subscription > Cancel Subscription. Your access continues until the end of the current billing period.",
    category: "Billing",
    embedding: null,
  },
  {
    id: 4,
    question: "What payment methods do you accept?",
    answer:
      "We accept Visa, Mastercard, American Express, PayPal, and Apple Pay. All transactions are securely processed.",
    category: "Billing",
    embedding: null,
  },
  {
    id: 5,
    question: "How do I update my profile information?",
    answer:
      "Go to Account Settings > Profile. You can update your name, email, phone number, and address there.",
    category: "Account",
    embedding: null,
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

async function initializeFAQEmbeddings(): Promise<void> {
  console.log("📚 Initializing FAQ embeddings...");

  for (const faq of FAQ_DATABASE) {
    const { embedding } = await embed({
      model: openai.embedding("text-embedding-ada-002"),
      value: faq.question,
      experimental_telemetry: { isEnabled: true },
    });
    faq.embedding = embedding;
  }

  console.log("✅ FAQ embeddings initialized");
}

// =============================================================================
// Classification Types
// =============================================================================

type QueryCategory = "order_status" | "faq";

interface ClassificationResult {
  category: QueryCategory;
  confidence: string;
  reasoning: string;
}

// =============================================================================
// Agent Response Type (includes span ID for feedback)
// =============================================================================

interface AgentResponse {
  query: string;
  response: string;
  spanId: string;
  category: QueryCategory;
}

// =============================================================================
// The Support Agent
// =============================================================================

async function handleSupportQuery(userQuery: string): Promise<AgentResponse> {
  // Create a parent span for the entire support agent flow
  return tracer.startActiveSpan(
    "support-agent",
    {
      attributes: {
        "openinference.span.kind": "AGENT",
        "input.value": userQuery,
      },
    },
    async (agentSpan) => {
      // Capture the span ID for feedback purposes
      const spanId = agentSpan.spanContext().spanId;
      let category: QueryCategory = "faq";

      try {
        console.log("\n" + "=".repeat(60));
        console.log("🤖 Support Agent Processing Query");
        console.log("=".repeat(60));
        console.log(`📨 Query: "${userQuery}"`);
        console.log(`   Span ID: ${spanId}`);

        // Step 1: Classify the query
        console.log("\n📋 Step 1: Classifying query...");

        const classificationResult = await generateText({
          model: openai.chat("gpt-4o-mini"),
          system: `You are a support query classifier. Classify the user's query into one of these categories:

1. "order_status" - Questions about order tracking, delivery status, shipping, where is my order
2. "faq" - General questions about accounts, billing, refunds, passwords, subscriptions, payment methods

Respond with JSON only:
{
  "category": "order_status" or "faq",
  "confidence": "high" or "medium" or "low",
  "reasoning": "brief explanation"
}`,
          prompt: userQuery,
          experimental_telemetry: { isEnabled: true },
        });

        let classification: ClassificationResult;
        try {
          classification = JSON.parse(classificationResult.text);
        } catch {
          // Default to FAQ if parsing fails
          classification = {
            category: "faq",
            confidence: "low",
            reasoning: "Failed to parse classification",
          };
        }

        console.log(`   Category: ${classification.category}`);
        console.log(`   Confidence: ${classification.confidence}`);
        console.log(`   Reasoning: ${classification.reasoning}`);

        category = classification.category;
        agentSpan.setAttribute("classification.category", classification.category);
        agentSpan.setAttribute("classification.confidence", classification.confidence);

        let response: string;

        // Step 2: Route based on classification
        if (classification.category === "order_status") {
          // Handle order status with tool call
          console.log("\n🔧 Step 2: Deciding whether to use tool...");

          const toolDecision = await generateText({
            model: openai.chat("gpt-4o-mini"),
            system: `You are a helpful customer support agent. When customers ask about order status, use the lookupOrderStatus tool to get the information. If no order ID is mentioned, ask for it politely. Always use the tool when an order ID is provided.`,
            prompt: userQuery,
            tools: {
              lookupOrderStatus: tool({
                description: "Look up the current status of a customer order by order ID",
                inputSchema: z.object({
                  orderId: z.string().describe("The order ID to look up (e.g., ORD-12345)"),
                }),
                execute: async ({ orderId }) => {
                  console.log(`   🔧 Tool called: lookupOrderStatus(${orderId})`);

                  // Simulate API latency
                  await new Promise((resolve) => setTimeout(resolve, 300));

                  const order = orderDatabase[orderId];
                  if (!order) {
                    console.log(`   ❌ Order not found: ${orderId}`);
                    return { error: `Order ${orderId} not found in our system` };
                  }

                  console.log(`   ✅ Order found: ${JSON.stringify(order)}`);
                  return { orderId, ...order };
                },
              }),
            },
            maxSteps: 2, // Allow tool call + stop
            experimental_telemetry: { isEnabled: true },
          });

          // Get the tool result from the steps (AI SDK uses 'output' not 'result')
          let orderInfo: Record<string, unknown> | null = null;
          for (const step of toolDecision.steps || []) {
            if (step.toolResults && step.toolResults.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              orderInfo = (step.toolResults[0] as any).output as Record<string, unknown>;
              break;
            }
          }
          
          if (orderInfo) {
            console.log(`   📦 Order info for response: ${JSON.stringify(orderInfo)}`);
            console.log("\n💬 Step 3: Generating response from tool result...");
            
            const finalResponse = await generateText({
              model: openai.chat("gpt-4o-mini"),
              system: `You are a helpful customer support agent. Summarize order information in a friendly way. Use the exact data provided - do not make up information.`,
              prompt: `Customer asked: "${userQuery}"

Here is the order information I found:
- Order ID: ${orderInfo.orderId}
- Status: ${orderInfo.status}
- Carrier: ${orderInfo.carrier}
- Tracking Number: ${orderInfo.trackingNumber}
- Estimated Arrival: ${orderInfo.eta}

Write a friendly 2-3 sentence response sharing this information with the customer.`,
              experimental_telemetry: { isEnabled: true },
            });
            
            response = finalResponse.text;
          } else {
            // No tool was called (e.g., no order ID provided)
            response = toolDecision.text || "I'd be happy to help you with your order status. Could you please provide your order ID? It should look like ORD-XXXXX.";
          }

        } else {
          // Handle FAQ with RAG
          console.log("\n📚 Step 2: Searching knowledge base (RAG)...");

          // Embed the query
          const { embedding: queryEmbedding } = await embed({
            model: openai.embedding("text-embedding-ada-002"),
            value: userQuery,
            experimental_telemetry: { isEnabled: true },
          });

          // Find relevant FAQs
          const relevantFAQs = FAQ_DATABASE.filter((faq) => faq.embedding !== null)
            .map((faq) => ({
              ...faq,
              score: cosineSimilarity(queryEmbedding, faq.embedding!),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 2);

          console.log("   Found relevant FAQs:");
          relevantFAQs.forEach((faq) => {
            console.log(`   - [${faq.score.toFixed(3)}] ${faq.question}`);
          });

          // Build context
          const ragContext = relevantFAQs
            .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
            .join("\n\n");

          // Generate answer
          console.log("\n💬 Step 3: Generating response...");

          const ragResult = await generateText({
            model: openai.chat("gpt-4o-mini"),
            system: `You are a helpful customer support agent. Answer the user's question using ONLY the information provided in the context below. Be friendly and concise.

Context:
${ragContext}`,
            prompt: userQuery,
            experimental_telemetry: { isEnabled: true },
          });

          response = ragResult.text;
        }

        console.log("\n📤 Response:", response);
        console.log("=".repeat(60));

        agentSpan.setAttribute("output.value", response);
        agentSpan.setStatus({ code: SpanStatusCode.OK });

        return {
          query: userQuery,
          response,
          spanId,
          category,
        };
      } catch (error) {
        agentSpan.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        agentSpan.end();
      }
    }
  );
}

// =============================================================================
// Interactive User Feedback
// =============================================================================

import * as readline from "readline";

/**
 * Prompt for a single character input (y/n)
 */
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

/**
 * Collect interactive feedback from the user for each response.
 * Shows the query and response, then asks for thumbs up/down.
 */
async function collectUserFeedback(responses: AgentResponse[]): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("👍👎 User Feedback Collection");
  console.log("=".repeat(60));
  console.log("\nFor each response, enter:");
  console.log("  'y' or '1' = 👍 thumbs-up (good response)");
  console.log("  'n' or '0' = 👎 thumbs-down (bad response)");
  console.log("  's' = skip (no feedback)");
  console.log("");

  const annotations: Array<{
    spanId: string;
    name: string;
    label: string;
    score: number;
    annotatorKind: "HUMAN";
    metadata: Record<string, unknown>;
  }> = [];

  for (let i = 0; i < responses.length; i++) {
    const resp = responses[i];
    
    console.log("-".repeat(60));
    console.log(`\n📝 Response ${i + 1} of ${responses.length}`);
    console.log(`\n   Query: "${resp.query}"`);
    console.log(`\n   Response: "${resp.response}"`);
    console.log("");

    const answer = await prompt("   Was this response helpful? (y/n/s): ");

    if (answer === "y" || answer === "1" || answer === "yes") {
      console.log("   → 👍 Recorded as thumbs-up\n");
      annotations.push({
        spanId: resp.spanId,
        name: "user_feedback",
        label: "thumbs-up",
        score: 1,
        annotatorKind: "HUMAN",
        metadata: {
          category: resp.category,
          source: "interactive_tutorial",
        },
      });
    } else if (answer === "n" || answer === "0" || answer === "no") {
      console.log("   → 👎 Recorded as thumbs-down\n");
      annotations.push({
        spanId: resp.spanId,
        name: "user_feedback",
        label: "thumbs-down",
        score: 0,
        annotatorKind: "HUMAN",
        metadata: {
          category: resp.category,
          source: "interactive_tutorial",
        },
      });
    } else {
      console.log("   → ⏭️  Skipped\n");
    }
  }

  if (annotations.length > 0) {
    console.log("-".repeat(60));
    console.log("\n📤 Sending feedback to Phoenix...");

    try {
      await logSpanAnnotations({
        spanAnnotations: annotations,
        sync: true,
      });
      console.log(`✅ Logged ${annotations.length} feedback annotations to Phoenix`);
    } catch (error) {
      console.error("❌ Failed to log feedback:", error);
    }
  } else {
    console.log("\n⚠️  No feedback provided - skipping annotation upload");
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("Phoenix Tracing Tutorial - Support Agent with Feedback");
  console.log("=".repeat(60));

  // Initialize FAQ embeddings first
  await initializeFAQEmbeddings();

  // Test queries that exercise different paths
  const queries = [
    // Good queries - should produce helpful responses
    "What's the status of order ORD-12345?",  // → Order Status → Tool Call (order exists)
    "How can I get a refund?",                 // → FAQ → RAG (question in knowledge base)
    "Where is my order ORD-67890?",            // → Order Status → Tool Call (order exists)
    "I forgot my password",                    // → FAQ → RAG (question in knowledge base)
    
    // Bad queries - agent fails to help properly
    "What's the status of order ORD-99999?",   // → Order doesn't exist in database
    "How do I upgrade to a premium plan?",     // → Not in FAQ database, agent can't answer
    "Can you help me with something random?",  // → Vague/unclear request
  ];

  // Collect responses with span IDs
  const responses: AgentResponse[] = [];
  for (const query of queries) {
    const result = await handleSupportQuery(query);
    responses.push(result);
    // Small delay between queries
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Flush traces before adding feedback
  console.log("\n⏳ Flushing traces...");
  await provider.forceFlush();
  console.log("✅ Traces flushed!");

  // Collect interactive user feedback
  await collectUserFeedback(responses);

  console.log("\n" + "=".repeat(60));
  console.log("👀 Open Phoenix UI at http://localhost:6006");
  console.log("");
  console.log("What to look for:");
  console.log("   Each 'support-agent' trace contains:");
  console.log("   1. Classification LLM call (determines routing)");
  console.log("   2. Either:");
  console.log("      - Order Status path:");
  console.log("        • LLM call (decides to use tool)");
  console.log("        • Tool call span (lookupOrderStatus)");
  console.log("        • LLM call (summarizes tool result)");
  console.log("      - FAQ path:");
  console.log("        • Embedding span");
  console.log("        • LLM call (generates answer with context)");
  console.log("");
  console.log("   📊 Check the Annotations tab to see your feedback!");
  console.log("   Filter by 'user_feedback' to see thumbs-up/thumbs-down");
  console.log("=".repeat(60));
}

main().catch(console.error);
