import { provider } from "./instrumentation.js";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

async function classifyQuery(userQuery: string) {
  const result = await generateText({
    model: openai.chat("gpt-4o-mini"),
    system: `Classify the user's query into one of these categories:
1. "order_status" - Questions about order tracking, delivery, shipping
2. "faq" - General questions about accounts, billing, refunds, passwords

Respond with JSON: { "category": "order_status" or "faq", "confidence": "high/medium/low" }`,
    prompt: userQuery,
    experimental_telemetry: { isEnabled: true },
  });
  return JSON.parse(result.text);
}

async function main() {
  const classification = await classifyQuery("Where is my order ORD-12345?");
  console.log(classification);
  await provider.forceFlush();
}

main();
