import { Dataset, Example } from "types/datasets";
import { createClient, type PhoenixClient } from "../client";
import type {
  EvaluationResult,
  Evaluator,
  ExperimentEvaluationRun,
  ExperimentRun,
  ExperimentTask,
} from "../types/experiments";
import { promisifyResult } from "utils/promisifyResult";

export type RunExperimentParams = {
  experimentName: string;
  client?: PhoenixClient;
  dataset: Dataset | string | Example[];
  task: ExperimentTask;
  evaluators: Evaluator[];
  repetitions?: number;
};

export async function runExperiment({
  experimentName,
  client: _client,
  dataset: _dataset,
  task,
  evaluators,
  repetitions = 1,
}: RunExperimentParams): Promise<ExperimentRun> {
  const startTime = new Date();
  const client = _client ?? createClient();
  const dataset = await getDataset({ dataset: _dataset, client });

  // TODO: logger w/ verbosity
  // eslint-disable-next-line no-console
  console.info(
    `Running experiment ${experimentName} on ${dataset.id} with ${task} and ${evaluators.length} evaluators`,
  );

  const run = async ({ repetition }: { repetition: number }) => {
    // accumulate results of each evaluator for each example
    const experimentEvaluationRunsByExampleId: Record<
      string,
      Record<string, ExperimentEvaluationRun[]>
    > = {};

    for (const example of dataset.examples) {
      // accumulate results of each evaluator for this example
      const experimentEvaluationRunsByName: Record<string, EvaluationResult[]> =
        {};
      const taskOutput = await promisifyResult(task(example));
      const evaluationRunPromises = evaluators.map((evaluator) =>
        promisifyResult(
          evaluator.evaluate({
            output: taskOutput,
            expected: example.output,
          }),
        ).then((result) => {
          if (experimentEvaluationRunsByName[evaluator.name]) {
            experimentEvaluationRunsByName?.[evaluator.name]?.push(result);
          } else {
            experimentEvaluationRunsByName[evaluator.name] = [result];
          }
          return result;
        }),
      );

      const evaluationRuns = await Promise.all(evaluationRunPromises);
      evaluationRuns.forEach((evaluationRun) =>
        // TODO: Where does repetition go? Is EvaluationResult the right type?
        experimentEvaluationRuns.push({
          id: "TODO",
          experimentRunId: "TODO",
          annotatorKind: "HUMAN",
          startTime: new Date(),
          endTime: new Date(),
          error: null,
          result: evaluationRun,
          trace_id: null,
          name: "TODO",
        }),
      );
    }

    return experimentEvaluationRunsByExampleId;
  };

  const runs = await Promise.all(
    Array.from({ length: repetitions }, (_, i) => run({ repetition: i + 1 })),
  );

  // TODO: aggregate run results

  const endTime = new Date();

  // pretty sure this is the wrong type
  return {
    id: "TODO",
    traceId: "TODO",
    startTime,
    endTime,
    experimentId: experimentName,
    datasetExampleId: dataset.id,
    repetitionNumber: 0,
    output: null,
    error: null,
  };
}

/**
 * Return a dataset object from the input.
 *
 * If the input is a string, assume it is a dataset id and fetch the dataset from the client.
 * If the input is an array of examples, create a new dataset from the examples then return it.
 * If the input is a dataset, return it as is.
 *
 * @param dataset - The dataset to get.
 * @returns The dataset.
 */
async function getDataset({
  dataset,
}: {
  dataset: Dataset | string | Example[];
  client: PhoenixClient;
}): Promise<Dataset> {
  if (typeof dataset === "string") {
    throw new Error("TODO: implement dataset fetching by id");
  }
  if (Array.isArray(dataset)) {
    throw new Error("TODO: implement dataset creation from examples");
  }
  return dataset;
}

/**
 * Wrap an evaluator function in an object with a name property.
 *
 * @param name - The name of the evaluator.
 * @param evaluate - The evaluator function.
 * @returns The evaluator object.
 */
export function asEvaluator(
  name: string,
  evaluate: Evaluator["evaluate"],
): Evaluator {
  return {
    name,
    evaluate,
  };
}
