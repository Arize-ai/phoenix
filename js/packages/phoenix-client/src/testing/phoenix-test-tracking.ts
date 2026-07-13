import {
  attachGlobalTracerProvider,
  context,
  createNoOpProvider,
  type GlobalTracerProviderRegistration,
  MimeType,
  type NodeTracerProvider,
  OpenInferenceSpanKind,
  register,
  SemanticConventions,
  SpanStatusCode,
  suppressTracing,
  trace,
  type Tracer,
} from "@arizeai/phoenix-otel";
import type { Span } from "@opentelemetry/api";

import { createDataset } from "../datasets";
import { cleanupOwnedTracerProvider } from "../experiments/tracing";
import { createClient, type PhoenixClient } from "../index";
import { ensureString } from "../utils/ensureString";
import { toObjectHeaders } from "../utils/toObjectHeaders";
import {
  getDatasetExperimentsUrl,
  getDatasetUrl,
  getExperimentUrl,
} from "../utils/urlUtils";
import { currentRun, type RunState, type SuiteState } from "./state";
import type { Annotation, KVMap } from "./types";

export function isFalsyFlag(value: string | undefined): boolean {
  // Tolerate surrounding whitespace and matching quotes that survive some
  // shells and `.env` loaders (e.g. `PHOENIX_TEST_TRACKING="false"` or a value
  // with a trailing newline). Without this, such a value reads as truthy and
  // silently re-enables recording even though the user asked to disable it.
  const v = (value ?? "")
    .trim()
    .replace(/^(['"])(.*)\1$/, "$2")
    .trim()
    .toLowerCase();
  return v === "false" || v === "0" || v === "off" || v === "no";
}

/**
 * Snapshot of `PHOENIX_TEST_TRACKING` as it was when this module first loaded.
 *
 * When the flag is exported on the command line (the documented `eval:offline`
 * workflow), this captures the user's intent at process start and is immune to
 * any later in-process mutation of `process.env` by a sibling suite or setup
 * file. That mutation is what made tracking leak across suites in #13930: one
 * suite flipped the env var and re-enabled recording for the others.
 */
const trackingDisabledAtLoad = isFalsyFlag(process.env.PHOENIX_TEST_TRACKING);

/**
 * Latches to `true` the first time tracking is observed disabled in this
 * process. Recording is opt-out and shared process-wide, so a single falsy
 * reading turns the whole run off and keeps it off — later suites cannot
 * re-enable recording regardless of declaration or execution order.
 */
let trackingLatchedOff = trackingDisabledAtLoad;

/**
 * Reset the process-level tracking latch. Test-only seam so unit tests can
 * exercise the enable/disable transitions in isolation; not part of the
 * public API.
 *
 * @internal
 */
export function __resetTrackingLatchForTests(): void {
  trackingLatchedOff = isFalsyFlag(process.env.PHOENIX_TEST_TRACKING);
}

/**
 * Decide whether tests should sync to Phoenix.
 *
 * Tracing is enabled by default. It can be disabled globally by setting
 * `PHOENIX_TEST_TRACKING=false`, or per suite via `SuiteConfig.dryRun`.
 *
 * The global disable is sticky for the lifetime of the process: once the flag
 * is seen falsy — at load time or on any later call — tracking stays off for
 * every suite. This keeps offline mode deterministic regardless of which
 * suites are included in a run, or the order they execute in.
 */
export function isTrackingEnabled(suite?: SuiteState): {
  enabled: boolean;
  reason?: string;
} {
  if (trackingLatchedOff || isFalsyFlag(process.env.PHOENIX_TEST_TRACKING)) {
    trackingLatchedOff = true;
    return { enabled: false, reason: "PHOENIX_TEST_TRACKING is disabled" };
  }
  if (suite?.config.dryRun) {
    return { enabled: false, reason: "suite configured dryRun" };
  }
  return { enabled: true };
}

/**
 * Resolve the repetition count for a test: per-test value, else suite-level,
 * else the `PHOENIX_TEST_REPETITIONS` env var, else `1`. Non-positive or
 * non-finite values fall back to `1`.
 */
export function resolveRepetitions(
  perTest: number | undefined,
  suite: SuiteState
): number {
  const envValue = Number(process.env.PHOENIX_TEST_REPETITIONS);
  const candidates = [
    perTest,
    suite.config.repetitions,
    Number.isFinite(envValue) ? envValue : undefined,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c) && c >= 1) {
      return Math.floor(c);
    }
  }
  return 1;
}

/**
 * Deterministic key for matching dataset examples by content. Uses sorted
 * keys so two inputs that differ only in property order hash the same.
 */
function stableKey(value: unknown): string {
  return stableStringify(value);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const keys = Object.keys(value as object).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          stableStringify((value as Record<string, unknown>)[k])
      )
      .join(",") +
    "}"
  );
}

/** TEXT for raw strings, JSON for everything else. */
function mimeTypeFor(value: unknown): MimeType {
  return typeof value === "string" ? MimeType.TEXT : MimeType.JSON;
}

interface TaskSpanLifecycle {
  span: Span;
  traceId: string;
  ended: boolean;
}

const taskSpansByRun = new WeakMap<RunState, TaskSpanLifecycle>();

/**
 * Warn once when `PHOENIX_HOST` is plain `http:` while an `Authorization`
 * header is being forwarded to the OTLP exporter — that combination
 * exfiltrates the bearer token in cleartext.
 */
let warnedAboutHttpScheme = false;
function maybeWarnHttpScheme(
  baseUrl: string | undefined,
  headers: PhoenixClient["config"]["headers"]
): void {
  if (warnedAboutHttpScheme || !baseUrl) return;
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return;
  }
  if (parsed.protocol !== "http:") return;
  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    return;
  if (!headers) return;
  const picked = toObjectHeaders(headers);
  const hasAuth = Object.keys(picked).some(
    (h) => h.toLowerCase() === "authorization"
  );
  if (!hasAuth) return;
  warnedAboutHttpScheme = true;
  // eslint-disable-next-line no-console
  console.warn(
    `[@arizeai/phoenix-client] PHOENIX_HOST="${baseUrl}" uses http:// with ` +
      `an Authorization header set; the bearer token will travel in cleartext. ` +
      `Use https:// for non-localhost Phoenix endpoints.`
  );
}

function buildLinks(
  client: PhoenixClient,
  datasetId: string,
  experimentId: string
): Array<{ label: string; url: string }> {
  const baseUrl = client.config.baseUrl;
  if (!baseUrl) return [];
  return [
    { label: "Dataset", url: getDatasetUrl({ baseUrl, datasetId }) },
    {
      label: "Experiments",
      url: getDatasetExperimentsUrl({ baseUrl, datasetId }),
    },
    {
      label: "Experiment",
      url: getExperimentUrl({ baseUrl, datasetId, experimentId }),
    },
  ];
}

/**
 * Initialize the suite: upload the dataset, create the experiment, and
 * register the OpenInference tracer.
 *
 * If tracing is disabled (no Phoenix env vars, or PHOENIX_TEST_TRACKING=false),
 * this populates a no-op tracer and exits without making any network calls.
 */
export async function initializeSuite(suite: SuiteState): Promise<void> {
  const tracking = isTrackingEnabled(suite);
  if (!tracking.enabled) {
    suite.trackingDisabled = true;
    suite.trackingDisabledReason = tracking.reason;
    suite.tracer = createNoOpProvider().getTracer("no-op");
    suite.evaluatorTracer = suite.tracer;
    return;
  }

  const client = suite.config.client ?? createClient();
  suite.client = client;

  const datasetName = suite.config.datasetName ?? suite.name;
  const description =
    suite.config.description ??
    `Phoenix test dataset auto-generated from ${suite.name}`;

  const examples = Array.from(suite.registeredExamples.values()).map(
    (registered) => ({
      id: registered.params.id ?? null,
      input: registered.params.input,
      output: registered.params.expected ?? {},
      metadata: registered.params.metadata ?? {},
      splits: registered.params.splits,
    })
  );

  let datasetId: string;
  try {
    const created = await createDataset({
      client,
      name: datasetName,
      description,
      examples,
    });
    datasetId = created.datasetId;
  } catch (err) {
    suite.trackingDisabled = true;
    suite.setupError = err instanceof Error ? err : new Error(String(err));
    suite.tracer = createNoOpProvider().getTracer("no-op");
    suite.evaluatorTracer = suite.tracer;
    return;
  }
  suite.datasetId = datasetId;

  // Map test names to server-side example ids by re-fetching the dataset.
  // The server doesn't promise that the GET response order matches the
  // upload order, so we match by user-supplied `id` first, then by
  // `JSON.stringify(input)` deep-equality with FIFO-on-collision.
  try {
    const { data: response } = await client.GET("/v1/datasets/{id}/examples", {
      params: { path: { id: datasetId } },
    });
    const fetched = response?.data?.examples ?? [];

    const idToTestName = new Map<string, string>();
    const inputKeyToTestNames = new Map<string, string[]>();
    for (const [testName, registered] of suite.registeredExamples.entries()) {
      if (registered.params.id) {
        idToTestName.set(registered.params.id, testName);
        continue;
      }
      const key = stableKey(registered.params.input);
      const arr = inputKeyToTestNames.get(key) ?? [];
      arr.push(testName);
      inputKeyToTestNames.set(key, arr);
    }

    for (const ex of fetched) {
      const byId = idToTestName.get(ex.id);
      if (byId) {
        suite.exampleIdsByTest.set(byId, {
          exampleId: ex.id,
          nodeId: ex.node_id,
        });
        idToTestName.delete(ex.id);
        continue;
      }
      const queue = inputKeyToTestNames.get(stableKey(ex.input));
      if (queue && queue.length) {
        const testName = queue.shift() as string;
        suite.exampleIdsByTest.set(testName, {
          exampleId: ex.id,
          nodeId: ex.node_id,
        });
      }
    }
  } catch {
    // If we cannot resolve example ids, runs will be logged without one.
  }

  const projectName = `${datasetName}-${new Date().toISOString()}`;
  suite.projectName = projectName;

  try {
    const experimentResponse = await client
      .POST("/v1/datasets/{dataset_id}/experiments", {
        params: { path: { dataset_id: datasetId } },
        body: {
          name: suite.config.datasetName ?? suite.name,
          description,
          metadata: { ...(suite.config.metadata ?? {}), ...envMetadata() },
          project_name: projectName,
          repetitions: Math.max(1, suite.maxRepetitions ?? 1),
        },
      })
      .then((res) => res.data?.data);
    if (!experimentResponse) {
      throw new Error("Failed to create experiment");
    }
    suite.experimentId = experimentResponse.id;
    suite.projectName = experimentResponse.project_name ?? projectName;
  } catch (err) {
    suite.trackingDisabled = true;
    suite.setupError = err instanceof Error ? err : new Error(String(err));
    suite.tracer = createNoOpProvider().getTracer("no-op");
    suite.evaluatorTracer = suite.tracer;
    return;
  }

  const baseUrl = client.config.baseUrl;
  if (!baseUrl) {
    suite.trackingDisabled = true;
    suite.setupError = new Error(
      "Phoenix base URL not found. Set PHOENIX_HOST or pass baseUrl on the client."
    );
    suite.tracer = createNoOpProvider().getTracer("no-op");
    suite.evaluatorTracer = suite.tracer;
    return;
  }

  maybeWarnHttpScheme(baseUrl, client.config.headers);

  let provider: NodeTracerProvider;
  try {
    provider = register({
      projectName: suite.projectName,
      url: baseUrl,
      headers: client.config.headers
        ? toObjectHeaders(client.config.headers)
        : undefined,
      batch: false,
      global: false,
    });
    suite.tracerProvider = provider;
    suite.globalRegistration = attachGlobalTracerProvider(provider);
  } catch (err) {
    suite.trackingDisabled = true;
    suite.setupError = err instanceof Error ? err : new Error(String(err));
    suite.tracer = createNoOpProvider().getTracer("no-op");
    suite.evaluatorTracer = suite.tracer;
    return;
  }
  suite.tracer = provider.getTracer(suite.projectName);
  suite.evaluatorTracer = provider.getTracer(`${suite.projectName}-evaluators`);

  if (suite.datasetId && suite.experimentId) {
    suite.links = buildLinks(client, suite.datasetId, suite.experimentId);
  }
}

/** Lazily-created no-op tracer reused for dry runs / fallbacks. */
let noOpTracer: Tracer | undefined;
function getNoOpTracer(): Tracer {
  if (!noOpTracer) noOpTracer = createNoOpProvider().getTracer("no-op");
  return noOpTracer;
}

/** The tracer to use for the currently-running test — no-op when dry. */
function taskTracer(suite: SuiteState): Tracer {
  if (currentRun()?.dryRun) return getNoOpTracer();
  return suite.tracer ?? getNoOpTracer();
}

/**
 * Wrap the user's test body in an OpenInference task span and return the
 * trace id so we can submit it with the experiment run.
 */
export async function runTaskWithTracing<Result>(
  suite: SuiteState,
  testName: string,
  fn: () => Promise<Result>
): Promise<
  | { traceId: string; result: Result }
  | { traceId: string; error: Error; isTaskError: boolean }
> {
  const tracer: Tracer = taskTracer(suite);
  return tracer.startActiveSpan(`Test: ${testName}`, async (span) => {
    const traceId = span.spanContext().traceId;
    const run = currentRun();
    if (run) {
      run.traceId = traceId;
      taskSpansByRun.set(run, { span, traceId, ended: false });
    }
    try {
      const result = await fn();
      if (run) {
        endTaskSpan({ run, fallbackOutput: result });
      } else {
        endSpanAsTask({ span, input: undefined, output: result });
      }
      return { traceId, result };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const isTaskError = run ? !hasTaskSpanEnded(run) : true;
      if (run && isTaskError) {
        endTaskSpan({ run, error });
      } else if (!run) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        span.end();
      }
      return { traceId, error, isTaskError };
    } finally {
      if (run) {
        taskSpansByRun.delete(run);
      }
    }
  });
}

function hasTaskSpanEnded(run: RunState): boolean {
  return taskSpansByRun.get(run)?.ended ?? false;
}

/**
 * End the current run's task span. `logOutput()` calls this immediately so
 * evaluator work that follows is not included in the task span duration.
 */
export function endTaskSpanForRun(run: RunState): void {
  endTaskSpan({ run });
}

function endTaskSpan({
  run,
  fallbackOutput,
  error,
}: {
  run: RunState;
  fallbackOutput?: unknown;
  error?: Error;
}): void {
  const lifecycle = taskSpansByRun.get(run);
  if (!lifecycle || lifecycle.ended) return;
  const output = run.outputSet ? run.output : fallbackOutput;
  if (error) {
    lifecycle.span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    lifecycle.span.setAttributes({
      [SemanticConventions.OPENINFERENCE_SPAN_KIND]:
        OpenInferenceSpanKind.CHAIN,
      [SemanticConventions.INPUT_MIME_TYPE]: mimeTypeFor(run.params.input),
      [SemanticConventions.INPUT_VALUE]: ensureString(run.params.input),
    });
    lifecycle.span.end();
  } else {
    endSpanAsTask({ span: lifecycle.span, input: run.params.input, output });
  }
  run.traceId = lifecycle.traceId;
  run.taskEndTime = new Date();
  lifecycle.ended = true;
}

function endSpanAsTask({
  span,
  input,
  output,
}: {
  span: Span;
  input: unknown;
  output: unknown;
}): void {
  span.setAttributes({
    [SemanticConventions.OPENINFERENCE_SPAN_KIND]: OpenInferenceSpanKind.CHAIN,
    [SemanticConventions.INPUT_MIME_TYPE]: mimeTypeFor(input),
    [SemanticConventions.INPUT_VALUE]: ensureString(input),
    [SemanticConventions.OUTPUT_MIME_TYPE]: mimeTypeFor(output),
    [SemanticConventions.OUTPUT_VALUE]: ensureString(output),
  });
  span.setStatus({ code: SpanStatusCode.OK });
  span.end();
}

/**
 * POST a single experiment run for one test case to Phoenix.
 *
 * Best-effort: failures are captured and surfaced via the test reporter but
 * do not fail the test itself.
 */
export async function postExperimentRun(
  suite: SuiteState,
  run: RunState
): Promise<string | undefined> {
  if (
    run.dryRun ||
    suite.trackingDisabled ||
    !isTrackingEnabled(suite).enabled ||
    !suite.client ||
    !suite.experimentId
  ) {
    return undefined;
  }
  const example = suite.exampleIdsByTest.get(run.logicalName);
  if (!example) {
    return undefined;
  }
  try {
    const res = await suite.client.POST(
      "/v1/experiments/{experiment_id}/runs",
      {
        params: { path: { experiment_id: suite.experimentId } },
        body: {
          dataset_example_id: example.nodeId,
          output: run.outputSet
            ? (run.output as Record<string, unknown> | string | null)
            : null,
          repetition_number: run.repetitionNumber,
          start_time: run.startTime.toISOString(),
          end_time: (
            run.taskEndTime ??
            run.endTime ??
            new Date()
          ).toISOString(),
          error: run.error ?? null,
          trace_id: run.traceId ?? null,
        },
      }
    );
    return res.data?.data.id;
  } catch {
    suite.uploadFailureCount = (suite.uploadFailureCount ?? 0) + 1;
    return undefined;
  }
}

/**
 * POST one annotation (an "experiment_evaluation") for a run.
 */
export async function postAnnotation(
  suite: SuiteState,
  runId: string | undefined,
  annotation: Annotation
): Promise<void> {
  if (
    suite.trackingDisabled ||
    !isTrackingEnabled(suite).enabled ||
    !suite.client ||
    !runId
  )
    return;
  const start = new Date();
  const end = new Date();
  try {
    await suite.client.POST("/v1/experiment_evaluations", {
      body: {
        experiment_run_id: runId,
        name: annotation.name,
        annotator_kind: annotation.annotatorKind ?? "CODE",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        result: {
          score:
            typeof annotation.score === "boolean"
              ? annotation.score
                ? 1
                : 0
              : (annotation.score ?? null),
          label: annotation.label ?? null,
          explanation: annotation.explanation ?? null,
          // Forward annotation metadata, matching the experiment evaluator
          // upload path in `runExperiment`. Spread so it's omitted when unset.
          ...(annotation.metadata ? { metadata: annotation.metadata } : {}),
        },
        error: null,
        trace_id: annotation.traceId ?? null,
      },
    });
  } catch {
    suite.uploadFailureCount = (suite.uploadFailureCount ?? 0) + 1;
  }
}

/** Run an evaluator in an OpenInference evaluator span. */
export async function runEvaluatorWithTracing<
  EvaluatorParams extends KVMap,
  EvaluatorResult,
>(
  suite: SuiteState,
  name: string,
  params: EvaluatorParams,
  fn: (params: EvaluatorParams) => EvaluatorResult | Promise<EvaluatorResult>
): Promise<{ result: EvaluatorResult; traceId: string | null }> {
  const isDryRun = currentRun()?.dryRun ?? false;
  const tracer: Tracer = isDryRun
    ? getNoOpTracer()
    : (suite.evaluatorTracer ?? suite.tracer ?? getNoOpTracer());
  const parentlessContext = trace.deleteSpan(context.active());
  const evaluatorContext = isDryRun
    ? suppressTracing(parentlessContext)
    : parentlessContext;
  return context.with(evaluatorContext, () =>
    tracer.startActiveSpan(`Evaluation: ${name}`, async (span) => {
      const traceId = isDryRun ? null : span.spanContext().traceId;
      try {
        const result = await fn(params);
        span.setAttributes({
          [SemanticConventions.OPENINFERENCE_SPAN_KIND]:
            OpenInferenceSpanKind.EVALUATOR,
          [SemanticConventions.INPUT_MIME_TYPE]: MimeType.JSON,
          [SemanticConventions.INPUT_VALUE]: ensureString(params),
          [SemanticConventions.OUTPUT_MIME_TYPE]: MimeType.JSON,
          [SemanticConventions.OUTPUT_VALUE]: ensureString(result),
        });
        span.setStatus({ code: SpanStatusCode.OK });
        return { result, traceId };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        throw error;
      } finally {
        span.end();
      }
    })
  );
}

/**
 * Tear down the tracer provider created for the suite, flushing any pending
 * spans before the process exits.
 */
export async function teardownSuite(suite: SuiteState): Promise<void> {
  const provider = suite.tracerProvider;
  if (!provider) return;
  try {
    await cleanupOwnedTracerProvider({
      provider,
      globalRegistration: suite.globalRegistration,
    });
  } finally {
    suite.tracerProvider = undefined;
    suite.globalRegistration = null;
  }
}

/**
 * Snapshot environment-derived metadata recorded on the experiment so users
 * can filter experiments by env in the Phoenix UI.
 */
function envMetadata(): KVMap {
  const out: KVMap = {};
  const env =
    process.env.PHOENIX_ENVIRONMENT ??
    process.env.ENVIRONMENT ??
    process.env.NODE_ENV;
  if (env) out.environment = env;
  return out;
}

/** Re-export the ones the entrypoint files consume. */
export type { GlobalTracerProviderRegistration, NodeTracerProvider };
