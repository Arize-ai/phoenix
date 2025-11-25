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
import { ExampleWithId } from "../types/datasets";
import type {
  ExperimentEvaluatorLike,
  ExperimentTask,
} from "../types/experiments";
import { type Logger } from "../types/logger";
import { Channel, ChannelError } from "../utils/channel";
import { ensureString } from "../utils/ensureString";
import { isHttpErrorWithStatus } from "../utils/isHttpError";
import { toObjectHeaders } from "../utils/toObjectHeaders";
import { getDatasetExperimentsUrl, getExperimentUrl } from "../utils/urlUtils";

import { getExperimentInfo } from "./getExperimentInfo.js";
import { resumeEvaluation } from "./resumeEvaluation";

import invariant from "tiny-invariant";

/**
 * Error thrown when task is aborted due to a failure in stopOnFirstError mode.
 * This provides semantic context that the abort was intentional, not an infrastructure failure.
 * @internal - Not exported to minimize API surface area
 */
class TaskAbortedError extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "TaskAbortedError";
    this.cause = cause;
  }
}

/**
 * Error thrown when the producer fails to fetch incomplete runs from the server.
 * This is a critical error that should always be surfaced, even in stopOnFirstError=false mode.
 * @internal - Not exported to minimize API surface area
 */
class TaskFetchError extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "TaskFetchError";
    this.cause = cause;
  }
}

export type ResumeExperimentParams = ClientFn & {
  /**
   * The ID of the experiment to resume
   */
  readonly experimentId: string;
  /**
   * The task to run on incomplete examples
   */
  readonly task: ExperimentTask;
  /**
   * Optional evaluators to run on completed task runs
   * @default undefined
   */
  readonly evaluators?: readonly ExperimentEvaluatorLike[];
  /**
   * The logger to use
   * @default console
   */
  readonly logger?: Logger;
  /**
   * The number of concurrent task executions
   * @default 5
   */
  readonly concurrency?: number;
  /**
   * Whether to set the global tracer provider when running the task.
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
   * Stop processing and exit as soon as any task fails.
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
 * Task item for the producer-consumer channel
 */
type TaskItem = {
  readonly example: ExampleWithId;
  readonly repetitionNumber: number;
};

/**
 * Transforms API incomplete run response to ExampleWithId
 */
function buildExampleFromApiResponse(
  apiExample: components["schemas"]["DatasetExample"]
): ExampleWithId {
  return {
    id: apiExample.id,
    input: apiExample.input,
    output: apiExample.output || null,
    metadata: apiExample.metadata || {},
    updatedAt: new Date(apiExample.updated_at),
  };
}

/**
 * Handles fetch errors with helpful version information for unsupported features
 */
async function handleFetchError(
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
 * Sets up OpenTelemetry tracer for experiment tracing
 */
function setupTracer({
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
 * Prints experiment summary to logger
 */
function printExperimentSummary({
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
  logger.info("📊 Experiment Resume Summary");
  logger.info("=".repeat(70));
  logger.info(`Experiment ID: ${experimentId}`);
  logger.info(`Incomplete runs processed: ${totalProcessed}`);
  logger.info(`Successfully completed: ${totalCompleted}`);
  logger.info("=".repeat(70));
}

/**
 * Resume an incomplete experiment by running only the missing or failed runs.
 *
 * This function identifies which (example, repetition) pairs have not been completed
 * (either missing or failed) and re-runs the task only for those pairs. Optionally,
 * evaluators can be run on the completed runs after task execution.
 *
 * The function processes incomplete runs in batches using pagination to minimize memory usage.
 *
 * @throws {Error} Throws different error types based on failure:
 *   - "TaskFetchError": Unable to fetch incomplete runs from the server.
 *     Always thrown regardless of stopOnFirstError, as it indicates critical infrastructure failure.
 *   - "TaskAbortedError": stopOnFirstError=true and a task failed.
 *     Original error preserved in `cause` property.
 *   - Generic Error: Other task execution errors or unexpected failures.
 *
 * @example
 * ```ts
 * import { resumeExperiment } from "@arizeai/phoenix-client/experiments";
 *
 * // Resume an interrupted experiment
 * try {
 *   await resumeExperiment({
 *     experimentId: "exp_123",
 *     task: myTask,
 *   });
 * } catch (error) {
 *   // Handle by error name (no instanceof needed)
 *   if (error.name === "TaskFetchError") {
 *     console.error("Failed to connect to server:", error.cause);
 *   } else if (error.name === "TaskAbortedError") {
 *     console.error("Task stopped due to error:", error.cause);
 *   } else {
 *     console.error("Unexpected error:", error);
 *   }
 * }
 *
 * // Resume with evaluators
 * await resumeExperiment({
 *   experimentId: "exp_123",
 *   task: myTask,
 *   evaluators: [correctnessEvaluator, relevanceEvaluator],
 * });
 *
 * // Stop on first error (useful for debugging)
 * await resumeExperiment({
 *   experimentId: "exp_123",
 *   task: myTask,
 *   stopOnFirstError: true, // Exit immediately on first task failure
 * });
 * ```
 */
export async function resumeExperiment({
  client: _client,
  experimentId,
  task,
  evaluators,
  logger = console,
  concurrency = 5,
  setGlobalTracerProvider = true,
  useBatchSpanProcessor = true,
  diagLogLevel,
  stopOnFirstError = false,
}: ResumeExperimentParams): Promise<void> {
  const client = _client ?? createClient();
  const pageSize = DEFAULT_PAGE_SIZE;

  // Get experiment info
  logger.info(`🔍 Fetching experiment info...`);
  const experiment = await getExperimentInfo({ client, experimentId });

  // Check if there are incomplete runs
  const totalExpected = experiment.exampleCount * experiment.repetitions;
  const incompleteCount = totalExpected - experiment.successfulRunCount;

  if (incompleteCount === 0) {
    logger.info("✅ No incomplete runs found. Experiment is already complete.");
    return;
  }

  logger.info(
    `🧪 Resuming experiment with ${incompleteCount} incomplete runs...`
  );

  // Get base URL for tracing and URL generation
  const baseUrl = client.config.baseUrl;
  invariant(
    baseUrl,
    "Phoenix base URL not found. Please set PHOENIX_HOST or set baseUrl on the client."
  );

  // Initialize tracer (only if experiment has a project_name)
  const tracerSetup = setupTracer({
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
  const taskTracer = tracerSetup?.tracer ?? null;

  // Display URLs
  const datasetExperimentsUrl = getDatasetExperimentsUrl({
    baseUrl,
    datasetId: experiment.datasetId,
  });
  const experimentUrl = getExperimentUrl({
    baseUrl,
    datasetId: experiment.datasetId,
    experimentId: experiment.id,
  });

  logger.info(`📺 View dataset experiments: ${datasetExperimentsUrl}`);
  logger.info(`🔗 View this experiment: ${experimentUrl}`);

  // Create a CSP-style bounded buffer for task distribution
  const taskChannel = new Channel<TaskItem>(
    pageSize * CHANNEL_CAPACITY_MULTIPLIER
  );

  // Abort controller for stopOnFirstError coordination
  const abortController = new AbortController();
  const { signal } = abortController;

  let totalProcessed = 0;
  let totalCompleted = 0;
  let totalFailed = 0;

  // Producer: Fetch incomplete runs and send to channel
  async function fetchIncompleteRuns(): Promise<void> {
    let cursor: string | null = null;

    try {
      do {
        // Stop fetching if abort signal received
        if (signal.aborted) {
          logger.info("🛑 Stopping fetch due to error in task");
          break;
        }

        let res: {
          data?: components["schemas"]["GetIncompleteExperimentRunsResponseBody"];
        };

        try {
          res = await client.GET(
            "/v1/experiments/{experiment_id}/incomplete-runs",
            {
              params: {
                path: {
                  experiment_id: experimentId,
                },
                query: {
                  cursor,
                  limit: pageSize,
                },
              },
            }
          );
        } catch (error: unknown) {
          // Check for version compatibility issues and throw helpful error
          try {
            await handleFetchError(error, client, "resume_experiment");
            // TypeScript: handleFetchError never returns, but add throw for safety
            throw new Error("handleFetchError should never return");
          } catch (handledError) {
            // Wrap the error (from handleFetchError or original) in semantic error type
            throw new TaskFetchError(
              "Failed to fetch incomplete runs from server",
              handledError instanceof Error ? handledError : undefined
            );
          }
        }

        cursor = res.data?.next_cursor ?? null;
        const batchIncomplete = res.data?.data;
        invariant(batchIncomplete, "Failed to fetch incomplete runs");

        if (batchIncomplete.length === 0) {
          break;
        }

        // Send tasks to channel (blocks if channel is full - natural backpressure!)
        let batchCount = 0;
        for (const incomplete of batchIncomplete) {
          // Stop sending items if abort signal received
          if (signal.aborted) {
            break;
          }

          const example = buildExampleFromApiResponse(
            incomplete.dataset_example
          );
          for (const repNum of incomplete.repetition_numbers) {
            // Stop sending items if abort signal received
            if (signal.aborted) {
              break;
            }

            await taskChannel.send({ example, repetitionNumber: repNum });
            batchCount++;
            totalProcessed++;
          }
        }

        logger.info(
          `Fetched batch of ${batchCount} incomplete runs (channel buffer: ${taskChannel.length})`
        );
      } while (cursor !== null && !signal.aborted);
    } catch (error) {
      // Re-throw with context preservation
      if (error instanceof TaskFetchError) {
        throw error;
      }
      // ChannelError from blocked send() should bubble up naturally
      // (happens when channel closes while producer is blocked)
      if (error instanceof ChannelError) {
        throw error;
      }
      // Wrap any unexpected errors from channel operations
      throw new TaskFetchError(
        "Unexpected error during task fetch",
        error instanceof Error ? error : undefined
      );
    } finally {
      taskChannel.close(); // Signal workers we're done
    }
  }

  // Worker: Process tasks from channel
  async function processTasksFromChannel(): Promise<void> {
    for await (const item of taskChannel) {
      // Stop processing if abort signal received
      if (signal.aborted) {
        break;
      }

      try {
        await runSingleTask({
          client,
          experimentId,
          task,
          example: item.example,
          repetitionNumber: item.repetitionNumber,
          tracer: taskTracer,
        });
        totalCompleted++;
      } catch (error) {
        totalFailed++;
        logger.error(
          `Failed to run task for example ${item.example.id}, repetition ${item.repetitionNumber}: ${error}`
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
  // Wrap in try-finally to ensure channel is always closed, even if Promise.all throws
  let executionError: Error | null = null;
  try {
    const producerTask = fetchIncompleteRuns();
    const workerTasks = Array.from({ length: concurrency }, () =>
      processTasksFromChannel()
    );

    // Wait for producer and all workers to finish
    await Promise.all([producerTask, ...workerTasks]);
  } catch (error) {
    // Classify and handle errors based on their nature
    const err = error instanceof Error ? error : new Error(String(error));

    // Always surface producer/infrastructure errors
    if (error instanceof TaskFetchError) {
      // Producer failed - this is ALWAYS critical regardless of stopOnFirstError
      logger.error(`❌ Critical: Failed to fetch incomplete runs from server`);
      executionError = err;
    } else if (error instanceof ChannelError && signal.aborted) {
      // Channel closed due to intentional abort - wrap in semantic error
      executionError = new TaskAbortedError(
        "Task execution stopped due to error in concurrent worker",
        err
      );
    } else if (stopOnFirstError) {
      // Worker error in stopOnFirstError mode - already logged by worker
      executionError = err;
    } else {
      // Unexpected error (not from worker, not from producer fetch)
      // This could be a bug in our code or infrastructure failure
      logger.error(`❌ Unexpected error during task execution: ${err.message}`);
      executionError = err;
    }
  } finally {
    // Ensure channel is closed even if there are unexpected errors
    // This is a safety net in case producer's finally block didn't execute
    if (!taskChannel.isClosed) {
      taskChannel.close();
    }
  }

  // Only show completion message if we didn't stop on error
  if (!executionError) {
    logger.info(`✅ Task runs completed.`);
  }

  if (totalFailed > 0 && !executionError) {
    logger.info(
      `⚠️  Warning: ${totalFailed} out of ${totalProcessed} runs failed.`
    );
  }

  // Run evaluators if provided (only on runs missing evaluations)
  // Skip evaluators if we stopped on error
  if (evaluators && evaluators.length > 0 && !executionError) {
    logger.info(`\n🔬 Running evaluators...`);
    await resumeEvaluation({
      experimentId,
      evaluators: [...evaluators],
      client,
      logger,
      concurrency,
      setGlobalTracerProvider,
      useBatchSpanProcessor,
      diagLogLevel,
      stopOnFirstError,
    });
  }

  // Print summary
  printExperimentSummary({
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
 * Record task result to API (without executing the task).
 */
async function recordTaskResult({
  client,
  experimentId,
  example,
  repetitionNumber,
  output,
  error,
  startTime,
  endTime,
  traceId = null,
}: {
  readonly client: PhoenixClient;
  readonly experimentId: string;
  readonly example: ExampleWithId;
  readonly repetitionNumber: number;
  readonly output: unknown;
  readonly error?: string;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly traceId?: string | null;
}): Promise<void> {
  try {
    await client.POST("/v1/experiments/{experiment_id}/runs", {
      params: {
        path: {
          experiment_id: experimentId,
        },
      },
      body: {
        dataset_example_id: example.id,
        repetition_number: repetitionNumber,
        output: output as Record<string, unknown>,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        error: error ? ensureString(error) : undefined,
        trace_id: traceId,
      },
    });
  } catch (err: unknown) {
    // Ignore 409 Conflict - result already exists (idempotency)
    if (isHttpErrorWithStatus(err, 409)) {
      return;
    }
    throw err; // Re-throw other errors
  }
}

/**
 * Run a single task and record the result with optional tracing.
 */
async function runSingleTask({
  client,
  experimentId,
  task,
  example,
  repetitionNumber,
  tracer,
}: {
  readonly client: PhoenixClient;
  readonly experimentId: string;
  readonly task: ExperimentTask;
  readonly example: ExampleWithId;
  readonly repetitionNumber: number;
  readonly tracer: Tracer | null;
}): Promise<void> {
  const startTime = new Date();

  // If no tracer (no project_name), execute without tracing
  if (!tracer) {
    let output: unknown = null; // Initialize to null for failed tasks
    let error: string | undefined;

    try {
      output = await Promise.resolve(task(example));
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const endTime = new Date();
      await recordTaskResult({
        client,
        experimentId,
        example,
        repetitionNumber,
        output,
        error,
        startTime,
        endTime,
      });
    }
    return;
  }

  // With tracer: wrap execution in a span for observability
  return tracer.startActiveSpan(
    `Task: ${task.name || "anonymous"}`,
    async (span) => {
      // Set span attributes
      span.setAttributes({
        [SemanticConventions.OPENINFERENCE_SPAN_KIND]:
          OpenInferenceSpanKind.CHAIN,
        [SemanticConventions.INPUT_VALUE]: ensureString(example.input),
        [SemanticConventions.INPUT_MIME_TYPE]: MimeType.JSON,
        ...objectAsAttributes({
          experiment_id: experimentId,
          dataset_example_id: example.id,
          repetition_number: repetitionNumber,
        }),
      });

      let output: unknown = null; // Initialize to null for failed tasks
      let error: string | undefined;

      try {
        // Execute the task (only once!)
        output = await Promise.resolve(task(example));

        // Set output attributes
        span.setAttributes({
          [SemanticConventions.OUTPUT_VALUE]: ensureString(output),
          [SemanticConventions.OUTPUT_MIME_TYPE]: MimeType.JSON,
        });
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

        // Record result to API
        await recordTaskResult({
          client,
          experimentId,
          example,
          repetitionNumber,
          output,
          error,
          startTime,
          endTime,
          traceId: span.spanContext().traceId,
        });
      }
    }
  );
}
