/**
 * AI SDK v7 Quickstart
 *
 * A minimal agent built on the Vercel AI SDK v7 that validates the
 * ESM-only Phoenix packages end to end:
 *
 * 1. Traces a tool-calling generateText run to Phoenix via @arizeai/phoenix-otel
 * 2. Judges the response with @arizeai/phoenix-evals (which runs on AI SDK v7)
 */

import { openai } from "@ai-sdk/openai";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

// Importing this module registers Phoenix tracing before any LLM calls run
import { projectName, provider } from "./instrumentation.js";

const weatherTool = tool({
  description: "Get the current weather for a city",
  inputSchema: z.object({
    city: z.string().describe("The city to look up"),
  }),
  execute: async ({ city }) => {
    // Canned data keeps the example deterministic and offline-friendly
    return {
      city,
      temperatureCelsius: 22,
      conditions: "partly cloudy",
    };
  },
});

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

  const result = await generateText({
    model: openai("gpt-4o-mini"),
    prompt,
    tools: {
      getWeather: weatherTool,
    },
    stopWhen: stepCountIs(3),
  });

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

  await provider.shutdown();

  // The redirect route resolves the project by name, so the link works
  // without knowing the project id
  const phoenixBaseUrl =
    process.env.PHOENIX_COLLECTOR_ENDPOINT ?? "http://localhost:6006";
  const projectUrl = new URL(
    `redirects/projects/${encodeURIComponent(projectName)}`,
    phoenixBaseUrl.endsWith("/") ? phoenixBaseUrl : `${phoenixBaseUrl}/`
  );
  console.log(`\n✅ Done - view the trace at ${projectUrl}`);
}

main().catch((error) => {
  console.error("❌ Example failed:", error);
  process.exit(1);
});
