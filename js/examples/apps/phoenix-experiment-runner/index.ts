/* eslint-disable no-console */
import { createClient } from "@arizeai/phoenix-client";
import {
  asEvaluator,
  runExperiment,
  type RunExperimentParams,
} from "@arizeai/phoenix-client/experimental";
import { intro, outro, select, spinner, log, confirm } from "@clack/prompts";
import { Factuality, Humor } from "autoevals";
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
  intro("Phoenix Experiment Runner");
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

  const LLMAssistantTask: RunExperimentParams["task"] = async (example) => {
    const response = await new OpenAI({
      baseURL: config.openAiBaseUrl,
      apiKey: config.openAiApiKey,
    }).chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: JSON.stringify(example.input, null, 2) },
      ],
    });
    return response.choices[0]?.message?.content ?? "No response";
  };

  const experimentName = "runExperiment example";

  log.info(
    `We will run experiment "${experimentName}" on dataset "${dataset.name}"`
  );
  const shouldContinue = await confirm({
    message: "Do you want to continue?",
  });

  if (!shouldContinue) {
    log.error("Experiment cancelled");
    return;
  }

  const s = spinner();
  s.start("Running experiment...");

  let experimentRun: Awaited<ReturnType<typeof runExperiment>>;
  try {
    experimentRun = await runExperiment({
      dataset: dataset.id,
      experimentName,
      client: phoenix,
      task: LLMAssistantTask,
      repetitions: 2,
      logger: {
        ...log,
        log: (message) => log.message(message),
      },
      evaluators: [
        asEvaluator("Mentions startups", async (params) => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const output = params.output;
          const isString = typeof output === "string";
          return {
            score:
              isString && output?.toLocaleLowerCase()?.includes?.("startups")
                ? 1
                : 0,
            label: "Mentions startups",
            explanation: "The output contains the word 'startups'",
            metadata: {},
          };
        }),
        asEvaluator("Mentions evaluation", async (params) => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const output = params.output;
          const isString = typeof output === "string";
          return {
            score:
              isString && output?.toLocaleLowerCase()?.includes?.("evaluation")
                ? 1
                : 0,
            label: "Mentions evaluation",
            explanation: "The output contains the word 'evaluation'",
            metadata: {},
          };
        }),
        asEvaluator("Factuality", async (params) => {
          const result = await Factuality.partial({
            ...config,
          })({
            output: JSON.stringify(params.output, null, 2),
            input: JSON.stringify(params.input, null, 2),
            expected: JSON.stringify(params.expected, null, 2),
          });
          return {
            score: result.score,
            label: result.name,
            explanation: (result.metadata?.rationale as string) ?? "",
            metadata: result.metadata ?? {},
          };
        }),
        asEvaluator("Humor", async (params) => {
          const result = await Humor.partial({
            ...config,
          })({
            output: JSON.stringify(params.output, null, 2),
          });
          return {
            score: result.score,
            label: result.name,
            explanation: (result.metadata?.rationale as string) ?? "",
            metadata: result.metadata ?? {},
          };
        }),
      ],
    });
  } catch (e) {
    s.stop("Experiment run failed!");
    if (e instanceof Error) {
      log.error(e.message);
    } else {
      log.error(JSON.stringify(e, null, 2));
    }
    return;
  }

  s.stop("Experiment run complete!");

  log.info("Experiment runs:");
  console.table(
    Object.values(experimentRun.runs).map((run) => ({
      ...run,
      output: JSON.stringify(run.output)?.slice(0, 50).concat("..."),
    }))
  );
  log.info("Evaluation run results:");
  console.table(
    experimentRun.evaluationRuns
      ?.map((run) => ({
        id: run.id,
        experimentRunId: run.experimentRunId,
        ...run.result,
      }))
      .map((r) => ({
        ...r,
        explanation: r?.explanation?.slice(0, 100).concat("..."),
        metadata: "...Stripped for brevity...",
      }))
  );

  outro("🐦‍🔥 Thank you for using Phoenix!");
};

main();
