import {
  MimeType,
  OpenInferenceSpanKind,
  SemanticConventions,
} from "@arizeai/openinference-semantic-conventions";
import {
  type DiagLogLevel,
  NodeTracerProvider,
  objectAsAttributes,
  register,
  SpanStatusCode,
  Tracer,
} from "@arizeai/phoenix-otel";

import { components } from "../__generated__/api/v1";
import { createClient, type PhoenixClient } from "../client";
import { ClientFn } from "../types/core";
import type {
  Evaluator,
  IncompleteEvaluation,
  SingleEvaluationResult,
  TaskOutput,
} from "../types/experiments";
import { type Logger } from "../types/logger";
import { Channel } from "../utils/channel";
import { ensureString } from "../utils/ensureString";
import { toObjectHeaders } from "../utils/toObjectHeaders";

import { getExperimentInfo } from "./getExperimentInfo.js";

import invariant from "tiny-invariant";

export type ResumeEvaluationParams = ClientFn & {
  /**
   * The ID of the experiment to resume evaluations for
   */
  readonly experimentId: string;
  /**
   * A single evaluator or list of evaluators to run on incomplete evaluations
   */
  readonly evaluators: Evaluator | readonly Evaluator[];
  /**
   * List of evaluation names to check for incomplete evaluations.
   * Use this when a single evaluator produces multiple evaluations whose names
   * are determined at runtime. When specified, only one evaluator is allowed,
   * and it will run for any experiment run missing any of the specified evaluations.
   * If not provided, evaluation names are matched to evaluator names.
   * @default undefined
   */
  readonly evaluationNames?: readonly string[];
  /**
   * The logger to use
   * @default console
   */
  readonly logger?: Logger;
  /**
   * The number of concurrent evaluation executions
   * @default 5
   */
  readonly concurrency?: number;
  /**
   * The pagination size by which to pull incomplete evaluations
   * @default 50
   */
  readonly pageSize?: number;
  /**
   * Whether to set the global tracer provider when running evaluators.
   * @default true
   */
  readonly setGlobalTracerProvider?: boolean;
  /**
   * Whether to use batch span processor for tracing.
   * @default true
   */
  readonly useBatchSpanProcessor?: boolean;
  /**
   * Log level to set for the default DiagConsoleLogger when tracing.
   */
  readonly diagLogLevel?: DiagLogLevel;
  /**
   * Stop processing and exit as soon as any evaluation fails.
   * @default false
   */
  readonly stopOnFirstError?: boolean;
};

const DEFAULT_PAGE_SIZE = 50 as const;
/**
 * Channel capacity multiplier for producer-consumer buffering.
 * A value of 2 enables pipeline efficiency: workers process batch N while
 * the producer fetches batch N+1, eliminating idle time without excessive
 * memory usage. The channel blocks when full, providing natural backpressure.
 */
const CHANNEL_CAPACITY_MULTIPLIER = 2 as const;

/**
 * Evaluation item for the producer-consumer channel
 */
type EvalItem = {
  readonly incompleteEval: IncompleteEvaluation;
  readonly evaluator: Evaluator;
};

/**
 * Transforms API incomplete evaluation response to IncompleteEvaluation
 */
function buildIncompleteEvaluation(
  apiResponse: components["schemas"]["IncompleteExperimentEvaluation"]
): IncompleteEvaluation {
  return {
    experimentRun: {
      id: apiResponse.experiment_run.id,
      experimentId: apiResponse.experiment_run.experiment_id,
      datasetExampleId: apiResponse.experiment_run.dataset_example_id,
      output: apiResponse.experiment_run.output ?? null,
      startTime: new Date(apiResponse.experiment_run.start_time),
      endTime: new Date(apiResponse.experiment_run.end_time),
      error: apiResponse.experiment_run.error ?? null,
      traceId: apiResponse.experiment_run.trace_id ?? null,
    },
    datasetExample: {
      id: apiResponse.dataset_example.id,
      input: apiResponse.dataset_example.input,
      output: apiResponse.dataset_example.output ?? null,
      metadata: apiResponse.dataset_example.metadata || {},
      updatedAt: new Date(apiResponse.dataset_example.updated_at),
    },
    evaluationNames: apiResponse.evaluation_names,
  };
}

/**
 * Determines if an evaluator should run for an incomplete evaluation
 */
function shouldRunEvaluator(
  evaluator: Evaluator,
  incompleteEval: IncompleteEvaluation,
  evaluationNames?: readonly string[]
): boolean {
  if (evaluationNames) {
    // If evaluationNames is specified, run the evaluator if any of its evaluations are incomplete
    return evaluationNames.some((name) =>
      incompleteEval.evaluationNames.includes(name)
    );
  }
  // Otherwise, match evaluator name directly
  return incompleteEval.evaluationNames.includes(evaluator.name);
}

/**
 * Gets the expected evaluation names for a specific evaluator run
 */
function getExpectedEvaluationNames(
  evaluator: Evaluator,
  incompleteEval: IncompleteEvaluation,
  evaluationNames?: readonly string[]
): readonly string[] {
  if (evaluationNames) {
    // Multi-output: evaluator produces all specified evaluation names
    return evaluationNames.filter((name) =>
      incompleteEval.evaluationNames.includes(name)
    );
  }
  // Single-output: evaluator only produces its own name
  return incompleteEval.evaluationNames.includes(evaluator.name)
    ? [evaluator.name]
    : [];
}

/**
 * Handles fetch errors with helpful version information for unsupported features
 */
async function handleEvaluationFetchError(
  error: unknown,
  client: PhoenixClient,
  featureName: string
): Promise<never> {
  // Check if this is a JSON parse error (likely 404 HTML response from old server)
  const isJsonError =
    error instanceof SyntaxError &&
    error.message.toLowerCase().includes("json");

  if (isJsonError) {
    // Fetch server version to provide helpful context
    let versionInfo = "";
    try {
      const baseUrl = client.config.baseUrl || "";
      const versionRes = await fetch(`${baseUrl}/arize_phoenix_version`);
      if (versionRes.ok) {
        const version = await versionRes.text();
        versionInfo = ` Your current server version is ${version}.`;
      }
    } catch {
      // Ignore errors fetching version
    }

    throw new Error(
      `The ${featureName} feature is not available on this Phoenix server. ` +
        "Please upgrade your Phoenix server to use this feature." +
        versionInfo
    );
  }
  throw error;
}

/**
 * Sets up OpenTelemetry tracer for evaluation tracing
 */
function setupEvaluationTracer({
  projectName,
  baseUrl,
  headers,
  useBatchSpanProcessor,
  diagLogLevel,
  setGlobalTracerProvider,
}: {
  projectName: string | null;
  baseUrl: string;
  headers?: Record<string, string>;
  useBatchSpanProcessor: boolean;
  diagLogLevel?: DiagLogLevel;
  setGlobalTracerProvider: boolean;
}): { provider: NodeTracerProvider; tracer: Tracer } | null {
  if (!projectName) {
    return null;
  }

  const provider = register({
    projectName,
    url: baseUrl,
    headers,
    batch: useBatchSpanProcessor,
    diagLogLevel,
    global: setGlobalTracerProvider,
  });

  const tracer = provider.getTracer(projectName);
  return { provider, tracer };
}

/**
 * Prints evaluation summary to logger
 */
function printEvaluationSummary({
  logger,
  experimentId,
  totalProcessed,
  totalCompleted,
}: {
  logger: Logger;
  experimentId: string;
  totalProcessed: number;
  totalCompleted: number;
}): void {
  logger.info("\n" + "=".repeat(70));
  logger.info("📊 Evaluation Resume Summary");
  logger.info("=".repeat(70));
  logger.info(`Experiment ID: ${experimentId}`);
  logger.info(`Runs processed: ${totalProcessed}`);
  logger.info(`Evaluations completed: ${totalCompleted}`);
  logger.info("=".repeat(70));
}

/**
 * Resume incomplete evaluations for an experiment.
 *
 * This function identifies which evaluations have not been completed (either missing or failed)
 * and runs the evaluators only for those runs. This is useful for:
 * - Recovering from transient evaluator failures
 * - Adding new evaluators to completed experiments
 * - Completing partially evaluated experiments
 *
 * The function processes incomplete evaluations in batches using pagination to minimize memory usage.
 *
 * By default, evaluation names are matched to evaluator names. For example, if you pass
 * an evaluator with name "accuracy", it will check for and resume any runs missing the "accuracy" evaluation.
 *
 * For multi-output evaluators that produce multiple evaluations with names generated at runtime
 * (not known upfront), use `evaluationNames` to explicitly specify which evaluation names to check
 * for incomplete runs. When using `evaluationNames`, only one evaluator is allowed.
 *
 * @example
 * ```ts
 * import { resumeEvaluation } from "@arizeai/phoenix-client/experiments";
 *
 * // Standard usage: evaluation name matches evaluator name
 * await resumeEvaluation({
 *   experimentId: "exp_123",
 *   evaluators: [{
 *     name: "correctness",
 *     kind: "CODE",
 *     evaluate: async ({ output, expected }) => ({
 *       score: output === expected ? 1 : 0
 *     })
 *   }],
 * });
 *
 * // Stop on first error (useful for debugging)
 * await resumeEvaluation({
 *   experimentId: "exp_123",
 *   evaluators: [myEvaluator],
 *   stopOnFirstError: true, // Exit immediately on first failure
 * });
 *
 * // Multi-output evaluator with runtime-generated names
 * await resumeEvaluation({
 *   experimentId: "exp_123",
 *   evaluators: [{
 *     name: "llm_judge",
 *     kind: "LLM",
 *     evaluate: async ({ output, expected }) => {
 *       // This evaluator produces multiple evaluations with their own names
 *       return [
 *         { name: "coherence", score: 0.95 },
 *         { name: "relevance", score: 0.85 },
 *         { name: "helpfulness", score: 0.92 },
 *       ];
 *     }
 *   }],
 *   // Specify which evaluation names to check for incomplete runs
 *   evaluationNames: ["coherence", "relevance", "helpfulness"],
 * });
 * ```
 */
export async function resumeEvaluation({
  client: _client,
  experimentId,
  evaluators: _evaluators,
  evaluationNames,
  logger = console,
  concurrency = 5,
  pageSize = DEFAULT_PAGE_SIZE,
  setGlobalTracerProvider = true,
  useBatchSpanProcessor = true,
  diagLogLevel,
  stopOnFirstError = false,
}: ResumeEvaluationParams): Promise<void> {
  const client = _client ?? createClient();

  // Normalize evaluators to array
  const evaluators = Array.isArray(_evaluators) ? _evaluators : [_evaluators];

  // Validate inputs
  invariant(evaluators.length > 0, "Must specify at least one evaluator");
  invariant(
    Number.isInteger(pageSize) && pageSize > 0,
    "pageSize must be a positive integer greater than 0"
  );

  // If evaluation_names is specified, only allow one evaluator
  if (evaluationNames && evaluators.length > 1) {
    throw new Error(
      "When evaluationNames is specified, only one evaluator is allowed. " +
        "The evaluator should produce multiple evaluations with the specified names."
    );
  }

  // Get experiment info
  logger.info(`🔍 Checking for incomplete evaluations...`);
  const experiment = await getExperimentInfo({ client, experimentId });

  // Initialize tracer (only if experiment has a project_name)
  const baseUrl = client.config.baseUrl;
  invariant(
    baseUrl,
    "Phoenix base URL not found. Please set PHOENIX_HOST or set baseUrl on the client."
  );

  const tracerSetup = setupEvaluationTracer({
    projectName: experiment.projectName,
    baseUrl,
    headers: client.config.headers
      ? toObjectHeaders(client.config.headers)
      : undefined,
    useBatchSpanProcessor,
    diagLogLevel,
    setGlobalTracerProvider,
  });

  const provider = tracerSetup?.provider ?? null;
  const evalTracer = tracerSetup?.tracer ?? null;

  // Build evaluation names list for query
  // Use provided evaluationNames if available, otherwise derive from evaluators
  const evaluationNamesList = evaluationNames
    ? [...evaluationNames]
    : evaluators.map((e) => e.name);

  // Create a CSP-style bounded buffer for evaluation distribution
  const evalChannel = new Channel<EvalItem>(
    pageSize * CHANNEL_CAPACITY_MULTIPLIER
  );

  // Abort controller for stopOnFirstError coordination
  const abortController = new AbortController();
  const { signal } = abortController;

  let totalProcessed = 0;
  let totalCompleted = 0;
  let totalFailed = 0;

  // Producer: Fetch incomplete evaluations and send to channel
  async function fetchIncompleteEvaluations(): Promise<void> {
    let cursor: string | null = null;

    try {
      do {
        // Stop fetching if abort signal received
        if (signal.aborted) {
          logger.info("🛑 Stopping fetch due to error in evaluation");
          break;
        }

        let res: {
          data?: components["schemas"]["GetIncompleteEvaluationsResponseBody"];
          error?: unknown;
        };

        try {
          res = await client.GET(
            "/v1/experiments/{experiment_id}/incomplete-evaluations",
            {
              params: {
                path: {
                  experiment_id: experimentId,
                },
                query: {
                  cursor,
                  limit: pageSize,
                  evaluation_name: evaluationNamesList,
                },
              },
            }
          );
        } catch (error: unknown) {
          await handleEvaluationFetchError(error, client, "resume_evaluation");
          throw error; // TypeScript needs this to know execution doesn't continue
        }

        // Check for API errors
        if (res.error) {
          throw new Error(
            `Failed to fetch incomplete evaluations: ${JSON.stringify(res.error)}`
          );
        }

        cursor = res.data?.next_cursor ?? null;
        const batchIncomplete = res.data?.data;
        invariant(batchIncomplete, "Failed to fetch incomplete evaluations");

        if (batchIncomplete.length === 0) {
          if (totalProcessed === 0) {
            logger.info(
              "✅ No incomplete evaluations found. All evaluations are complete."
            );
          }
          break;
        }

        if (totalProcessed === 0) {
          logger.info("🧠 Resuming evaluations...");
        }

        // Build evaluation tasks and send to channel
        let batchCount = 0;
        for (const incomplete of batchIncomplete) {
          // Stop sending items if abort signal received
          if (signal.aborted) {
            break;
          }

          const incompleteEval = buildIncompleteEvaluation(incomplete);

          const evaluatorsToRun = evaluators.filter((evaluator) =>
            shouldRunEvaluator(evaluator, incompleteEval, evaluationNames)
          );

          // Flatten: Send one channel item per evaluator
          for (const evaluator of evaluatorsToRun) {
            // Stop sending items if abort signal received
            if (signal.aborted) {
              break;
            }

            await evalChannel.send({ incompleteEval, evaluator });
            batchCount++;
            totalProcessed++;
          }
        }

        logger.info(
          `Fetched batch of ${batchCount} evaluation tasks (channel buffer: ${evalChannel.length})`
        );
      } while (cursor !== null && !signal.aborted);
    } finally {
      evalChannel.close(); // Signal workers we're done
    }
  }

  // Worker: Process evaluations from channel
  async function processEvaluationsFromChannel(): Promise<void> {
    for await (const item of evalChannel) {
      // Stop processing if abort signal received
      if (signal.aborted) {
        break;
      }

      const expectedEvaluationNames = getExpectedEvaluationNames(
        item.evaluator,
        item.incompleteEval,
        evaluationNames
      );

      try {
        await runSingleEvaluation({
          client,
          experimentId,
          evaluator: item.evaluator,
          experimentRun: item.incompleteEval.experimentRun,
          datasetExample: item.incompleteEval.datasetExample,
          expectedEvaluationNames,
          tracer: evalTracer,
        });
        totalCompleted++;
      } catch (error) {
        totalFailed++;
        logger.error(
          `Failed to run evaluator "${item.evaluator.name}" for run ${item.incompleteEval.experimentRun.id}: ${error}`
        );

        // If stopOnFirstError is enabled, abort and re-throw
        if (stopOnFirstError) {
          logger.error("🛑 Stopping on first error");
          abortController.abort();
          throw error;
        }
      }
    }
  }

  // Start concurrent execution
  const producerTask = fetchIncompleteEvaluations();
  const workerTasks = Array.from({ length: concurrency }, () =>
    processEvaluationsFromChannel()
  );

  // Wait for producer and all workers to finish
  let executionError: Error | null = null;
  try {
    await Promise.all([producerTask, ...workerTasks]);
  } catch (error) {
    if (stopOnFirstError) {
      executionError =
        error instanceof Error ? error : new Error(String(error));
    }
    // If not stopOnFirstError, errors were already logged by workers
  }

  // Only show completion message if we didn't stop on error
  if (!executionError) {
    logger.info(`✅ Evaluations completed.`);
  }

  if (totalFailed > 0 && !executionError) {
    logger.info(
      `⚠️  Warning: ${totalFailed} out of ${totalProcessed} evaluations failed.`
    );
  }

  // Print summary
  printEvaluationSummary({
    logger,
    experimentId: experiment.id,
    totalProcessed,
    totalCompleted,
  });

  // Flush spans (if tracer was initialized)
  if (provider) {
    await provider.forceFlush();
  }

  // Re-throw error if stopOnFirstError was triggered
  if (executionError) {
    throw executionError;
  }
}

/**
 * Record evaluation results to API.
 */
async function recordEvaluationResults({
  client,
  evaluator,
  experimentRun,
  results,
  expectedEvaluationNames,
  error,
  startTime,
  endTime,
  traceId = null,
}: {
  readonly client: PhoenixClient;
  readonly evaluator: Evaluator;
  readonly experimentRun: IncompleteEvaluation["experimentRun"];
  readonly results?: readonly SingleEvaluationResult[];
  readonly expectedEvaluationNames: readonly string[];
  readonly error?: string;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly traceId?: string | null;
}): Promise<void> {
  if (results) {
    // Success case: record each evaluation result
    for (const singleResult of results) {
      const evaluationName = singleResult.name ?? evaluator.name;

      try {
        await client.POST("/v1/experiment_evaluations", {
          body: {
            experiment_run_id: experimentRun.id,
            name: evaluationName,
            annotator_kind: evaluator.kind,
            result: {
              score: singleResult.score ?? null,
              label: singleResult.label ?? null,
              explanation: singleResult.explanation ?? null,
              metadata: singleResult.metadata ?? {},
            },
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            error: null,
            trace_id: traceId,
          },
        });
      } catch (err: unknown) {
        // Ignore 409 Conflict - evaluation already exists
        const error = err as { response?: { status?: number } };
        if (error.response?.status === 409) {
          continue; // Silently ignore - evaluation already recorded
        }
        throw err; // Re-throw other errors
      }
    }
  } else if (error) {
    // Error case: record failed evaluation for EACH expected evaluation name
    for (const evaluationName of expectedEvaluationNames) {
      try {
        await client.POST("/v1/experiment_evaluations", {
          body: {
            experiment_run_id: experimentRun.id,
            name: evaluationName,
            annotator_kind: evaluator.kind,
            result: null,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            error,
            trace_id: traceId,
          },
        });
      } catch (err: unknown) {
        // Ignore 409 Conflict - evaluation already exists (e.g., from previous partial run)
        const error = err as { response?: { status?: number } };
        if (error.response?.status === 409) {
          continue; // Silently ignore - evaluation already recorded
        }
        throw err; // Re-throw other errors
      }
    }
  }
}

/**
 * Run a single evaluation and record the result(s).
 * Handles both single and multi-output evaluators.
 */
async function runSingleEvaluation({
  client,
  experimentId,
  evaluator,
  experimentRun,
  datasetExample,
  expectedEvaluationNames,
  tracer,
}: {
  readonly client: PhoenixClient;
  readonly experimentId: string;
  readonly evaluator: Evaluator;
  readonly experimentRun: IncompleteEvaluation["experimentRun"];
  readonly datasetExample: IncompleteEvaluation["datasetExample"];
  readonly expectedEvaluationNames: readonly string[];
  readonly tracer: Tracer | null;
}): Promise<void> {
  const startTime = new Date();

  // Prepare evaluator inputs
  const taskOutput: TaskOutput = experimentRun.output ?? null;
  const expectedOutput = datasetExample.output ?? undefined;

  // If no tracer (no project_name), execute without tracing
  if (!tracer) {
    let results: readonly SingleEvaluationResult[] | undefined;
    let error: string | undefined;

    try {
      const result = await Promise.resolve(
        evaluator.evaluate({
          input: datasetExample.input,
          output: taskOutput,
          expected: expectedOutput,
          metadata: datasetExample.metadata,
        })
      );
      results = Array.isArray(result) ? result : [result];
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const endTime = new Date();
      await recordEvaluationResults({
        client,
        evaluator,
        experimentRun,
        results,
        expectedEvaluationNames,
        error,
        startTime,
        endTime,
      });
    }
    return;
  }

  // With tracer: wrap execution in a span for observability
  return tracer.startActiveSpan(
    `Evaluation: ${evaluator.name}`,
    async (span) => {
      // Set span attributes for input
      span.setAttributes({
        [SemanticConventions.OPENINFERENCE_SPAN_KIND]:
          OpenInferenceSpanKind.EVALUATOR,
        [SemanticConventions.INPUT_MIME_TYPE]: MimeType.JSON,
        [SemanticConventions.INPUT_VALUE]: JSON.stringify({
          input: datasetExample.input,
          output: experimentRun.output,
          expected: datasetExample.output,
          metadata: datasetExample.metadata,
        }),
        ...objectAsAttributes({
          experiment_id: experimentId,
          experiment_run_id: experimentRun.id,
          dataset_example_id: datasetExample.id,
        }),
      });

      let results: readonly SingleEvaluationResult[] | undefined;
      let error: string | undefined;

      try {
        // Execute the evaluator (only once!)
        const result = await Promise.resolve(
          evaluator.evaluate({
            input: datasetExample.input,
            output: taskOutput,
            expected: expectedOutput,
            metadata: datasetExample.metadata,
          })
        );

        results = Array.isArray(result) ? result : [result];

        // Set output span attributes
        span.setAttributes({
          [SemanticConventions.OUTPUT_MIME_TYPE]: MimeType.JSON,
          [SemanticConventions.OUTPUT_VALUE]: ensureString(result),
        });

        // Set attributes from first result for span metadata
        if (results[0]) {
          span.setAttributes(objectAsAttributes(results[0]));
        }

        span.setStatus({ code: SpanStatusCode.OK });
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error,
        });
        span.recordException(err as Error);

        throw err;
      } finally {
        const endTime = new Date();
        span.end();

        // Record results to API
        await recordEvaluationResults({
          client,
          evaluator,
          experimentRun,
          results,
          expectedEvaluationNames,
          error,
          startTime,
          endTime,
          traceId: span.spanContext().traceId,
        });
      }
    }
  );
}
