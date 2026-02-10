import "dotenv/config";
import { register } from "@arizeai/phoenix-otel";
import { LangChainInstrumentation } from "@arizeai/openinference-instrumentation-langchain";
import * as CallbackManagerModule from "@langchain/core/callbacks/manager";

const provider = register({
  projectName: "langchain-travel-agent",
});

const lcInstrumentation = new LangChainInstrumentation();
lcInstrumentation.manuallyInstrument(CallbackManagerModule);

import { createAgent } from "langchain";
import { travelTools } from "./tools";

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Error: OPENAI_API_KEY environment variable is not set");
    process.exit(1);
  }

  if (!process.env.TAVILY_API_KEY) {
    console.error("❌ Error: TAVILY_API_KEY environment variable is not set");
    process.exit(1);
  }

  const agent = createAgent({
    model: "openai:gpt-3.5-turbo",
    systemPrompt: `You are a travel planner. You must produce a trip plan that includes exactly three sections, each backed by a tool call.

RULES:
1. You MUST call all three tools for every trip plan: essential_info, budget_basics, and local_flavor. Call them with the user's destination, duration, and interests—do not guess or substitute.
2. Use only information returned by the tools. Do not invent facts, prices, or recommendations.
3. Structure your reply strictly as: (a) Essentials — weather, best time to visit, key attractions, etiquette; (b) Budget — cost breakdown for the given duration; (c) Local flavor — experiences matching the user's stated interests.
4. Keep the total response under 800 words. Be concise and professional; no filler or unsupported claims.`,
    tools: travelTools,
  });

  const queries: Array<{
    destination: string;
    duration: string;
    interests: string;
  }> = [
    { destination: "Ireland", duration: "5 days", interests: "food, culture" },
    { destination: "Japan", duration: "7 days", interests: "temples, cuisine" },
    { destination: "Portugal", duration: "3 days", interests: "beaches, wine" },
  ];

  for (let i = 0; i < queries.length; i++) {
    const { destination, duration, interests } = queries[i];
    const query = `
Plan a ${duration} trip to ${destination}.
Focus on ${interests}.
Include essential info, budget breakdown, and local experiences.
`;
    console.log(
      `\n--- Query ${i + 1}/${queries.length}: ${duration} in ${destination} ---\n`,
    );
    try {
      const response = await agent.invoke({
        messages: [{ role: "user", content: query }],
      });
      const lastMessage = response.messages[response.messages.length - 1];
      console.log(lastMessage.content);
    } catch (error) {
      console.error(`❌ Error on query ${i + 1}: ${error}\n`);
    }
  }

  await provider.forceFlush();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
