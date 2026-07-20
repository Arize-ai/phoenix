/**
 * Mastra Tracing Example
 *
 * A minimal Mastra agent that validates the ESM-only Phoenix packages
 * end to end:
 *
 * 1. Runs a tool-calling Mastra agent whose model is an AI SDK v7 provider
 * 2. Exports the agent trace to Phoenix via @mastra/arize
 * 3. Judges the response with @arizeai/phoenix-evals (which runs on AI SDK v7)
 */

import { openai } from "@ai-sdk/openai";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";

import { mastra } from "./mastra.js";

const helpfulnessEvaluator = createClassificationEvaluator({
  name: "helpfulness",
  model: openai("gpt-4o-mini"),
  choices: {
    helpful: 1,
    unhelpful: 0,
  },
  promptTemplate: `You are evaluating whether an assistant's response is helpful for the user's request.

A response is HELPFUL if it directly answers the request with accurate, relevant information.
A response is UNHELPFUL if it is off-topic, incomplete, or does not address the request.

[Request]: {{input}}
[Response]: {{output}}

Is the response helpful or unhelpful?
`,
});

async function main() {
  const prompt = "What's the weather like in Tokyo right now?";

  console.log(`\n🤖 Asking: ${prompt}\n`);

  const agent = mastra.getAgent("weatherAgent");
  const result = await agent.generate(prompt);

  console.log(`💬 Response: ${result.text}\n`);

  const evaluation = await helpfulnessEvaluator.evaluate({
    input: prompt,
    output: result.text,
  });

  console.log(
    `📊 Helpfulness: ${evaluation.label} (score: ${evaluation.score})`
  );
  if (evaluation.explanation) {
    console.log(`   ${evaluation.explanation}`);
  }

  // Flush pending trace exports before the process exits
  await mastra.shutdown();
  console.log("\n✅ Done - view the trace at http://localhost:6006");
}

main().catch((error) => {
  console.error("❌ Example failed:", error);
  process.exit(1);
});
