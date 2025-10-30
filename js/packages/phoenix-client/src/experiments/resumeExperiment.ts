import invariant from "tiny-invariant";
import { createClient, type PhoenixClient } from "../client";
import { ClientFn } from "../types/core";
import type { Evaluator, ExperimentTask } from "../types/experiments";
import { type Logger } from "../types/logger";
import { getExperimentInfo } from "./getExperimentInfo.js";
import { components } from "../__generated__/api/v1";
import { ExampleWithId } from "../types/datasets";
import {
  type DiagLogLevel,
  SpanStatusCode,
  Tracer,
  NodeTracerProvider,
  objectAsAttributes,
  register,
} from "@arizeai/phoenix-otel";
import {
  MimeType,
  OpenInferenceSpanKind,
  SemanticConventions,
} from "@arizeai/openinference-semantic-conventions";
import { ensureString } from "../utils/ensureString";
import { getDatasetExperimentsUrl, getExperimentUrl } from "../utils/urlUtils";
import { toObjectHeaders } from "../utils/toObjectHeaders";
import { Channel } from "../utils/channel";
import { resumeEvaluation } from "./resumeEvaluation";

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
  readonly evaluators?: readonly Evaluator[];
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
   * The pagination size by which to pull incomplete runs
   * @default 50
   */
  readonly pageSize?: number;
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
 * @example
 * ```ts
 * import { resumeExperiment } from "@arizeai/phoenix-client/experiments";
 *
 * // Resume an interrupted experiment
 * await resumeExperiment({
 *   experimentId: "exp_123",
 *   task: myTask,
 * });
 *
 * // Resume with evaluators
 * await resumeExperiment({
 *   experimentId: "exp_123",
 *   task: myTask,
 *   evaluators: [correctnessEvaluator, relevanceEvaluator],
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
  pageSize = DEFAULT_PAGE_SIZE,
}: ResumeExperimentParams): Promise<void> {
  const client = _client ?? createClient();

  // Validate pageSize
  invariant(
    Number.isInteger(pageSize) && pageSize > 0,
    "pageSize must be a positive integer greater than 0"
  );

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

  let totalProcessed = 0;
  let totalCompleted = 0;
  let totalFailed = 0;

  // Producer: Fetch incomplete runs and send to channel
  async function fetchIncompleteRuns(): Promise<void> {
    let cursor: string | null = null;

    try {
      do {
        let res: {
          data?: components["schemas"]["GetIncompleteRunsResponseBody"];
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
          await handleFetchError(error, client, "resume_experiment");
          throw error; // TypeScript needs this to know execution doesn't continue
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
          const example = buildExampleFromApiResponse(
            incomplete.dataset_example
          );
          for (const repNum of incomplete.repetition_numbers) {
            await taskChannel.send({ example, repetitionNumber: repNum });
            batchCount++;
            totalProcessed++;
          }
        }

        logger.info(
          `Fetched batch of ${batchCount} incomplete runs (channel buffer: ${taskChannel.length})`
        );
      } while (cursor !== null);
    } finally {
      taskChannel.close(); // Signal workers we're done
    }
  }

  // Worker: Process tasks from channel
  async function processTasksFromChannel(): Promise<void> {
    for await (const item of taskChannel) {
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
      }
    }
  }

  // Start concurrent execution
  const producerTask = fetchIncompleteRuns();
  const workerTasks = Array.from({ length: concurrency }, () =>
    processTasksFromChannel()
  );

  // Wait for producer and all workers to finish
  await Promise.all([producerTask, ...workerTasks]);

  logger.info(`✅ Task runs completed.`);

  if (totalFailed > 0) {
    logger.info(
      `⚠️  Warning: ${totalFailed} out of ${totalProcessed} runs failed.`
    );
  }

  // Run evaluators if provided (only on runs missing evaluations)
  if (evaluators && evaluators.length > 0) {
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
    let output: unknown;
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

      let output: unknown;
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
