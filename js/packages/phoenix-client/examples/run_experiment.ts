import {
  asEvaluator,
  createClient,
  runExperiment,
  RunExperimentParams,
} from "../src";
import { intro, outro, select, spinner, log, confirm } from "@clack/prompts";

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

  const task: RunExperimentParams["task"] = async (example) => {
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
      task,
      evaluators: [
        asEvaluator("Mentions startups", async (example) => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const output = example.output;
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

  log.info(JSON.stringify(experimentRun, null, 2));

  s.stop("Experiment run complete!");

  outro("🐦‍🔥 Thank you for using Phoenix!");
};

main();
