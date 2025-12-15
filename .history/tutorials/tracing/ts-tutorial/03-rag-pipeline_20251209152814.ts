/**
 * Phoenix Tracing Tutorial - Chapter 1.3: Tracing RAG Pipelines
 *
 * This script demonstrates how to trace a RAG (Retrieval-Augmented Generation)
 * pipeline with Phoenix. You'll learn to:
 * - Trace embedding calls
 * - Implement semantic search with traced components
 * - See the full retrieval-to-generation flow
 *
 * Run with: pnpm run 03
 */

// Import instrumentation first - this must be at the top!
import "./instrumentation.js";

import { embed, generateText } from "ai";
import { openai } from "@ai-sdk/openai";

// =============================================================================
// FAQ Database - Our knowledge base
// =============================================================================

interface FAQEntry {
  id: number;
  question: string;
  answer: string;
  embedding: number[] | null;
}

const FAQ_DATABASE: FAQEntry[] = [
  {
    id: 1,
    question: "How do I reset my password?",
    answer:
      "Go to Settings > Security > Reset Password. You'll receive an email with a reset link that expires in 24 hours.",
    embedding: null,
  },
  {
    id: 2,
    question: "What's your refund policy?",
    answer:
      "We offer full refunds within 30 days of purchase for unused items. Contact support with your order number to initiate a refund.",
    embedding: null,
  },
  {
    id: 3,
    question: "How do I track my order?",
    answer:
      "Visit the Order Status page and enter your order ID. You'll see real-time tracking information including carrier and estimated delivery date.",
    embedding: null,
  },
  {
    id: 4,
    question: "How do I cancel my subscription?",
    answer:
      "Go to Account Settings > Subscription > Cancel Subscription. Your access continues until the end of the current billing period.",
    embedding: null,
  },
  {
    id: 5,
    question: "What payment methods do you accept?",
    answer:
      "We accept Visa, Mastercard, American Express, PayPal, and Apple Pay. All transactions are securely processed.",
    embedding: null,
  },
];

// =============================================================================
// Embedding and Search Functions
// =============================================================================

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Initialize FAQ embeddings - this would typically be done once and cached
 */
async function initializeFAQEmbeddings(): Promise<void> {
  console.log("📚 Initializing FAQ embeddings...");

  for (const faq of FAQ_DATABASE) {
    const { embedding } = await embed({
      model: openai.embedding("text-embedding-ada-002"),
      value: faq.question,
      experimental_telemetry: { isEnabled: true },
    });
    faq.embedding = embedding;
    console.log(`   ✓ Embedded FAQ #${faq.id}: "${faq.question.slice(0, 40)}..."`);
  }

  console.log("✅ All FAQ embeddings initialized");
  console.log("");
}

/**
 * Find relevant FAQ entries using semantic search
 */
async function findRelevantFAQs(
  query: string,
  topK: number = 2
): Promise<Array<FAQEntry & { score: number }>> {
  console.log(`🔍 Searching for relevant FAQs...`);

  // Embed the user's query
  const { embedding: queryEmbedding } = await embed({
    model: openai.embedding("text-embedding-ada-002"),
    value: query,
    experimental_telemetry: { isEnabled: true },
  });

  // Calculate similarity scores and rank
  const results = FAQ_DATABASE.filter((faq) => faq.embedding !== null)
    .map((faq) => ({
      ...faq,
      score: cosineSimilarity(queryEmbedding, faq.embedding!),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  console.log(`   Found ${results.length} relevant FAQs:`);
  results.forEach((faq) => {
    console.log(`   - [${faq.score.toFixed(3)}] ${faq.question}`);
  });

  return results;
}

// =============================================================================
// RAG Pipeline
// =============================================================================

/**
 * Answer a question using RAG
 */
async function answerWithContext(userQuery: string): Promise<string> {
  console.log("");
  console.log("=".repeat(40));
  console.log("RAG Pipeline Execution");
  console.log("=".repeat(40));

  // Step 1: Retrieve relevant documents
  const relevantFAQs = await findRelevantFAQs(userQuery, 2);

  // Step 2: Build context from retrieved documents
  const context = relevantFAQs
    .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
    .join("\n\n");

  console.log("");
  console.log("📝 Context built from retrieved FAQs");

  // Step 3: Generate answer using context
  console.log("🤖 Generating answer...");

  const { text } = await generateText({
    model: openai.chat("gpt-4o-mini"),
    system: `You are a helpful customer support agent. Answer the user's question using ONLY the information provided in the context below. If the context doesn't contain relevant information, politely say you don't have information about that topic.

Context:
${context}`,
    prompt: userQuery,
    experimental_telemetry: { isEnabled: true },
  });

  return text;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("Chapter 1.3: Tracing RAG Pipelines");
  console.log("=".repeat(60));
  console.log("");

  // Initialize embeddings (in production, these would be pre-computed)
  await initializeFAQEmbeddings();

  // Test queries
  const queries = [
    "How can I get my money back?",
    "I forgot my password, what should I do?",
  ];

  for (const query of queries) {
    console.log("");
    console.log("=".repeat(60));
    console.log(`📨 User query: "${query}"`);

    const answer = await answerWithContext(query);

    console.log("");
    console.log("📤 Answer:");
    console.log(`   ${answer}`);
    console.log("=".repeat(60));
  }

  console.log("");
  console.log("=".repeat(60));
  console.log("👀 Open Phoenix UI at http://localhost:6006");
  console.log("");
  console.log("What to look for in the traces:");
  console.log("   - Embedding spans for FAQ initialization");
  console.log("   - Query embedding span for each user question");
  console.log("   - LLM generation span with context in system prompt");
  console.log("   - Full pipeline timing from query to answer");
  console.log("");
  console.log("Debugging tips:");
  console.log("   - Check similarity scores in console output");
  console.log("   - Look at the context passed to the LLM");
  console.log("   - Compare latency of embedding vs generation");
  console.log("=".repeat(60));
}

main().catch(console.error);
