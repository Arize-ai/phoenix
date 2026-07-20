/**
 * Minimal agent example
 *
 * The smallest traced agent: importing ./instrumentation.js registers Phoenix
 * telemetry, so the agent's tool-loop run below is traced end to end — the
 * agent span, each LLM step, and the tool call all land in Phoenix.
 */

import { openai } from "@ai-sdk/openai";
import { stepCountIs, tool, ToolLoopAgent } from "ai";
import { z } from "zod";

// Importing this module registers Phoenix tracing before any LLM calls run
import { provider } from "./instrumentation.js";

const agent = new ToolLoopAgent({
  model: openai("gpt-4o-mini"),
  instructions:
    "You are a concise weather assistant. Use the getWeather tool to answer weather questions.",
  tools: {
    getWeather: tool({
      description: "Get the current weather for a city",
      inputSchema: z.object({
        city: z.string().describe("The city to look up"),
      }),
      // Canned data keeps the example deterministic and offline-friendly
      execute: async ({ city }) => ({
        city,
        temperatureCelsius: 22,
        conditions: "partly cloudy",
      }),
    }),
  },
  stopWhen: stepCountIs(3),
});

const prompt = "What's the weather like in Tokyo right now?";
console.log(`\n🤖 Asking: ${prompt}\n`);

const result = await agent.generate({ prompt });

console.log(`💬 Response: ${result.text}`);

// Flush the trace before the process exits
await provider.shutdown();
console.log("\n✅ Done - view the trace at http://localhost:6006");
