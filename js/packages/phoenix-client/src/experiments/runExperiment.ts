import { queue } from "async";
import invariant from "tiny-invariant";
import { createClient, type PhoenixClient } from "../client";
import { ClientFn } from "../types/core";
import { Dataset, Example } from "../types/datasets";
import type {
  Evaluator,
  Experiment,
  ExperimentEvaluationRun,
  ExperimentParameters,
  ExperimentRun,
  ExperimentTask,
  RanExperiment,
} from "../types/experiments";
import { type Logger } from "../types/logger";
import { getDatasetBySelector } from "../utils/getDatasetBySelector";
import { pluralize } from "../utils/pluralize";
import { promisifyResult } from "../utils/promisifyResult";

/**
 * Parameters for running an experiment.
 *
 * @experimental This feature is not complete, and will change in the future.
 * @deprecated This function will be un-marked as deprecated once the experimental feature flag is removed.
 */
export type RunExperimentParams = ClientFn & {
  /**
   * An optional name for the experiment.
   * Defaults to the dataset name + a timestamp
   */
  experimentName?: string;
  /**
   * The description of the experiment
   */
  experimentDescription?: string;
  /**
   * Experiment metadata
   */
  experimentMetadata?: Record<string, unknown>;
  /**
   * The dataset to run the experiment on
   */
  dataset: Dataset | string | Example[];
  /**
   * The task to run
   */
  task: ExperimentTask;
  /**
   * The evaluators to use
   */
  evaluators?: Evaluator[];
  /**
   * The project under which the experiment task traces are recorded
   */
  projectName?: string;
  /**
   * The logger to use
   */
  logger?: Logger;
  /**
   * Whether to record the experiment results
   */
  record?: boolean;
  /**
   * The number of dataset examples to run in parallel
   */
  concurrency?: number;
  /**
   * Whether or not to run the experiment as a dry run. If a number is privided, n examples will be run.
   * @default false
   */
  dryRun?: number | boolean;
};

/**
 * Run an experiment.
 *
 * @experimental This feature is not complete, and will change in the future.
 * @deprecated This function will be un-marked as deprecated once the experimental feature flag is removed.
 */
export async function runExperiment({
  experimentName: _experimentName,
  experimentDescription,
  experimentMetadata,
  client: _client,
  dataset: _dataset,
  task,
  evaluators,
  projectName = "default",
  logger = console,
  record = true,
  concurrency = 5,
  dryRun,
}: RunExperimentParams): Promise<RanExperiment> {
  const isDryRun = typeof dryRun === "number" || dryRun === true;
  const client = _client ?? createClient();
  const dataset = await getDatasetBySelector({ dataset: _dataset, client });
  invariant(dataset, `Dataset not found`);
  invariant(dataset.examples.length > 0, `Dataset has no examples`);
  const nExamples =
    typeof dryRun === "number"
      ? Math.max(dryRun, dataset.examples.length)
      : dataset.examples.length;

  const experimentName =
    _experimentName ?? `${dataset.name}-${new Date().toISOString()}`;
  const experimentParams: ExperimentParameters = {
    nExamples,
  };
  let experiment: Experiment;
  if (isDryRun) {
    experiment = {
      id: id(),
      datasetId: dataset.id,
      datasetVersionId: dataset.versionId,
      projectName,
    };
  } else {
    const experimentResponse = await client
      .POST("/v1/datasets/{dataset_id}/experiments", {
        params: {
          path: {
            dataset_id: dataset.id,
          },
        },
        body: {
          name: experimentName,
          description: experimentDescription,
          metadata: experimentMetadata,
          project_name: projectName,
        },
      })
      .then((res) => res.data?.data);
    invariant(experimentResponse, `Failed to create experiment`);
    experiment = {
      id: experimentResponse.id,
      datasetId: dataset.id,
      datasetVersionId: dataset.versionId,
      projectName,
    };
  }

  if (!record) {
    logger.info(
      `🔧 Running experiment in readonly mode. Results will not be recorded.`
    );
  }

  logger.info(
    `🧪 Starting experiment "${experimentName}" on dataset "${dataset.id}" with task "${task.name}" and ${evaluators?.length ?? 0} ${pluralize(
      "evaluator",
      evaluators?.length ?? 0
    )} and ${concurrency} concurrent runs`
  );

  // Run task against all examples, for each repetition
  type ExperimentRunId = string;
  const runs: Record<ExperimentRunId, ExperimentRun> = {};
  await runTask({
    client,
    experimentId: experiment.id,
    task,
    dataset,
    logger,
    onComplete: (run) => {
      runs[run.id] = run;
    },
    concurrency,
    isDryRun,
    nExamples,
  });
  logger.info(`✅ Task runs completed`);

  const ranExperiment: RanExperiment = {
    ...experiment,
    params: experimentParams,
    runs,
  };

  const { evaluationRuns } = await evaluateExperiment({
    experiment: ranExperiment,
    evaluators: evaluators ?? [],
    client,
    logger,
    concurrency,
  });
  ranExperiment.evaluationRuns = evaluationRuns;

  logger.info(`✅ Experiment ${experiment.id} completed`);

  return ranExperiment;
}

/**
 * Run a task against n examples in a dataset.
 */
function runTask({
  client,
  experimentId,
  task,
  dataset,
  onComplete,
  logger,
  concurrency = 5,
  isDryRun,
  nExamples,
}: {
  /** The client to use */
  client: PhoenixClient;
  /** The id of the experiment */
  experimentId: string;
  /** The task to run */
  task: ExperimentTask;
  /** The dataset to run the task on */
  dataset: Dataset;
  /** A callback to call when the task is complete */
  onComplete: (run: ExperimentRun) => void;
  /** The logger to use */
  logger: Logger;
  /** The number of examples to run in parallel */
  concurrency: number;
  /** Whether to run the task as a dry run */
  isDryRun: boolean;
  /** The number of examples to run */
  nExamples: number;
}) {
  logger.info(`🔧 Running task "${task.name}" on dataset "${dataset.id}"`);
  const run = async (example: Example) => {
    logger.info(
      `🔧 Running task "${task.name}" on example "${example.id} of dataset "${dataset.id}"`
    );
    const thisRun: ExperimentRun = {
      id: id(),
      traceId: id(),
      experimentId,
      datasetExampleId: example.id,
      startTime: new Date(),
      endTime: new Date(), // will get replaced with actual end time
      output: null,
      error: null,
    };
    try {
      const taskOutput = await promisifyResult(task(example));
      // TODO: why doesn't run output type match task output type?
      thisRun.output =
        typeof taskOutput === "string"
          ? taskOutput
          : JSON.stringify(taskOutput);
    } catch (error) {
      thisRun.error = error instanceof Error ? error.message : "Unknown error";
    }
    thisRun.endTime = new Date();
    if (!isDryRun) {
      // Log the run to the server
      // We log this without awaiting (e.g. best effort)
      client.POST("/v1/experiments/{experiment_id}/runs", {
        params: {
          path: {
            experiment_id: experimentId,
          },
        },
        body: {
          dataset_example_id: example.id,
          output: thisRun.output,
          repetition_number: 0,
          start_time: thisRun.startTime.toISOString(),
          end_time: thisRun.endTime.toISOString(),
          trace_id: thisRun.traceId,
          error: thisRun.error,
        },
      });
    }
    onComplete(thisRun);
    return thisRun;
  };
  const q = queue(run, concurrency);
  const examplesToUse = dataset.examples.slice(0, nExamples);
  examplesToUse.forEach((example) => q.push(example));
  return q.drain();
}

/**
 * Evaluate an experiment.
 *
 * @experimental This feature is not complete, and will change in the future.
 * @deprecated This function will be un-marked as deprecated once the experimental feature flag is removed.
 */
export async function evaluateExperiment({
  experiment,
  evaluators,
  client: _client,
  logger,
  concurrency = 5,
  dryRun = false,
}: {
  /**
   * The experiment to evaluate
   * @todo also accept Experiment, and attempt to fetch the runs from the server
   **/
  experiment: RanExperiment;
  /** The evaluators to use */
  evaluators: Evaluator[];
  /** The client to use */
  client?: PhoenixClient;
  /** The logger to use */
  logger: Logger;
  /** The number of evaluators to run in parallel */
  concurrency: number;
  /**
   * Whether to run the evaluation as a dry run
   * If a number is provided, the evaluation will be run for the first n runs
   * @default false
   * */
  dryRun?: boolean | number;
}): Promise<RanExperiment> {
  const isDryRun = typeof dryRun === "number" || dryRun === true;
  const nRuns =
    typeof dryRun === "number"
      ? Math.max(dryRun, Object.keys(experiment.runs).length)
      : Object.keys(experiment.runs).length;
  const client = _client ?? createClient();
  const dataset = await getDatasetBySelector({
    dataset: experiment.datasetId,
    client,
  });
  invariant(dataset, `Dataset "${experiment.datasetId}" not found`);
  invariant(
    dataset.examples.length > 0,
    `Dataset "${experiment.datasetId}" has no examples`
  );
  invariant(experiment.runs, `Experiment "${experiment.id}" has no runs`);

  const runsToEvaluate = Object.values(experiment.runs).slice(0, nRuns);

  if (evaluators?.length === 0) {
    return {
      ...experiment,
      evaluationRuns: [],
    };
  }

  logger.info(
    `🧠 Evaluating experiment "${experiment.id}" with ${evaluators?.length ?? 0} ${pluralize(
      "evaluator",
      evaluators?.length ?? 0
    )}`
  );
  type EvaluationId = string;
  const evaluationRuns: Record<EvaluationId, ExperimentEvaluationRun> = {};

  const examplesById: Record<string, Example> = {};
  for (const example of dataset.examples) {
    examplesById[example.id] = example;
  }

  const onEvaluationComplete = (run: ExperimentEvaluationRun) => {
    evaluationRuns[run.id] = run;
  };

  // Run evaluators against all runs
  // Flat list of evaluator + run tuples
  const evaluatorsAndRuns = evaluators.flatMap((evaluator) =>
    runsToEvaluate.map((run) => ({
      evaluator,
      run,
    }))
  );
  const evaluatorsQueue = queue(
    async (evaluatorAndRun: { evaluator: Evaluator; run: ExperimentRun }) => {
      const evalResult = await runEvaluator({
        evaluator: evaluatorAndRun.evaluator,
        run: evaluatorAndRun.run,
        exampleCache: examplesById,
        onComplete: onEvaluationComplete,
      });
      if (!isDryRun) {
        // Log the evaluation to the server
        // We log this without awaiting (e.g. best effort)
        client.POST("/v1/experiment_evaluations", {
          body: {
            experiment_run_id: evaluatorAndRun.run.id,
            name: evaluatorAndRun.evaluator.name,
            // TODO: infer this from the evaluator
            annotator_kind: "LLM",
            start_time: evalResult.startTime.toISOString(),
            end_time: evalResult.endTime.toISOString(),
            result: {
              ...evalResult.result,
            },
            error: evalResult.error,
            trace_id: evalResult.traceId,
          },
        });
      }
    },
    concurrency
  );
  evaluatorsAndRuns.forEach((evaluatorAndRun) =>
    evaluatorsQueue.push(evaluatorAndRun)
  );
  await evaluatorsQueue.drain();
  logger.info(`✅ Evaluation runs completed`);

  return {
    ...experiment,
    evaluationRuns: Object.values(evaluationRuns),
  };
}

/**
 * Run an evaluator against a run.
 *
 * @experimental This feature is not complete, and will change in the future.
 * @deprecated This function will be un-marked as deprecated once the experimental feature flag is removed.
 */
async function runEvaluator({
  evaluator,
  run,
  exampleCache,
  onComplete,
}: {
  evaluator: Evaluator;
  run: ExperimentRun;
  exampleCache: Record<string, Example>;
  onComplete: (run: ExperimentEvaluationRun) => void;
}) {
  const example = exampleCache[run.datasetExampleId];
  invariant(example, `Example "${run.datasetExampleId}" not found`);
  const evaluate = async () => {
    const thisEval: ExperimentEvaluationRun = {
      id: id(),
      traceId: id(),
      experimentRunId: run.id,
      startTime: new Date(),
      endTime: new Date(), // will get replaced with actual end time
      name: evaluator.name,
      result: null,
      error: null,
      annotatorKind: "LLM", // TODO: make configurable via evaluator def
    };
    try {
      const result = await evaluator.evaluate({
        input: example.input,
        output: run.output ?? null,
        expected: example.output,
        metadata: example.metadata,
      });
      thisEval.result = result;
    } catch (error) {
      thisEval.error = error instanceof Error ? error.message : "Unknown error";
    }
    thisEval.endTime = new Date();
    onComplete(thisEval);
    return thisEval;
  };

  return evaluate();
}

/**
 * Wrap an evaluator function in an object with a name property.
 *
 * @experimental This feature is not complete, and will change in the future.
 * @deprecated This function will be un-marked as deprecated once the experimental feature flag is removed.
 *
 * @param name - The name of the evaluator.
 * @param evaluate - The evaluator function.
 * @returns The evaluator object.
 */
export function asEvaluator(
  name: string,
  evaluate: Evaluator["evaluate"]
): Evaluator {
  return {
    name,
    evaluate,
  };
}

let _id = 1000;

/**
 * Generate a unique id.
 *
 * @deprecated Use id generated by phoenix instead.
 * @returns A unique id.
 */
export function id(): string {
  return (() => {
    _id++;
    return _id.toString();
  })();
}
