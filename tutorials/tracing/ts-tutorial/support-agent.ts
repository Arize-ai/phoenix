/**
 * Phoenix Tracing Tutorial - Support Agent
 *
 * A complete support agent that demonstrates all three tracing patterns:
 * - LLM calls (query classification)
 * - Tool calls (order status lookup)
 * - RAG pipeline (FAQ search + generation)
 *
 * Also demonstrates:
 * - Session tracking for multi-turn conversations
 * - Conversation history for context-aware responses
 *
 * All operations are traced under a single parent span.
 * After generating responses, prompts for interactive user feedback
 * (thumbs up/down) which is sent to Phoenix as annotations.
 *
 * Run with: pnpm start
 * Run multi-turn demo with: pnpm start -- --sessions
 */

// Import instrumentation first - this must be at the top!
import { provider } from "./instrumentation.js";

import { embed, generateText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { trace, SpanStatusCode, context } from "@arizeai/phoenix-otel";
import { z } from "zod";
import { logSpanAnnotations } from "@arizeai/phoenix-client/spans";
import { setSession } from "@arizeai/openinference-core";
import { SemanticConventions } from "@arizeai/openinference-semantic-conventions";

// Get a tracer for creating custom spans
const tracer = trace.getTracer("support-agent");

// =============================================================================
// Message Types (for conversation history)
// =============================================================================

interface Message {
  role: "user" | "assistant";
  content: string;
}

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
  sessionId?: string;
}

// =============================================================================
// Session Context (tracks order IDs mentioned in conversation)
// =============================================================================

interface SessionContext {
  lastMentionedOrderId?: string;
  turnCount: number;
}

// =============================================================================
// The Support Agent
// =============================================================================

/**
 * Handle a support query with optional session tracking.
 * 
 * @param userQuery - The user's question
 * @param sessionId - Optional session ID for multi-turn conversations
 * @param conversationHistory - Previous messages in the conversation
 * @param sessionContext - Context from previous turns (e.g., remembered order IDs)
 */
async function handleSupportQuery(
  userQuery: string,
  sessionId?: string,
  conversationHistory: Message[] = [],
  sessionContext: SessionContext = { turnCount: 0 }
): Promise<AgentResponse> {
  // The inner function that does the actual work
  const runAgent = async (): Promise<AgentResponse> => {
    return tracer.startActiveSpan(
      "support-agent",
      {
        attributes: {
          "openinference.span.kind": "AGENT",
          "input.value": userQuery,
          // Add session ID if provided
          ...(sessionId && { [SemanticConventions.SESSION_ID]: sessionId }),
          "conversation.turn": sessionContext.turnCount + 1,
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
          if (sessionId) {
            console.log(`   Session ID: ${sessionId}`);
            console.log(`   Turn: ${sessionContext.turnCount + 1}`);
          }

          // Build conversation context for multi-turn support
          const conversationContext = conversationHistory.length > 0
            ? `\n\nPrevious conversation:\n${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}`
            : '';
          
          // Check if we have a remembered order ID from previous turns
          const rememberedOrderInfo = sessionContext.lastMentionedOrderId
            ? `\nNote: The customer previously mentioned order ${sessionContext.lastMentionedOrderId}.`
            : '';

          // Step 1: Classify the query
          console.log("\n📋 Step 1: Classifying query...");

          const classificationResult = await generateText({
            model: openai.chat("gpt-4o-mini"),
            system: `You are a support query classifier. Classify the user's query into one of these categories:

1. "order_status" - Questions about order tracking, delivery status, shipping, where is my order, tracking numbers, ETAs
2. "faq" - General questions about accounts, billing, refunds, passwords, subscriptions, payment methods
${rememberedOrderInfo}
Respond with JSON only:
{
  "category": "order_status" or "faq",
  "confidence": "high" or "medium" or "low",
  "reasoning": "brief explanation"
}`,
            prompt: userQuery + conversationContext,
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

            // Build prompt with conversation context for follow-up questions
            const orderPrompt = sessionContext.lastMentionedOrderId
              ? `${userQuery}\n\nNote: Earlier in this conversation, the customer mentioned order ${sessionContext.lastMentionedOrderId}. If they're asking about "that order" or similar, use this order ID.`
              : userQuery;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toolDecision = await generateText({
              model: openai.chat("gpt-4o-mini"),
              system: `You are a helpful customer support agent. When customers ask about order status, use the lookupOrderStatus tool to get the information. If no order ID is mentioned and none was mentioned earlier, ask for it politely. Always use the tool when an order ID is provided or referenced.`,
              prompt: orderPrompt,
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
            } as Parameters<typeof generateText>[0]);

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
            sessionId,
          };
        } catch (error) {
          agentSpan.setStatus({ code: SpanStatusCode.ERROR });
          throw error;
        } finally {
          agentSpan.end();
        }
      }
    );
  };

  // If we have a session ID, propagate it to all child spans
  if (sessionId) {
    return context.with(
      setSession(context.active(), { sessionId }),
      runAgent
    );
  }
  
  // No session - run without session context propagation
  return runAgent();
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
        sync: false,  // async mode - Phoenix processes in background
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
// Multi-Turn Conversation Demo (Sessions)
// =============================================================================

interface ConversationTurn {
  userMessage: string;
  expectedBehavior: string;
}

interface ConversationScenario {
  name: string;
  description: string;
  turns: ConversationTurn[];
}

/**
 * Run a multi-turn conversation with session tracking.
 * Each conversation gets a unique session ID, and all turns are linked together.
 */
async function runMultiTurnConversation(
  scenario: ConversationScenario
): Promise<{ sessionId: string; responses: AgentResponse[] }> {
  const sessionId = crypto.randomUUID();
  const responses: AgentResponse[] = [];
  const conversationHistory: Message[] = [];
  const sessionContext: SessionContext = { turnCount: 0 };

  console.log("\n" + "=".repeat(60));
  console.log(`🗣️  Conversation: ${scenario.name}`);
  console.log(`📝 ${scenario.description}`);
  console.log(`🔑 Session ID: ${sessionId}`);
  console.log("=".repeat(60));

  for (const turn of scenario.turns) {
    console.log(`\n💬 Turn ${sessionContext.turnCount + 1}: "${turn.userMessage}"`);
    console.log(`   Expected: ${turn.expectedBehavior}`);

    // Run the agent with session context
    const result = await handleSupportQuery(
      turn.userMessage,
      sessionId,
      conversationHistory,
      sessionContext
    );

    responses.push(result);

    // Update conversation history for next turn
    conversationHistory.push({ role: "user", content: turn.userMessage });
    conversationHistory.push({ role: "assistant", content: result.response });

    // Update session context - extract order ID if mentioned
    const orderIdMatch = turn.userMessage.match(/ORD-\d+/i) || result.response.match(/ORD-\d+/i);
    if (orderIdMatch) {
      sessionContext.lastMentionedOrderId = orderIdMatch[0].toUpperCase();
    }
    sessionContext.turnCount++;

    // Small delay between turns
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("\n" + "-".repeat(60));
  console.log(`✅ Conversation complete: ${scenario.turns.length} turns`);
  console.log("-".repeat(60));

  return { sessionId, responses };
}

/**
 * Run the multi-turn sessions demo with several conversation scenarios.
 */
async function runSessionsDemo(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Phoenix Tracing Tutorial - Sessions Demo");
  console.log("=".repeat(60));
  console.log("\nThis demo shows multi-turn conversations tracked as sessions.");
  console.log("Each conversation has a unique session ID that links all turns together.");
  console.log("View them in Phoenix UI under the 'Sessions' tab.\n");

  // Initialize FAQ embeddings first
  await initializeFAQEmbeddings();

  // Define conversation scenarios
  const scenarios: ConversationScenario[] = [
    {
      name: "Order Inquiry - Successful Resolution",
      description: "Customer asks about order, gets status, asks follow-up",
      turns: [
        {
          userMessage: "What's the status of order ORD-12345?",
          expectedBehavior: "Tool call → Returns shipped status",
        },
        {
          userMessage: "When will it arrive?",
          expectedBehavior: "Agent remembers order → Provides ETA from previous lookup",
        },
        {
          userMessage: "What's the tracking number?",
          expectedBehavior: "Agent remembers order → Provides tracking number",
        },
      ],
    },
    {
      name: "FAQ Conversation",
      description: "Customer asks multiple FAQ questions in one session",
      turns: [
        {
          userMessage: "How do I reset my password?",
          expectedBehavior: "RAG → Password reset instructions",
        },
        {
          userMessage: "And what about refunds?",
          expectedBehavior: "RAG → Refund policy info",
        },
      ],
    },
    {
      name: "Mixed Conversation - Context Test",
      description: "Customer switches between order and FAQ topics",
      turns: [
        {
          userMessage: "Check my order ORD-67890",
          expectedBehavior: "Tool call → Processing status",
        },
        {
          userMessage: "How do I cancel my subscription?",
          expectedBehavior: "RAG → Cancellation instructions (different topic)",
        },
        {
          userMessage: "Back to my order - what's the carrier?",
          expectedBehavior: "Agent should remember ORD-67890 from earlier",
        },
      ],
    },
  ];

  // Run all conversation scenarios
  const allResponses: AgentResponse[] = [];
  const sessionIds: string[] = [];

  for (const scenario of scenarios) {
    const result = await runMultiTurnConversation(scenario);
    allResponses.push(...result.responses);
    sessionIds.push(result.sessionId);
  }

  // Flush traces
  console.log("\n⏳ Flushing traces...");
  await provider.forceFlush();
  console.log("✅ Traces flushed!");

  // Collect feedback
  await collectUserFeedback(allResponses);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Sessions Summary");
  console.log("=".repeat(60));
  console.log(`\n   Conversations: ${scenarios.length}`);
  console.log(`   Total turns: ${allResponses.length}`);
  console.log("\n   Session IDs:");
  sessionIds.forEach((id, i) => {
    console.log(`   ${i + 1}. ${id} (${scenarios[i].name})`);
  });
  console.log("\n" + "=".repeat(60));
  console.log("👀 Open Phoenix UI at http://localhost:6006");
  console.log("");
  console.log("What to look for:");
  console.log("   1. Click the 'Sessions' tab in your project");
  console.log("   2. You'll see each conversation as a separate session");
  console.log("   3. Click into a session to see the chatbot-like history");
  console.log("   4. Notice how all turns share the same session ID");
  console.log("   5. Check token usage and latency across the conversation");
  console.log("=".repeat(60));
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  // Check for --sessions flag to run multi-turn demo
  const runSessions = process.argv.includes("--sessions");

  if (runSessions) {
    await runSessionsDemo();
    return;
  }

  // Default: run single-turn demo
  console.log("=".repeat(60));
  console.log("Phoenix Tracing Tutorial - Support Agent with Feedback");
  console.log("=".repeat(60));
  console.log("\n💡 Tip: Run with --sessions flag for multi-turn conversation demo");
  console.log("   Example: pnpm start -- --sessions\n");

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
