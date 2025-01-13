import { intro, outro, select, spinner, log, confirm } from "@clack/prompts";
import { type PhoenixClient } from "@arizeai/phoenix-client";
import {
  optimizePrompt,
  type OptimizePromptParams,
} from "@arizeai/phoenix-client/prompts";

// Make GET request to /v1/datasets
// Available GET endpoints are available via auto-completion
// or by looking at Types["V1"]["paths"]
const getDatasets = (phoenix: PhoenixClient) =>
  phoenix
    .GET("/v1/datasets", { params: { query: { limit: 100 } } })
    .then(({ data }) => data?.data ?? []);

// - Prompt user to select a dataset from the list
// - Prompt user to confirm the task before running
// - Run the optimizer
// - Print the results

export const runner = async ({
  phoenix,
  optimizer,
  initialPrompt,
  taskDescription,
}: {
  phoenix: PhoenixClient;
  optimizer: (
    datasetId: string,
    handlers: OptimizePromptParams["handlers"],
    logger: OptimizePromptParams["logger"]
  ) => ReturnType<typeof optimizePrompt>;
  initialPrompt: string;
  taskDescription: string;
}) => {
  intro("Phoenix Prompt Optimization Runner");
  let datasets: Awaited<ReturnType<typeof getDatasets>> = [];
  try {
    datasets = await getDatasets(phoenix);
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

  log.info(
    `We will optimize prompt "${initialPrompt}" for use against dataset "${dataset.name}" with task "${taskDescription}"`
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
    promptRun = await optimizer(
      dataset.id,
      {
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
      {
        ...log,
        log: (message) => log.message(message),
      }
    );
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
