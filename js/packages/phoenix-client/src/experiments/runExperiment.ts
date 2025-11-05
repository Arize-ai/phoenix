import {
  MimeType,
  OpenInferenceSpanKind,
  SemanticConventions,
} from "@arizeai/openinference-semantic-conventions";
import {
  createNoOpProvider,
  type DiagLogLevel,
  NodeTracerProvider,
  objectAsAttributes,
  register,
  SpanStatusCode,
  trace,
  Tracer,
} from "@arizeai/phoenix-otel";

import { createClient, type PhoenixClient } from "../client";
import { getDataset } from "../datasets/getDataset";
import { AnnotatorKind } from "../types/annotations";
import { ClientFn } from "../types/core";
import {
  Dataset,
  DatasetSelector,
  Example,
  ExampleWithId,
} from "../types/datasets";
import type {
  Evaluator,
  ExperimentEvaluationRun,
  ExperimentInfo,
  ExperimentRun,
  ExperimentRunID,
  ExperimentTask,
  RanExperiment,
} from "../types/experiments";
import { type Logger } from "../types/logger";
import { ensureString } from "../utils/ensureString";
import { pluralize } from "../utils/pluralize";
import { promisifyResult } from "../utils/promisifyResult";
import { toObjectHeaders } from "../utils/toObjectHeaders";
import {
  getDatasetExperimentsUrl,
  getDatasetUrl,
  getExperimentUrl,
} from "../utils/urlUtils";

import { getExperimentInfo } from "./getExperimentInfo";

import assert from "assert";
import { queue } from "async";
import invariant from "tiny-invariant";

/**
 * Validate that a repetition is valid
 */
function isValidRepetitionParam(repetitions: number) {
  return Number.isInteger(repetitions) && repetitions > 0;
}
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
   * E.x. modelName
   */
  experimentMetadata?: Record<string, unknown>;
  /**
   * The dataset to run the experiment on
   */
  dataset: DatasetSelector;
  /**
   * The task to run
   */
  task: ExperimentTask;
  /**
   * The evaluators to use
   */
  evaluators?: Evaluator[];
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
  /**
   * Whether to set the global tracer provider when running the task.
   * If set to false, a locally scoped tracer will be created but will not get registered.
   * This may cause certain spans to not be picked up by Phoenix. Notably libraries like the AI SDK that leverage the global tracer.
   * @default true
   */
  setGlobalTracerProvider?: boolean;
  /**
   * Number of times to repeat each dataset example
   * @default 1
   */
  repetitions?: number;
  /*
   * Whether to use batching for the span processor.
   * @default true
   */
  useBatchSpanProcessor?: boolean;
  /**
   * Log level to set for the default DiagConsoleLogger when tracing.
   * Omit to disable default diag logging, or to bring your own.
   */
  diagLogLevel?: DiagLogLevel;
};

/**
 * Runs an experiment using a given set of dataset of examples.
 *
 *   An experiment is a user-defined task that runs on each example in a dataset. The results from
 *   each experiment can be evaluated using any number of evaluators to measure the behavior of the
 *   task. The experiment and evaluation results are stored in the Phoenix database for comparison
 *   and analysis.
 *
 *   A `task` is either a sync or async function that returns a JSON serializable
 *   output. If the `task` is a function of one argument then that argument will be bound to the
 *   `input` field of the dataset example. Alternatively, the `task` can be a function of any
 *   combination of specific argument names that will be bound to special values:
 *
 *   - `input`: The input field of the dataset example
 *   - `expected`: The expected or reference output of the dataset example
 *   - `reference`: An alias for `expected`
 *   - `metadata`: Metadata associated with the dataset example
 *   - `example`: The dataset `Example` object with all associated fields
 *
 * @example
 * ```ts
 * import { asEvaluator, runExperiment } from "@phoenix/client/experiments";
 *
 * const experiment = await runExperiment({
 *   dataset: "my-dataset",
 *   task: async (example) => example.input,
 *   evaluators: [
 *     asEvaluator({ name: "my-evaluator", kind: "CODE", evaluate: async (params) => params.output }),
 *   ],
 * });
 * ```
 */
export async function runExperiment({
  experimentName,
  experimentDescription,
  experimentMetadata = {},
  client: _client,
  dataset: datasetSelector,
  task,
  evaluators,
  logger = console,
  record = true,
  concurrency = 5,
  dryRun = false,
  setGlobalTracerProvider = true,
  repetitions = 1,
  useBatchSpanProcessor = true,
  diagLogLevel,
}: RunExperimentParams): Promise<RanExperiment> {
  // Validation
  assert(
    isValidRepetitionParam(repetitions),
    "repetitions must be an integer greater than 0"
  );
  let provider: NodeTracerProvider | undefined;
  const isDryRun = typeof dryRun === "number" || dryRun === true;
  const client = _client ?? createClient();
  const dataset = await getDataset({
    dataset: datasetSelector,
    client,
  });
  invariant(dataset, `Dataset not found`);
  invariant(dataset.examples.length > 0, `Dataset has no examples`);
  const nExamples =
    typeof dryRun === "number"
      ? Math.min(dryRun, dataset.examples.length)
      : dataset.examples.length;

  let projectName = `${dataset.name}-exp-${new Date().toISOString()}`;
  // initialize the tracer into scope
  let taskTracer: Tracer;
  let experiment: ExperimentInfo;
  if (isDryRun) {
    const now = new Date().toISOString();
    const totalExamples = nExamples;
    experiment = {
      id: localId(),
      datasetId: dataset.id,
      datasetVersionId: dataset.versionId,
      // @todo: the dataset should return splits in response body
      datasetSplits: datasetSelector?.splits ?? [],
      projectName,
      metadata: experimentMetadata,
      repetitions,
      createdAt: now,
      updatedAt: now,
      exampleCount: totalExamples,
      successfulRunCount: 0,
      failedRunCount: 0,
      missingRunCount: totalExamples * repetitions,
    };
    taskTracer = createNoOpProvider().getTracer("no-op");
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
          repetitions,
          // @todo: the dataset should return splits in response body
          ...(datasetSelector?.splits
            ? { splits: datasetSelector.splits }
            : {}),
          ...(dataset?.versionId ? { version_id: dataset.versionId } : {}),
        },
      })
      .then((res) => res.data?.data);
    invariant(experimentResponse, `Failed to create experiment`);
    projectName = experimentResponse.project_name ?? projectName;
    experiment = {
      id: experimentResponse.id,
      datasetId: experimentResponse.dataset_id,
      datasetVersionId: experimentResponse.dataset_version_id,
      // @todo: the dataset should return splits in response body
      datasetSplits: datasetSelector?.splits ?? [],
      projectName,
      repetitions: experimentResponse.repetitions,
      metadata: experimentResponse.metadata || {},
      createdAt: experimentResponse.created_at,
      updatedAt: experimentResponse.updated_at,
      exampleCount: experimentResponse.example_count,
      successfulRunCount: experimentResponse.successful_run_count,
      failedRunCount: experimentResponse.failed_run_count,
      missingRunCount: experimentResponse.missing_run_count,
    };
    // Initialize the tracer, now that we have a project name
    const baseUrl = client.config.baseUrl;
    invariant(
      baseUrl,
      "Phoenix base URL not found. Please set PHOENIX_HOST or set baseUrl on the client."
    );

    provider = register({
      projectName,
      url: baseUrl,
      headers: client.config.headers
        ? toObjectHeaders(client.config.headers)
        : undefined,
      batch: useBatchSpanProcessor,
      diagLogLevel,
      global: setGlobalTracerProvider,
    });

    taskTracer = provider.getTracer(projectName);
  }
  if (!record) {
    logger.info(
      `🔧 Running experiment in readonly mode. Results will not be recorded.`
    );
  }

  if (!isDryRun && client.config.baseUrl) {
    const datasetUrl = getDatasetUrl({
      baseUrl: client.config.baseUrl,
      datasetId: dataset.id,
    });
    const datasetExperimentsUrl = getDatasetExperimentsUrl({
      baseUrl: client.config.baseUrl,
      datasetId: dataset.id,
    });
    const experimentUrl = getExperimentUrl({
      baseUrl: client.config.baseUrl,
      datasetId: dataset.id,
      experimentId: experiment.id,
    });

    logger.info(`📊 View dataset: ${datasetUrl}`);
    logger.info(`📺 View dataset experiments: ${datasetExperimentsUrl}`);
    logger.info(`🔗 View this experiment: ${experimentUrl}`);
  }

  logger.info(
    `🧪 Starting experiment "${experimentName || `<unnamed>`}" on dataset "${dataset.id}" with task "${task.name}" and ${evaluators?.length ?? 0} ${pluralize(
      "evaluator",
      evaluators?.length ?? 0
    )} and ${concurrency} concurrent runs`
  );

  const runs: Record<ExperimentRunID, ExperimentRun> = {};
  await runTaskWithExamples({
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
    tracer: taskTracer,
    repetitions,
  });
  logger.info(`✅ Task runs completed`);

  const ranExperiment: RanExperiment = {
    ...experiment,
    runs,
  };

  const { evaluationRuns } = await evaluateExperiment({
    experiment: ranExperiment,
    evaluators: evaluators ?? [],
    client,
    logger,
    concurrency,
    dryRun,
    tracerProvider: provider,
    diagLogLevel,
    useBatchSpanProcessor,
  });
  ranExperiment.evaluationRuns = evaluationRuns;

  logger.info(`✅ Experiment ${experiment.id} completed`);

  // Refresh experiment info from server to get updated counts (non-dry-run only)
  if (!isDryRun) {
    const updatedExperiment = await getExperimentInfo({
      client,
      experimentId: experiment.id,
    });
    // Update the experiment info with the latest from the server
    Object.assign(ranExperiment, updatedExperiment);
  }

  if (!isDryRun && client.config.baseUrl) {
    const experimentUrl = getExperimentUrl({
      baseUrl: client.config.baseUrl,
      datasetId: dataset.id,
      experimentId: experiment.id,
    });
    logger.info(`🔍 View results: ${experimentUrl}`);
  }

  return ranExperiment;
}

/**
 * Run a task against n examples in a dataset.
 */
function runTaskWithExamples({
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
  repetitions = 1,
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
  /** TraceProvider instance that will be used to create spans from task calls */
  tracer: Tracer;
  /** Number of repetitions per example */
  repetitions?: number;
}): Promise<void> {
  // Validate the input
  assert(
    isValidRepetitionParam(repetitions),
    "repetitions must be an integer greater than 0"
  );

  logger.info(`🔧 Running task "${task.name}" on dataset "${dataset.id}"`);
  const run = async ({
    example,
    repetitionNumber,
  }: {
    example: ExampleWithId;
    repetitionNumber: number;
  }) => {
    return tracer.startActiveSpan(`Task: ${task.name}`, async (span) => {
      logger.info(
        `🔧 Running task "${task.name}" on example "${example.id} of dataset "${dataset.id}"`
      );
      const traceId = span.spanContext().traceId;
      const thisRun: ExperimentRun = {
        id: localId(), // initialized with local id, will be replaced with server-assigned id when dry run is false
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
        thisRun.output = taskOutput;
      } catch (error) {
        thisRun.error =
          error instanceof Error ? error.message : "Unknown error";
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      thisRun.endTime = new Date();
      if (!isDryRun) {
        // Log the run to the server
        const res = await client.POST("/v1/experiments/{experiment_id}/runs", {
          params: {
            path: {
              experiment_id: experimentId,
            },
          },
          body: {
            dataset_example_id: example.id,
            output: thisRun.output,
            repetition_number: repetitionNumber,
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

  examplesToUse
    .flatMap((example) =>
      Array.from({ length: repetitions }, (_, index) => ({
        example,
        repetitionNumber: index + 1, // Repetitions start at 1
      }))
    )
    .forEach((exampleWithRepetition) =>
      q.push(exampleWithRepetition, (err) => {
        if (err) {
          logger.error(
            `Error running task "${task.name}" on example "${exampleWithRepetition.example.id}" repetition ${exampleWithRepetition.repetitionNumber}: ${err}`
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
  logger = console,
  concurrency = 5,
  dryRun = false,
  setGlobalTracerProvider = true,
  useBatchSpanProcessor = true,
  tracerProvider: paramsTracerProvider,
  diagLogLevel,
}: {
  /**
   * The experiment to evaluate
   **/
  experiment: RanExperiment;
  /** The evaluators to use */
  evaluators: Evaluator[];
  /** The client to use */
  client?: PhoenixClient;
  /** The logger to use */
  logger?: Logger;
  /** The number of evaluators to run in parallel */
  concurrency?: number;
  /**
   * Whether to run the evaluation as a dry run
   * If a number is provided, the evaluation will be run for the first n runs
   * @default false
   * */
  dryRun?: boolean | number;
  /**
   * Whether to set the global tracer provider when running the evaluators
   * @default true
   */
  setGlobalTracerProvider?: boolean;
  /**
   * Whether to use batching for the span processor.
   * @default true
   */
  useBatchSpanProcessor?: boolean;
  /**
   * The tracer provider to use. If set, the other parameters will be ignored and the passed tracer provider will get used
   * Intended as a pass-through from runExperiment
   */
  tracerProvider?: NodeTracerProvider | null;
  /**
   * Log level to set for the default DiagConsoleLogger when tracing.
   * Omit to disable default diag logging, or to bring your own.
   */
  diagLogLevel?: DiagLogLevel;
}): Promise<RanExperiment> {
  const isDryRun = typeof dryRun === "number" || dryRun === true;
  const client = _client ?? createClient();
  const baseUrl = client.config.baseUrl;
  invariant(
    baseUrl,
    "Phoenix base URL not found. Please set PHOENIX_HOST or set baseUrl on the client."
  );
  let provider: NodeTracerProvider;

  // Always allow changing of tracer providers
  if (paramsTracerProvider) {
    provider = paramsTracerProvider;
  } else if (!isDryRun) {
    provider = register({
      projectName: "evaluators",
      url: baseUrl,
      headers: client.config.headers
        ? toObjectHeaders(client.config.headers)
        : undefined,
      batch: useBatchSpanProcessor,
      diagLogLevel,
      global: setGlobalTracerProvider,
    });
  } else {
    provider = createNoOpProvider();
  }
  const tracer = isDryRun
    ? provider.getTracer("no-op")
    : provider.getTracer("evaluators");
  const nRuns =
    typeof dryRun === "number"
      ? Math.min(dryRun, Object.keys(experiment.runs).length)
      : Object.keys(experiment.runs).length;
  const dataset = await getDataset({
    dataset: {
      datasetId: experiment.datasetId,
      versionId: experiment.datasetVersionId,
      splits: experiment.datasetSplits,
    },
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

  if (!isDryRun && client.config.baseUrl) {
    const experimentUrl = getExperimentUrl({
      baseUrl: client.config.baseUrl,
      datasetId: experiment.datasetId,
      experimentId: experiment.id,
    });
    logger.info(`🔗 View experiment evaluation: ${experimentUrl}`);
  }
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
      return tracer.startActiveSpan(
        `Evaluation: ${evaluatorAndRun.evaluator.name}`,
        async (span) => {
          const evalResult = await runEvaluator({
            evaluator: evaluatorAndRun.evaluator,
            run: evaluatorAndRun.run,
            exampleCache: examplesById,
            onComplete: onEvaluationComplete,
            logger,
          });
          span.setAttributes({
            [SemanticConventions.OPENINFERENCE_SPAN_KIND]:
              OpenInferenceSpanKind.EVALUATOR,
            [SemanticConventions.INPUT_MIME_TYPE]: MimeType.JSON,
            [SemanticConventions.INPUT_VALUE]: ensureString({
              input: examplesById[evaluatorAndRun.run.datasetExampleId]?.input,
              output: evaluatorAndRun.run.output,
              expected:
                examplesById[evaluatorAndRun.run.datasetExampleId]?.output,
              metadata:
                examplesById[evaluatorAndRun.run.datasetExampleId]?.metadata,
            }),
            [SemanticConventions.OUTPUT_MIME_TYPE]: MimeType.JSON,
            [SemanticConventions.OUTPUT_VALUE]: ensureString(evalResult.result),
          });
          if (evalResult.error) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: evalResult.error,
            });
          } else {
            span.setStatus({ code: SpanStatusCode.OK });
          }
          if (evalResult.result) {
            span.setAttributes(objectAsAttributes(evalResult.result));
          }
          evalResult.traceId = span.spanContext().traceId;
          if (!isDryRun) {
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
          span.end();
          return evalResult;
        }
      );
    },
    concurrency
  );
  if (!evaluatorsAndRuns.length) {
    logger.info(`⛔ No evaluators to run`);
    return {
      ...experiment,
      evaluationRuns: [],
    };
  }
  evaluatorsAndRuns.forEach((evaluatorAndRun) =>
    evaluatorsQueue.push(evaluatorAndRun, (err) => {
      if (err) {
        logger.error(
          `❌ Error running evaluator "${evaluatorAndRun.evaluator.name}" on run "${evaluatorAndRun.run.id}": ${err}`
        );
      }
    })
  );
  await evaluatorsQueue.drain();
  logger.info(`✅ Evaluation runs completed`);

  if (provider) {
    await provider.shutdown();
    // Make sure it's not set globally anymore
    if (setGlobalTracerProvider) {
      trace.disable();
    }
  }

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
      id: localId(),
      traceId: null,
      experimentRunId: run.id,
      startTime: new Date(),
      endTime: new Date(), // will get replaced with actual end time
      name: evaluator.name,
      result: null,
      error: null,
      annotatorKind: evaluator.kind,
    };
    try {
      const result = await evaluator.evaluate({
        input: example.input,
        output: run.output ?? null,
        expected: example.output,
        metadata: example?.metadata,
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
 * @param params - The parameters for creating the evaluator
 * @param params.name - The name of the evaluator.
 * @param params.kind - The kind of evaluator (e.g., "CODE", "LLM")
 * @param params.evaluate - The evaluator function.
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

let _localIdIndex = 1000;

/**
 * Generate a local id.
 *
 * @returns A semi-unique id.
 */
function localId(): string {
  _localIdIndex++;
  return `local_${_localIdIndex}`;
}
