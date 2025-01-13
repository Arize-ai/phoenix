/* eslint-disable no-console */
import "./instrumentation.ts";
import { createClient } from "@arizeai/phoenix-client";
import {
  optimizePrompt,
  type OptimizePromptParams,
  type OptimizePromptTask,
} from "@arizeai/phoenix-client/prompts";
import { asEvaluator } from "@arizeai/phoenix-client/experiments";
import OpenAI from "openai";
import { z } from "zod";
import { runner } from "./runner.js";

const env = z
  .object({
    OPENAI_MODEL: z.string().default("llama3.2"),
    OPENAI_API_KEY: z.string().default("ollama"),
    OPENAI_API_BASE_URL: z.string().default("http://localhost:11434/v1"),
  })
  .parse(process.env);

const config: {
  model: string;
  openAiApiKey: string;
  openAiBaseUrl: string;
} = {
  model: env.OPENAI_MODEL,
  openAiApiKey: env.OPENAI_API_KEY,
  openAiBaseUrl: env.OPENAI_API_BASE_URL,
};

const openai = new OpenAI({
  baseURL: config.openAiBaseUrl,
  apiKey: config.openAiApiKey,
});

// baseUrl defaults to http://localhost:6006
const phoenix = createClient();

const main = async () => {
  // TODO: This should come from Phoenix api
  const initialPrompt = { content: "You are a helpful assistant." };

  // This Task should only answer questions about programming languages.
  // It's initial prompt is not sufficient to do this and must be optimized.
  const ProgrammingAssistantTask: OptimizePromptTask = {
    description:
      "Exclusively answer questions about programming languages. Reject any other questions.",
    execute: async ({ example, promptContent }) => {
      const response = await new OpenAI({
        baseURL: config.openAiBaseUrl,
        apiKey: config.openAiApiKey,
      }).chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: promptContent },
          { role: "user", content: example.input?.input as string },
        ],
      });
      return response.choices[0]?.message?.content ?? "";
    },
  };

  // This Evaluator will score the output of the ProgrammingAssistantTask
  // based on how well it matches the expected output.
  // It should "pass" the prompt if the output at least has the same meaning as the expected output.
  const SemanticMatcherEvaluator: OptimizePromptParams["evaluator"] =
    asEvaluator("Matches", async (params) => {
      const result = await openai.chat.completions
        .create({
          model: config.model,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "score",
              schema: {
                type: "object",
                properties: {
                  score: {
                    type: "string",
                    enum: ["A", "B", "C"],
                    description:
                      "The score of the output. A means the output exactly matches the expected output, B means the output semantically matches the expected output, and C means the output does not match the expected output.",
                  },
                  label: {
                    type: "string",
                    enum: ["Matches"],
                  },
                  explanation: {
                    type: "string",
                    description:
                      "Explain why the outputs do, or do not, match the expected output.",
                  },
                },
                required: ["score", "label", "explanation"],
              },
            },
          },
          messages: [
            {
              role: "user",
              content: `How well does the received output match the expected output?

Received Output: 

${params.output}

Expected Output: 

${params.expected?.output}`,
            },
          ],
        })
        .then((res) => {
          const parsed = JSON.parse(res.choices[0]?.message?.content ?? "");
          return {
            ...parsed,
            score: parsed.score === "A" ? 1 : parsed.score === "B" ? 0.6 : 0,
            metadata: {},
          };
        });
      if (!result) {
        throw new Error("No result from OpenAI");
      }
      return {
        ...result,
        metadata: {},
      };
    });

  const optimizer = (
    datasetId: string,
    handlers: OptimizePromptParams["handlers"],
    logger: OptimizePromptParams["logger"]
  ) =>
    // The optimizer will optimize the initial prompt to match the task description
    // It does this by evaluating the output of the task against every example in the dataset
    // and then using the evaluator to score the output.
    // It will run until all examples have been evaluated or the maxTurns is reached.
    optimizePrompt({
      dataset: datasetId,
      client: phoenix,
      options: {
        maxTurns: 5,
      },
      handlers,
      prompt: initialPrompt,
      task: ProgrammingAssistantTask,
      logger,
      evaluator: SemanticMatcherEvaluator,
    });

  // This runs the optimizer with a nice CLI interface, but is not required.
  await runner({
    phoenix,
    optimizer,
    initialPrompt: initialPrompt.content,
    taskDescription: ProgrammingAssistantTask.description,
  });
};

main();
