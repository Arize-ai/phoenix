/* eslint-disable no-console */
// Import instrumentation first to ensure tracing is initialized
import "./instrumentation";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

async function main() {
  console.log("CLI Agent Starter Kit - Calling Anthropic API...\n");

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is not set");
    process.exit(1);
  }

  try {
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt:
        "Say hello and introduce yourself as a CLI agent in one sentence.",
      experimental_telemetry: { isEnabled: true },
    });

    console.log("Response from Claude:");
    console.log(text);
  } catch (error) {
    console.error("Error calling Anthropic API:", error);
    process.exit(1);
  }
}

main();
