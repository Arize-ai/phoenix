import { createClient, runExperiment, RunExperimentParams } from "../src";
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

const getExamples = (datasetId: string) =>
  phoenix
    .GET(`/v1/datasets/{id}/examples`, { params: { path: { id: datasetId } } })
    .then(({ data }) => data?.data);

// - Prompt user to select a dataset from the list
// - Prompt user to confirm the task, # of evaluators, # of examples before running
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

  const examples = await getExamples(dataset.id);
  if (!examples?.examples?.length) {
    outro("No examples found in the dataset, sorry!");
    return;
  }

  const datasetWithExamples: RunExperimentParams["dataset"] = {
    ...dataset,
    examples: examples.examples.map((example) => ({
      ...example,
      updatedAt: new Date(example.updated_at),
    })),
    versionId: examples.version_id,
  };

  const task: RunExperimentParams["task"] = async (example) => {
    return example.output ?? "My own output";
  };

  const experimentName = "runExperiment example";

  log.info(
    `We will run experiment "${experimentName}" on dataset "${dataset.name}"
    with ${0} evaluators and ${datasetWithExamples.examples.length} examples`
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
      dataset: datasetWithExamples,
      experimentName,
      client: phoenix,
      task,
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
