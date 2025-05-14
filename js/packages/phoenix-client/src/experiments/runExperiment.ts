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
import { AnnotatorKind } from "../types/annotations";
import { instrument } from "./instrument";
import { SpanStatusCode, Tracer, trace } from "@opentelemetry/api";
import {
  MimeType,
  OpenInferenceSpanKind,
  SemanticConventions,
} from "@arizeai/openinference-semantic-conventions";
import { ensureString } from "../utils/ensureString";

const INSTRUMENTATION = {
  enabled: false,
};

/**
 * Parameters for running an experiment.
 *
 * @experimental This feature is not complete, and will change in the future.
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
 * @example
 * ```ts
 * import { asEvaluator, runExperiment } from "@phoenix/client/experiments";
 *
 * const experiment = await runExperiment({
 *   dataset: "my-dataset",
 *   task: async (example) => example.input,
 *   evaluators: [
 *     asEvaluator("my-evaluator", "CODE", async (params) => params.output),
 *   ],
 * });
 * ```
 *
 * @experimental This feature is not complete, and will change in the future.
 */
export async function runExperiment({
  experimentName: _experimentName,
  experimentDescription,
  experimentMetadata,
  client: _client,
  dataset: _dataset,
  task,
  evaluators,
  projectName: _projectName,
  logger = console,
  record = true,
  concurrency = 5,
  dryRun = false,
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
  const experimentParams: ExperimentParameters = {
    nExamples,
  };
  let projectName = _projectName;
  if (!isDryRun && !INSTRUMENTATION.enabled) {
    const collectorEndpoint =
      client.config.baseUrl ?? process.env.PHOENIX_COLLECTOR_ENDPOINT;
    invariant(collectorEndpoint, "Phoenix collector endpoint not found");
    instrument({
      projectName,
      collectorEndpoint,
      headers: client.config.headers ?? {},
    });
    INSTRUMENTATION.enabled = true;
  }
  // initialize with noop tracer
  let tracer: Tracer = trace.getTracer("phoenix-client");
  let experiment: Experiment;
  if (isDryRun) {
    experiment = {
      id: id(),
      datasetId: dataset.id,
      datasetVersionId: dataset.versionId,
      projectName:
        _projectName ?? `${dataset.name}-${new Date().toISOString()}`,
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
          name: _experimentName,
          description: experimentDescription,
          metadata: experimentMetadata,
          project_name: projectName,
        },
      })
      .then((res) => res.data?.data);
    invariant(experimentResponse, `Failed to create experiment`);
    projectName =
      experimentResponse.project_name ??
      projectName ??
      `${dataset.name}-${new Date().toISOString()}`;
    experiment = {
      id: experimentResponse.id,
      datasetId: dataset.id,
      datasetVersionId: dataset.versionId,
      projectName,
    };
    tracer = trace.getTracer(projectName);
  }

  if (!record) {
    logger.info(
      `🔧 Running experiment in readonly mode. Results will not be recorded.`
    );
  }

  logger.info(
    `🧪 Starting experiment "${_experimentName}" on dataset "${dataset.id}" with task "${task.name}" and ${evaluators?.length ?? 0} ${pluralize(
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
    tracer,
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
    dryRun,
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
  tracer,
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
  /** The tracer to use */
  tracer: Tracer;
}) {
  logger.info(`🔧 Running task "${task.name}" on dataset "${dataset.id}"`);
  const run = async (example: Example) => {
    return tracer.startActiveSpan(`Task: ${task.name}`, async (span) => {
      logger.info(
        `🔧 Running task "${task.name}" on example "${example.id} of dataset "${dataset.id}"`
      );
      const traceId = span.spanContext().traceId;
      const thisRun: ExperimentRun = {
        id: id(),
        traceId,
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
        thisRun.error =
          error instanceof Error ? error.message : "Unknown error";
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      thisRun.endTime = new Date();
      if (!isDryRun) {
        // Log the run to the server
        // We log this without awaiting (e.g. best effort)
        const res = await client.POST("/v1/experiments/{experiment_id}/runs", {
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
        // replace the local run id with the server-assigned id
        thisRun.id = res.data?.data.id ?? thisRun.id;
        const inputMimeType =
          typeof example.input === "string" ? MimeType.TEXT : MimeType.JSON;
        const outputMimeType =
          typeof thisRun.output === "string" ? MimeType.TEXT : MimeType.JSON;
        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttributes({
          [SemanticConventions.OPENINFERENCE_SPAN_KIND]:
            OpenInferenceSpanKind.CHAIN,
          [SemanticConventions.INPUT_MIME_TYPE]: inputMimeType,
          [SemanticConventions.INPUT_VALUE]: ensureString(example.input),
          [SemanticConventions.OUTPUT_MIME_TYPE]: outputMimeType,
          [SemanticConventions.OUTPUT_VALUE]: ensureString(thisRun.output),
        });
      }
      span?.end();
      onComplete(thisRun);
      return thisRun;
    });
  };
  const q = queue(run, concurrency);
  const examplesToUse = dataset.examples.slice(0, nExamples);
  examplesToUse.forEach((example) =>
    q.push(example, (err) => {
      if (err) {
        logger.error(
          `Error running task "${task.name}" on example "${example.id}": ${err}`
        );
      }
    })
  );
  return q.drain();
}

/**
 * Evaluate an experiment.
 *
 * @experimental This feature is not complete, and will change in the future.
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
        logger,
      });
      if (!isDryRun) {
        logger.info(`📝 Logging evaluation ${evalResult.id}`);
        // Log the evaluation to the server
        // We log this without awaiting (e.g. best effort)
        client.POST("/v1/experiment_evaluations", {
          body: {
            experiment_run_id: evaluatorAndRun.run.id,
            name: evaluatorAndRun.evaluator.name,
            annotator_kind: evaluatorAndRun.evaluator.kind,
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
  if (!evaluatorsAndRuns.length) {
    logger.info(`🧠 No evaluators to run`);
    return {
      ...experiment,
      evaluationRuns: [],
    };
  }
  evaluatorsAndRuns.forEach((evaluatorAndRun) =>
    evaluatorsQueue.push(evaluatorAndRun, (err) => {
      if (err) {
        logger.error(
          `Error running evaluator "${evaluatorAndRun.evaluator.name}" on run "${evaluatorAndRun.run.id}": ${err}`
        );
      }
    })
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
 */
async function runEvaluator({
  evaluator,
  run,
  exampleCache,
  onComplete,
  logger,
}: {
  evaluator: Evaluator;
  run: ExperimentRun;
  exampleCache: Record<string, Example>;
  logger: Logger;
  onComplete: (run: ExperimentEvaluationRun) => void;
}) {
  const example = exampleCache[run.datasetExampleId];
  invariant(example, `Example "${run.datasetExampleId}" not found`);
  const evaluate = async () => {
    logger.info(
      `🧠 Evaluating run "${run.id}" with evaluator "${evaluator.name}"`
    );
    const thisEval: ExperimentEvaluationRun = {
      id: id(),
      traceId: null, // TODO: fill this in once we trace experiments
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
      logger.info(
        `✅ Evaluator "${evaluator.name}" on run "${run.id}" completed`
      );
    } catch (error) {
      thisEval.error = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        `❌ Evaluator "${evaluator.name}" on run "${run.id}" failed: ${thisEval.error}`
      );
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
 *
 * @param name - The name of the evaluator.
 * @param evaluate - The evaluator function.
 * @returns The evaluator object.
 */
export function asEvaluator({
  name,
  kind,
  evaluate,
}: {
  name: string;
  kind: AnnotatorKind;
  evaluate: Evaluator["evaluate"];
}): Evaluator {
  return {
    name,
    kind,
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
