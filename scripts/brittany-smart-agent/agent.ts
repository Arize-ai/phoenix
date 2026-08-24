/**
 * Minimal traced agent.
 *
 * Importing ./instrumentation.js registers Phoenix tracing before any LLM call
 * runs, so the whole tool loop lands in Phoenix as one trace: the agent span,
 * each LLM step, and the tool call.
 */

import { anthropic } from "@ai-sdk/anthropic";
import { stepCountIs, tool, ToolLoopAgent } from "ai";
import { z } from "zod";

// Importing this module registers Phoenix tracing before any LLM calls run
import { projectName, provider } from "./instrumentation.js";

const UNIT_NAMES = ["m", "km", "cm", "mi", "ft", "kg", "g", "lb", "oz"] as const;

type UnitName = (typeof UNIT_NAMES)[number];

// Each unit records how many metres or kilograms it's worth, so converting is
// one multiply and one divide. It's all arithmetic, so there's no network call
// and the same question gives the same trace every time.
const UNITS: Record<UnitName, { dimension: string; perBase: number }> = {
  m: { dimension: "length", perBase: 1 },
  km: { dimension: "length", perBase: 1000 },
  cm: { dimension: "length", perBase: 0.01 },
  mi: { dimension: "length", perBase: 1609.344 },
  ft: { dimension: "length", perBase: 0.3048 },
  kg: { dimension: "mass", perBase: 1 },
  g: { dimension: "mass", perBase: 0.001 },
  lb: { dimension: "mass", perBase: 0.45359237 },
  oz: { dimension: "mass", perBase: 0.028349523125 },
};

const agent = new ToolLoopAgent({
  model: anthropic("claude-haiku-4-5"),
  instructions:
    "You are a concise unit conversion assistant. Use the convertUnits tool to answer conversion questions, and report the number it returns.",
  tools: {
    convertUnits: tool({
      description: "Convert a value between two units of length or mass",
      inputSchema: z.object({
        value: z.number().describe("The quantity to convert"),
        from: z.enum(UNIT_NAMES).describe("The unit to convert from"),
        to: z.enum(UNIT_NAMES).describe("The unit to convert to"),
      }),
      execute: async ({ value, from, to }) => {
        const source = UNITS[from];
        const target = UNITS[to];
        // Length and mass share one table, so the model can ask for something
        // like kilometers to pounds. Say so instead of returning a number that
        // looks fine.
        if (source.dimension !== target.dimension) {
          return {
            error: `Cannot convert ${from} (${source.dimension}) to ${to} (${target.dimension}).`,
          };
        }
        return {
          value,
          from,
          to,
          result: (value * source.perBase) / target.perBase,
        };
      },
    }),
  },
  stopWhen: stepCountIs(3),
});

const prompt = "How many feet are in 2.5 kilometers?";
console.log(`\nAsking: ${prompt}\n`);

const result = await agent.generate({ prompt });

console.log(`Response: ${result.text}`);

// Flush the trace before the process exits
await provider.shutdown();

// This route looks the project up by name, so the link works without knowing
// its id
const phoenixBaseUrl =
  process.env.PHOENIX_COLLECTOR_ENDPOINT ?? "http://localhost:6006";
const projectUrl = new URL(
  `redirects/projects/${encodeURIComponent(projectName)}`,
  phoenixBaseUrl.endsWith("/") ? phoenixBaseUrl : `${phoenixBaseUrl}/`
);
console.log(`\nDone. View the trace at ${projectUrl}`);
