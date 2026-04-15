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
import {
  asExperimentEvaluator,
  runExperiment,
} from "@arizeai/phoenix-client/experiments";
import { generateText, stepCountIs, type ToolSet } from "ai";

import { AGENT_SYSTEM_PROMPT } from "@phoenix/agent/chat/systemPrompt";

const DATASET_NAME = "phoenix-documentation-questions";
const MINTLIFY_MCP_URL = "https://arizeai-433a7140.mintlify.app/mcp";

const QUESTIONS = [
  { question: "How do I install Phoenix locally?" },
  { question: "How do I trace an OpenAI application with Phoenix?" },
  { question: "How do I create a dataset in Phoenix from existing traces?" },
  { question: "How do I run an experiment with Phoenix evaluators?" },
  { question: "How do I configure Phoenix authentication?" },
];

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const RELATIVE_MARKDOWN_LINK_RE = /\[([^\]]+)\]\((\/[^\s)]+)\)/g;
const BARE_URL_RE = /(?<!\]\()https?:\/\/[^\s)]+/g;
const ALLOWED_ABSOLUTE_PREFIXES = [
  "https://arize.com/docs/phoenix",
  "http://localhost:6006",
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
      evaluators: [
        asExperimentEvaluator({
          name: "link-quality",
          kind: "CODE",
          evaluate: ({ output }) => {
            const text = typeof output === "string" ? output : "";
            const absoluteMarkdown = [...text.matchAll(MARKDOWN_LINK_RE)].map(
              (m) => m[2],
            );
            const relativeMarkdown = [
              ...text.matchAll(RELATIVE_MARKDOWN_LINK_RE),
            ].map((m) => m[2]);
            const bareUrls = text.match(BARE_URL_RE) ?? [];
            const absoluteUrls = [...absoluteMarkdown, ...bareUrls];

            if (absoluteUrls.length === 0 && relativeMarkdown.length === 0) {
              return {
                score: 0,
                label: "no-links",
                explanation: "response contained no links",
              };
            }
            if (absoluteUrls.length === 0) {
              return {
                score: 0,
                label: "relative-only",
                explanation: `all ${relativeMarkdown.length} links are relative: ${relativeMarkdown.slice(0, 3).join(", ")}`,
              };
            }
            if (bareUrls.length > 0 && absoluteMarkdown.length === 0) {
              return {
                score: 0,
                label: "bare-url",
                explanation: `${bareUrls.length} bare URL(s), no markdown links`,
              };
            }
            const offenders = absoluteUrls.filter(
              (url) =>
                !ALLOWED_ABSOLUTE_PREFIXES.some((prefix) =>
                  url.startsWith(prefix),
                ),
            );
            if (offenders.length > 0) {
              return {
                score: 0,
                label: "wrong-prefix",
                explanation: `${offenders.length}/${absoluteUrls.length} urls outside allowed prefixes: ${offenders.slice(0, 3).join(", ")}`,
              };
            }
            return {
              score: 1,
              label: "valid",
              explanation: `absolute=${absoluteMarkdown.length} bare=${bareUrls.length} relative=${relativeMarkdown.length}`,
            };
          },
        }),
      ],
    });
  } finally {
    await mcp.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
