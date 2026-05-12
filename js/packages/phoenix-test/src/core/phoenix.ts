import { createClient } from "@arizeai/phoenix-client";
import type { PhoenixClient } from "@arizeai/phoenix-client";
import { createDataset } from "@arizeai/phoenix-client/datasets";
import {
  attachGlobalTracerProvider,
  createNoOpProvider,
  type GlobalTracerProviderRegistration,
  MimeType,
  type NodeTracerProvider,
  OpenInferenceSpanKind,
  register,
  SemanticConventions,
  SpanStatusCode,
  type Tracer,
} from "@arizeai/phoenix-otel";

import { currentRun, type RunState, type SuiteState } from "./state";
import type { Annotation, KVMap } from "./types";

function isTruthyFlag(value: string | undefined): boolean {
  const v = (value ?? "").toLowerCase();
  return v === "true" || v === "1" || v === "on" || v === "yes";
}

function isFalsyFlag(value: string | undefined): boolean {
  const v = (value ?? "").toLowerCase();
  return v === "false" || v === "0" || v === "off" || v === "no";
}

/**
 * Decide whether tests should sync to Phoenix.
 *
 * Tracking is enabled by default. It can be disabled globally by setting
 * `PHOENIX_TEST_TRACKING=false` (or `PHOENIX_TEST_DRY_RUN=true`), or per
 * suite via `PhoenixSuiteConfig.dryRun`.
 */
export function isTrackingEnabled(suite?: SuiteState): {
  enabled: boolean;
  reason?: string;
} {
  if (isFalsyFlag(process.env.PHOENIX_TEST_TRACKING)) {
    return { enabled: false, reason: "PHOENIX_TEST_TRACKING is disabled" };
  }
  if (isTruthyFlag(process.env.PHOENIX_TEST_DRY_RUN)) {
    return { enabled: false, reason: "PHOENIX_TEST_DRY_RUN is enabled" };
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

/** Stringify a value for OpenInference span attributes. */
function stringify(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
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

function outputMimeType(value: unknown): MimeType {
  return typeof value === "string" ? MimeType.TEXT : MimeType.JSON;
}

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
  const picked = pickHeaders(headers);
  if (!picked) return;
  const hasAuth = Object.keys(picked).some(
    (h) => h.toLowerCase() === "authorization"
  );
  if (!hasAuth) return;
  warnedAboutHttpScheme = true;
  // eslint-disable-next-line no-console
  console.warn(
    `[@arizeai/phoenix-test] PHOENIX_HOST="${baseUrl}" uses http:// with ` +
      `an Authorization header set; the bearer token will travel in cleartext. ` +
      `Use https:// for non-localhost Phoenix endpoints.`
  );
}

function inputMimeType(value: unknown): MimeType {
  return typeof value === "string" ? MimeType.TEXT : MimeType.JSON;
}

function pickHeaders(
  headers: PhoenixClient["config"]["headers"]
): Record<string, string> | undefined {
  if (!headers) return undefined;
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v == null) continue;
    out[k] = Array.isArray(v) ? v.join(", ") : String(v);
  }
  return out;
}

function buildLinks(
  client: PhoenixClient,
  datasetId: string,
  experimentId: string
): Array<{ label: string; url: string }> {
  const baseUrl = client.config.baseUrl;
  if (!baseUrl) return [];
  const trimmed = baseUrl.replace(/\/$/, "");
  return [
    {
      label: "Dataset",
      url: `${trimmed}/datasets/${datasetId}/examples`,
    },
    {
      label: "Experiments",
      url: `${trimmed}/datasets/${datasetId}/experiments`,
    },
    {
      label: "Experiment",
      url: `${trimmed}/datasets/${datasetId}/compare?experimentId=${experimentId}`,
    },
  ];
}

/**
 * Initialize the suite: upload the dataset, create the experiment, and
 * register the OpenInference tracer.
 *
 * If tracking is disabled (no Phoenix env vars, or PHOENIX_TEST_TRACKING=false),
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
      headers: pickHeaders(client.config.headers),
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
export async function runTaskWithTracing<T>(
  suite: SuiteState,
  testName: string,
  fn: () => Promise<T>
): Promise<{ traceId: string; result: T } | { traceId: string; error: Error }> {
  const tracer: Tracer = taskTracer(suite);
  return tracer.startActiveSpan(`Test: ${testName}`, async (span) => {
    const traceId = span.spanContext().traceId;
    try {
      const result = await fn();
      const input = currentInput();
      span.setAttributes({
        [SemanticConventions.OPENINFERENCE_SPAN_KIND]:
          OpenInferenceSpanKind.CHAIN,
        [SemanticConventions.INPUT_MIME_TYPE]: inputMimeType(input),
        [SemanticConventions.INPUT_VALUE]: stringify(input),
        [SemanticConventions.OUTPUT_MIME_TYPE]: outputMimeType(result),
        [SemanticConventions.OUTPUT_VALUE]: stringify(result),
      });
      span.setStatus({ code: SpanStatusCode.OK });
      return { traceId, result };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      return { traceId, error };
    } finally {
      span.end();
    }
  });
}

function currentInput(): unknown {
  return currentRun()?.params.input;
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
          end_time: (run.endTime ?? new Date()).toISOString(),
          trace_id: run.traceId ?? null,
          error: run.error ?? null,
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
  if (suite.trackingDisabled || !suite.client || !runId) return;
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
        },
        error: null,
        trace_id: null,
      },
    });
  } catch {
    suite.uploadFailureCount = (suite.uploadFailureCount ?? 0) + 1;
  }
}

/** Wrap an evaluator in an OpenInference evaluator span. */
export async function runEvaluatorWithTracing<P extends KVMap, R>(
  suite: SuiteState,
  name: string,
  params: P,
  fn: (params: P) => R | Promise<R>
): Promise<R> {
  const tracer: Tracer = currentRun()?.dryRun
    ? getNoOpTracer()
    : (suite.evaluatorTracer ?? suite.tracer ?? getNoOpTracer());
  return tracer.startActiveSpan(`Evaluation: ${name}`, async (span) => {
    try {
      const result = await fn(params);
      span.setAttributes({
        [SemanticConventions.OPENINFERENCE_SPAN_KIND]:
          OpenInferenceSpanKind.EVALUATOR,
        [SemanticConventions.INPUT_MIME_TYPE]: MimeType.JSON,
        [SemanticConventions.INPUT_VALUE]: stringify(params),
        [SemanticConventions.OUTPUT_MIME_TYPE]: MimeType.JSON,
        [SemanticConventions.OUTPUT_VALUE]: stringify(result),
      });
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Tear down the tracer provider created for the suite, flushing any pending
 * spans before the process exits.
 */
export async function teardownSuite(suite: SuiteState): Promise<void> {
  const provider = suite.tracerProvider;
  const reg = suite.globalRegistration;
  if (!provider) return;
  try {
    await provider.forceFlush();
  } finally {
    try {
      await provider.shutdown();
    } finally {
      reg?.detach();
      suite.tracerProvider = undefined;
      suite.globalRegistration = null;
    }
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
