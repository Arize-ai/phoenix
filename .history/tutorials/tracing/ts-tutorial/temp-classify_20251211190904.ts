// Import instrumentation first - this must be at the top to enable tracing
import { provider } from "./instrumentation.js";

import { cosineSimilarity, embed, generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { trace, SpanStatusCode } from "@opentelemetry/api";

// Create a tracer instance - this is what we use to create custom spans
const tracer = trace.getTracer("support-agent");

// FAQ database (embeddings computed on-the-fly)
const FAQ_DATABASE = [
  { question: "How do I reset my password?", answer: "Go to Settings > Security > Reset Password..." },
  { question: "What's your refund policy?", answer: "Full refunds within 30 days for unused items..." },
  { question: "How do I cancel my subscription?", answer: "Go to Account Settings > Subscription..." },
];

async function handleFAQQuery(userQuery: string) {
  // KEY: Wrap everything in a parent span so all RAG operations appear under ONE trace
  return tracer.startActiveSpan(
    "rag-pipeline",
    { attributes: { "openinference.span.kind": "CHAIN", "input.value": userQuery } },
    async (span) => {
      try {
        // Step 1: Embed all FAQ questions
        const faqEmbeddings = await Promise.all(
          FAQ_DATABASE.map(async (faq) => {
            const { embedding } = await embed({
              model: openai.embedding("text-embedding-ada-002"),
              value: faq.question,
              experimental_telemetry: { isEnabled: true },
            });
            return { ...faq, embedding };
          })
        );

        // Step 2: Embed the user's query
        const { embedding: queryEmbedding } = await embed({
          model: openai.embedding("text-embedding-ada-002"),
          value: userQuery,
          experimental_telemetry: { isEnabled: true },
        });

        // Step 3: Find relevant FAQs (semantic search)
        const relevantFAQs = faqEmbeddings
          .map((faq) => ({ ...faq, score: cosineSimilarity(queryEmbedding, faq.embedding) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 2);

        // Step 4: Generate answer with context
        const context = relevantFAQs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");

        const { text } = await generateText({
          model: openai.chat("gpt-4o-mini"),
          system: `Answer using ONLY this context:\n\n${context}`,
          prompt: userQuery,
          experimental_telemetry: { isEnabled: true },
        });

        span.setAttribute("output.value", text);
        span.setStatus({ code: SpanStatusCode.OK });
        return text;
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
  const response = await handleFAQQuery("How do I reset my password?");
  console.log(response);
  
  await provider.forceFlush();
}

main();
