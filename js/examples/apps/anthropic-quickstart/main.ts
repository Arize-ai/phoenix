/**
 * Anthropic SDK Quickstart
 *
 * A minimal app built on the raw Anthropic SDK that validates the ESM-only
 * Phoenix packages end to end:
 *
 * 1. Traces a messages.create call to Phoenix via manual ESM instrumentation
 * 2. Judges the response with @arizeai/phoenix-evals (which runs on AI SDK v7)
 */

import { anthropic as anthropicJudge } from "@ai-sdk/anthropic";
import Anthropic from "@anthropic-ai/sdk";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";

// Importing this module registers Phoenix tracing before any LLM calls run
import { provider } from "./instrumentation.js";

const client = new Anthropic();

const correctnessEvaluator = createClassificationEvaluator({
  name: "correctness",
  model: anthropicJudge("claude-haiku-4-5"),
  choices: {
    correct: 1,
    incorrect: 0,
  },
  promptTemplate: `You are evaluating whether an assistant's answer to a question is factually correct.

An answer is CORRECT if the facts it states are accurate and it addresses the question.
An answer is INCORRECT if it contains factual errors or fails to answer the question.

[Question]: {{input}}
[Answer]: {{output}}

Is the answer correct or incorrect?
`,
});

async function main() {
  const question = "In one sentence, what does OpenTelemetry do?";

  console.log(`\n🤖 Asking: ${question}\n`);

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: question }],
  });

  const answer = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  console.log(`💬 Response: ${answer}\n`);

  const evaluation = await correctnessEvaluator.evaluate({
    input: question,
    output: answer,
  });

  console.log(
    `📊 Correctness: ${evaluation.label} (score: ${evaluation.score})`
  );
  if (evaluation.explanation) {
    console.log(`   ${evaluation.explanation}`);
  }

  await provider.shutdown();
  console.log("\n✅ Done - view the trace at http://localhost:6006");
}

main().catch((error) => {
  console.error("❌ Example failed:", error);
  process.exit(1);
});
