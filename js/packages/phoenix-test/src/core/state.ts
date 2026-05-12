import { AsyncLocalStorage } from "node:async_hooks";
import type { PhoenixClient } from "@arizeai/phoenix-client";
import type {
  GlobalTracerProviderRegistration,
  NodeTracerProvider,
  Tracer,
} from "@arizeai/phoenix-otel";

import type {
  Annotation,
  KVMap,
  PhoenixSuiteConfig,
  PhoenixTestParams,
} from "./types";

/**
 * State for a single `describe()` block. Created during test collection
 * and shared across all tests in the suite.
 */
export interface SuiteState {
  /** The user-facing suite (and dataset/experiment) name. */
  name: string;
  config: PhoenixSuiteConfig;
  /**
   * Map of test name → registered example metadata. Filled as tests are
   * declared inside the describe callback. Keys are test names.
   */
  registeredExamples: Map<string, RegisteredExample>;
  /**
   * Map of test name → resolved server-side example id. Populated after the
   * dataset is synced.
   */
  exampleIdsByTest: Map<string, { exampleId: string; nodeId: string }>;
  /** Phoenix dataset id (after upload). */
  datasetId?: string;
  /** Phoenix experiment id (created at suite start). */
  experimentId?: string;
  /** Phoenix project name used for the experiment. */
  projectName?: string;
  /** Phoenix client used for this suite (resolved lazily). */
  client?: PhoenixClient;
  /** OpenInference tracer for task spans. */
  tracer?: Tracer;
  /** OpenInference tracer for evaluator spans. */
  evaluatorTracer?: Tracer;
  /** Tracer provider owned by this suite (cleaned up at suite end). */
  tracerProvider?: NodeTracerProvider;
  /** Global tracer registration owned by this suite (if any). */
  globalRegistration?: GlobalTracerProviderRegistration | null;
  /** Whether sync to Phoenix is disabled for this run. */
  trackingDisabled: boolean;
  /** Recorded test results for the reporter / summary. */
  results: TestResult[];
  /** Links printed at the end of the suite (Phoenix dataset / experiment URLs). */
  links: Array<{ label: string; url: string }>;
  /** Reason the suite became inert (no tracking), if applicable. */
  trackingDisabledReason?: string;
  /** Setup error captured during suite initialization. */
  setupError?: Error;
  /** Count of best-effort POSTs (runs + annotations) that failed during upload. */
  uploadFailureCount?: number;
  /**
   * Highest per-test repetition count seen in this suite. Used as the
   * experiment's `repetitions` value (informational; runs are keyed by
   * example + repetition number regardless).
   */
  maxRepetitions?: number;
}

/** Per-test registration captured when `test()` is declared. */
export interface RegisteredExample {
  testName: string;
  params: PhoenixTestParams;
}

/** Run-time state attached via AsyncLocalStorage to each running test. */
export interface RunState {
  suite: SuiteState;
  /** Runner-facing test name (may include a `[rep i/N]` suffix). */
  testName: string;
  /** The logical test name; the key into `registeredExamples`. */
  logicalName: string;
  /** 1-based repetition index for this run. */
  repetitionNumber: number;
  /** When true, this run is local-only: no dataset example, no upload. */
  dryRun: boolean;
  params: PhoenixTestParams;
  output?: unknown;
  outputSet: boolean;
  annotations: Annotation[];
  startTime: Date;
  endTime?: Date;
  traceId?: string;
  runId?: string;
  error?: string;
  /** Optional metadata accumulated during the test. */
  runMetadata: KVMap;
}

/** A single test outcome surfaced to the reporter / summary printer. */
export interface TestResult {
  suiteName: string;
  testName: string;
  status: "passed" | "failed" | "skipped";
  output?: unknown;
  annotations: Annotation[];
  error?: string;
  durationMs: number;
  /** 1-based repetition index, when the test ran more than once. */
  repetitionNumber?: number;
  /** Total repetitions configured for this test (≥ 1). */
  repetitions?: number;
  /** True when this test ran local-only (not uploaded to Phoenix). */
  dryRun?: boolean;
}

/**
 * AsyncLocalStorage that lets `logOutput` / `logAnnotation` / `wrapEvaluator`
 * reach the running test's state without threading it through arguments.
 */
export const runStorage = new AsyncLocalStorage<RunState>();

/**
 * Stack of currently active suites. Tests declared inside a `describe`
 * callback consult the top of this stack to register themselves.
 */
const suiteStack: SuiteState[] = [];

export function pushSuite(suite: SuiteState): void {
  suiteStack.push(suite);
}

export function popSuite(): SuiteState | undefined {
  return suiteStack.pop();
}

export function currentSuite(): SuiteState | undefined {
  return suiteStack[suiteStack.length - 1];
}

export function currentRun(): RunState | undefined {
  return runStorage.getStore();
}
