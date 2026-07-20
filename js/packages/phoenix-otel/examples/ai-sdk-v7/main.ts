import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

import { provider } from "./instrumentation.ts";

// Once the integration is registered, AI SDK calls are traced without
// per-call configuration.
const { text } = await generateText({
  model: openai("gpt-4o-mini"),
  prompt: "Explain the theory of relativity in simple terms.",
});

// eslint-disable-next-line no-console
console.log(text);

// Flush pending traces before the process exits
await provider.forceFlush();
