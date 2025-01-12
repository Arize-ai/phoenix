/* eslint-disable no-console */
import "./instrumentation.ts";
import { createClient } from "@arizeai/phoenix-client";
import {
  optimizePrompt,
  type OptimizePromptParams,
  type OptimizePromptTask,
} from "@arizeai/phoenix-client/prompts";
import { asEvaluator } from "@arizeai/phoenix-client/experiments";
import { intro, outro, select, spinner, log, confirm } from "@clack/prompts";
import dotenv from "dotenv";
import OpenAI from "openai";
import { z } from "zod";

dotenv.config();

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

// Make GET request to /v1/datasets
// Available GET endpoints are available via auto-completion
// or by looking at Types["V1"]["paths"]
const getDatasets = () =>
  phoenix
    .GET("/v1/datasets", { params: { query: { limit: 100 } } })
    .then(({ data }) => data?.data ?? []);

// - Prompt user to select a dataset from the list
// - Prompt user to confirm the task before running
// - Run the experiment
// - Print the results

const main = async () => {
  intro("Phoenix Prompt Optimization Runner");
  let datasets: Awaited<ReturnType<typeof getDatasets>> = [];
  try {
    datasets = await getDatasets();
  } catch (e) {
    if (e instanceof Error && e.message === "fetch failed") {
      log.error(
        "Cannot connect to Phoenix at http://localhost:6006! Start it with `pnpm d:up` and try again!"
      );
      return;
    }
    log.error(String(e));
    return;
  }

  if (datasets.length === 0) {
    outro(
      "No datasets found in your Phoenix instance. Please create a dataset at http://localhost:6006/datasets first!\nYou can use the `qa-dataset.csv` file in this directory to create a dataset."
    );
    return;
  }

  const datasetId = await select({
    message: "Select a dataset",
    options: datasets.map((dataset) => ({
      value: dataset.id,
      label: dataset.name,
    })),
  });

  const dataset = datasets.find((dataset) => dataset.id === datasetId);
  if (!dataset) {
    outro("Dataset not found, sorry!");
    return;
  }

  const initialPrompt: OptimizePromptParams["prompt"] = {
    content: "You are a helpful assistant.",
  };

  const LLMAssistantTask: OptimizePromptTask = {
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

  log.info(
    `We will optimize prompt "${initialPrompt.content}" for use against dataset "${dataset.name}" with task "${LLMAssistantTask.description}"`
  );
  const shouldContinue = await confirm({
    message: "Do you want to continue?",
  });

  if (!shouldContinue) {
    log.error("Prompt optimization cancelled");
    return;
  }

  const s = spinner();
  s.start("Evaluating initial prompt...");

  let promptRun: Awaited<ReturnType<typeof optimizePrompt>>;
  try {
    promptRun = await optimizePrompt({
      dataset: dataset.id,
      client: phoenix,
      options: {
        maxTurns: 5,
      },
      handlers: {
        onStart: () => {
          s.stop();
          s.start("Generating new prompt...");
        },
        onTurnEnd: ({ suggestions, failedExperimentEvaluationRunCount }) => {
          log.info(
            `Failed experiment evaluation run count: ${failedExperimentEvaluationRunCount}`
          );
          log.info(`Suggestions:\n${suggestions.join("\n")}`);
        },
      },
      prompt: initialPrompt,
      task: LLMAssistantTask,
      logger: {
        ...log,
        log: (message) => log.message(message),
      },
      evaluator: asEvaluator("Matches", async (params) => {
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
              score: parsed.score === "C" ? 0 : parsed.score === "B" ? 0.6 : 1,
              metadata: {},
            };
          });
        if (!result) {
          throw new Error("No result from OpenAI");
        }
        return {
          ...result,
          score: result.score === "C" ? 0 : result.score === "B" ? 0.6 : 1,
          metadata: {},
        };
      }),
    });
  } catch (e) {
    s.stop("Prompt optimization failed!");
    if (e instanceof Error) {
      log.error(e.message);
    } else {
      log.error(JSON.stringify(e, null, 2));
    }
    return;
  }

  if (!promptRun) {
    s.stop("Prompt optimization did not proceed");
    return;
  }

  s.stop("Prompt optimization complete!");

  if (promptRun.lastTestedInputOutputs.length > 0) {
    log.info("Last tested input outputs:");
    promptRun.lastTestedInputOutputs.forEach(
      ({ input, output, score, explanation }) => {
        log.info(`Input:\n${input}`);
        log.info(`Output:\n${output}`);
        log.info(`Explanation:\n${explanation}`);
        log.info(`Score:\n${score}`);
      }
    );
  }

  log.info("Original Prompt:");
  log.info(promptRun.initialPrompt.content);
  log.info("Optimized Prompt Output:");
  log.info(promptRun.optimizedPrompt.content);

  outro("🐦‍🔥 Thank you for using Phoenix!");
};

main();
