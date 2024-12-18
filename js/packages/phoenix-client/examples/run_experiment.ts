/* eslint-disable no-console */
import {
  asEvaluator,
  createClient,
  runExperiment,
  RunExperimentParams,
} from "../src";
import { intro, outro, select, spinner, log, confirm } from "@clack/prompts";
import { Factuality, Humor } from "autoevals";

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
  const datasets = await getDatasets();
  if (datasets.length === 0) {
    outro(
      "No datasets found in your Phoenix instance. Please create a dataset first!"
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

  const passThroughTask: RunExperimentParams["task"] = async (example) => {
    return example.output ?? "My own output";
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
      task: passThroughTask,
      repetitions: 2,
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
            openAiApiKey: "ollama",
            openAiBaseUrl: "http://localhost:11434/v1",
            model: "llama3.2",
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
            openAiApiKey: "ollama",
            openAiBaseUrl: "http://localhost:11434/v1",
            model: "llama3.2",
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
  console.table(experimentRun.runs);
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
