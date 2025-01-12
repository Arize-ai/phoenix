import { Dataset, Example } from "../../types/datasets";
import { createClient, type PhoenixClient } from "../../client";
import type {
  Evaluator,
  Experiment,
  ExperimentEvaluationRun,
  ExperimentParameters,
  ExperimentRun,
  ExperimentTask,
  RanExperiment,
} from "../../types/experiments";
import { promisifyResult } from "../../utils/promisifyResult";
import invariant from "tiny-invariant";
import { pluralize } from "../../utils/pluralize";
import { getDatasetLike } from "../../utils/getDatasetLike";
import { type Logger } from "../../types/logger";

export type RunExperimentParams = {
  /**
   * An optional name for the experiment.
   * Defaults to the dataset name + a timestamp
   */
  experimentName?: string;
  client?: PhoenixClient;
  dataset: Dataset | string | Example[];
  task: ExperimentTask;
  evaluators?: Evaluator[];
  repetitions?: number;
  /**
   * The project under which the experiment task traces are recorded
   */
  projectName?: string;
  logger?: Logger;
  readonly?: boolean;
};

/**
 * Run an experiment.
 */
export async function runExperiment({
  experimentName: _experimentName,
  client: _client,
  dataset: _dataset,
  task,
  evaluators,
  repetitions = 1,
  projectName = "default",
  logger = console,
  readonly = false,
}: RunExperimentParams): Promise<RanExperiment> {
  const client = _client ?? createClient();
  const dataset = await getDatasetLike({ dataset: _dataset, client });
  invariant(dataset, `Dataset not found`);
  invariant(dataset.examples.length > 0, `Dataset has no examples`);
  const experimentName =
    _experimentName ?? `${dataset.name}-${new Date().toISOString()}`;
  const experimentParams: ExperimentParameters = {
    nRepetitions: repetitions,
    // TODO: Make configurable?
    nExamples: dataset.examples.length,
  };
  const experiment: Experiment = {
    id: id(),
    datasetId: dataset.id,
    datasetVersionId: dataset.versionId,
    repetitions,
    projectName,
  };

  if (readonly) {
    logger.info(
      `🔧 Running experiment in readonly mode. Results will not be recorded.`
    );
  }

  logger.info(
    `🧪 Starting experiment "${experimentName}" on dataset "${dataset.id}" with task "${task.name}" and ${evaluators?.length ?? 0} ${pluralize(
      "evaluator",
      evaluators?.length ?? 0
    )}`
  );

  logger.info(
    `🔁 Running ${repetitions} ${pluralize("repetition", repetitions)} of task "${task.name}"`
  );

  // Run task against all examples, for each repetition
  type ExperimentRunId = string;
  const runs: Record<ExperimentRunId, ExperimentRun> = {};
  await Promise.all(
    Array.from({ length: repetitions }, (_, i) =>
      runTask({
        repetition: i + 1,
        experimentId: experiment.id,
        task,
        dataset,
        logger,
        onComplete: (run) => {
          runs[run.id] = run;
        },
      })
    )
  );
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
  });
  ranExperiment.evaluationRuns = evaluationRuns;

  logger.info(`✅ Experiment ${experiment.id} completed`);

  return ranExperiment;
}

/**
 * Run a task against all examples in a dataset.
 */
function runTask({
  experimentId,
  task,
  dataset,
  repetition,
  onComplete,
  logger,
}: {
  /** The id of the experiment */
  experimentId: string;
  /** The task to run */
  task: ExperimentTask;
  /** The dataset to run the task on */
  dataset: Dataset;
  /** The repetition number */
  repetition: number;
  /** A callback to call when the task is complete */
  onComplete: (run: ExperimentRun) => void;
  /** The logger to use */
  logger: Logger;
}) {
  logger.info(
    `🔧 (${repetition}) Running task "${task.name}" on dataset "${dataset.id}"`
  );
  const run = async (example: Example) => {
    const thisRun: ExperimentRun = {
      id: id(),
      traceId: id(),
      experimentId,
      datasetExampleId: example.id,
      startTime: new Date(),
      repetitionNumber: repetition,
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
    onComplete(thisRun);
  };
  return Promise.all(dataset.examples.map(run));
}

export async function evaluateExperiment({
  experiment,
  evaluators,
  client: _client,
  logger,
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
}): Promise<RanExperiment> {
  const client = _client ?? createClient();
  const dataset = await getDatasetLike({
    dataset: experiment.datasetId,
    client,
  });
  invariant(dataset, `Dataset "${experiment.datasetId}" not found`);
  invariant(
    dataset.examples.length > 0,
    `Dataset "${experiment.datasetId}" has no examples`
  );
  invariant(experiment.runs, `Experiment "${experiment.id}" has no runs`);

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
  await Promise.all(
    evaluators.map((evaluator) =>
      Promise.all(
        Object.values(experiment.runs).map((run) =>
          runEvaluator({
            evaluator,
            run,
            exampleCache: examplesById,
            onComplete: onEvaluationComplete,
          })
        )
      )
    )
  );

  logger.info(`✅ Evaluation runs completed`);

  return {
    ...experiment,
    evaluationRuns: Object.values(evaluationRuns),
  };
}

/**
 * Run an evaluator against a run.
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
  };

  return evaluate();
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
