// Import instrumentation first - this must be at the top to enable tracing
import { provider } from "./instrumentation.js";

import { cosineSimilarity, embed, generateText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { z } from "zod";

// Create a tracer instance - this is what we use to create custom spans
const tracer = trace.getTracer("support-agent");

// Simulated order database (in a real app, this would be a database call)
// FAQ database with embeddings
const FAQ_DATABASE = [
  { question: "How do I reset my password?", answer: "Go to Settings > Security > Reset Password..." },
  { question: "What's your refund policy?", answer: "Full refunds within 30 days for unused items..." },
  { question: "How do I cancel my subscription?", answer: "Go to Account Settings > Subscription..." },
];

// Pre-compute embeddings for FAQs (do this once at startup)
async function initializeFAQEmbeddings() {
  for (const faq of FAQ_DATABASE) {
    const { embedding } = await embed({
      model: openai.embedding("text-embedding-ada-002"),
      value: faq.question,
      experimental_telemetry: { isEnabled: true },
    });
    faq.embedding = embedding;
  }
}

async function handleFAQQuery(userQuery: string) {
  // Step 1: Embed the user's query
  const { embedding: queryEmbedding } = await embed({
    model: openai.embedding("text-embedding-ada-002"),
    value: userQuery,
    experimental_telemetry: { isEnabled: true },
  });

  // Step 2: Find relevant FAQs (semantic search)
  const relevantFAQs = FAQ_DATABASE
    .map((faq) => ({ ...faq, score: cosineSimilarity(queryEmbedding, faq.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  // Step 3: Generate answer with context
  const context = relevantFAQs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");

  const { text } = await generateText({
    model: openai.chat("gpt-4o-mini"),
    system: `Answer using ONLY this context:\n\n${context}`,
    prompt: userQuery,
    experimental_telemetry: { isEnabled: true },
  });

  return text;
}


async function main() {
  const response = await handleFAQQuery("How do I reset my password?");
  console.log(response);
}

main();
