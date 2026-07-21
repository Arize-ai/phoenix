/**
 * The smallest traced AI SDK call: importing ./instrumentation.js registers
 * Phoenix telemetry, so the generateText call below shows up as a trace in
 * Phoenix.
 */

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

// Importing this module registers Phoenix tracing before any LLM calls run
import { provider } from "./instrumentation.js";

const { text } = await generateText({
  model: openai("gpt-4o-mini"),
  prompt: "Why is the sky blue? Answer in one sentence.",
});

console.log(text);

// Flush the trace before the process exits
await provider.shutdown();
