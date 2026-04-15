/**
 * Documentation eval
 *
 * Runs a small experiment to check whether the agent's system prompt,
 * combined with the Phoenix Mintlify docs MCP server, produces responses
 * that include properly structured markdown links.
 */
import { anthropic } from "@ai-sdk/anthropic";
import { createMCPClient } from "@ai-sdk/mcp";
import { createClient } from "@arizeai/phoenix-client";
import { createOrGetDataset } from "@arizeai/phoenix-client/datasets";
import { runExperiment } from "@arizeai/phoenix-client/experiments";
import { generateText, stepCountIs, type ToolSet } from "ai";

import { AGENT_SYSTEM_PROMPT } from "@phoenix/agent/chat/systemPrompt";

import { linkQualityEvaluator } from "./evaluators/linkQualityEvaluator";

const DATASET_NAME = "phoenix-documentation-questions";
const MINTLIFY_MCP_URL = "https://arizeai-433a7140.mintlify.app/mcp";

const QUESTIONS = [
  { question: "How do I install Phoenix locally?" },
  { question: "How do I trace an OpenAI application with Phoenix?" },
  { question: "How do I create a dataset in Phoenix from existing traces?" },
  { question: "How do I run an experiment with Phoenix evaluators?" },
  { question: "How do I configure Phoenix authentication?" },
];

const client = createClient();

async function main() {
  await createOrGetDataset({
    client,
    name: DATASET_NAME,
    description: "Phoenix documentation questions",
    examples: QUESTIONS.map((input) => ({ input })),
  });

  const mcp = await createMCPClient({
    transport: { type: "http", url: MINTLIFY_MCP_URL },
  });
  const tools = await mcp.tools();

  try {
    await runExperiment({
      client,
      experimentName: "docs-system-prompt-link-structure",
      experimentDescription:
        "Checks that the agent system prompt with Mintlify MCP produces well-structured markdown links pointing at the public Phoenix docs.",
      dataset: { datasetName: DATASET_NAME },
      task: async (example) => {
        const { question } = example.input as { question: string };
        const { text } = await generateText({
          model: anthropic("claude-haiku-4-5-20251001"),
          system: AGENT_SYSTEM_PROMPT,
          prompt: question,
          tools: tools as unknown as ToolSet,
          stopWhen: stepCountIs(10),
        });
        return text;
      },
      evaluators: [linkQualityEvaluator],
    });
  } finally {
    await mcp.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
