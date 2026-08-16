/**
 * Cross-process bridge for the end-of-run Phoenix summary.
 *
 * Both Vitest and Jest run test files in separate worker processes, so a
 * suite's results live in a different process than the reporter that prints
 * the final summary. To bridge that gap, each worker writes a small JSON
 * artifact describing its suite to a shared temp directory when the suite
 * finishes (see {@link writeSuiteSummaryArtifact}). At the end of the run the
 * reporter — back in the main process — reads every artifact written since the
 * run began (see {@link readSuiteSummaryArtifacts}) and prints them together.
 *
 * Everything here is best-effort: a failure to write or read an artifact must
 * never fail a user's test, so the file system calls swallow their errors.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SuiteSummary } from "./reporter-format";
import type { SuiteState, TestResult } from "./state";

/**
 * Env var that overrides where suite summary artifacts are written. When unset,
 * a stable per-project subdirectory of the OS temp dir is used (see
 * {@link getSuiteSummaryReportDir}).
 */
export const PHOENIX_TEST_REPORT_DIR_ENV_VAR = "PHOENIX_TEST_REPORT_DIR";

const ARTIFACT_VERSION = 1;
const ARTIFACT_FILE_PREFIX = "suite-";
let artifactCounter = 0;

/** The on-disk shape of a single artifact file. */
interface SuiteSummaryArtifact {
  version: typeof ARTIFACT_VERSION;
  createdAtMs: number;
  suite: SuiteSummary;
}

/**
 * Resolve the directory where suite summary artifacts are written and read.
 *
 * Honors {@link PHOENIX_TEST_REPORT_DIR_ENV_VAR} when set. Otherwise it derives
 * a directory under the OS temp dir, namespaced by a hash of the current
 * working directory so that concurrent test runs in different projects don't
 * read each other's artifacts.
 */
export function getSuiteSummaryReportDir(): string {
  const configuredReportDir = process.env[PHOENIX_TEST_REPORT_DIR_ENV_VAR];
  if (configuredReportDir && configuredReportDir.trim().length > 0) {
    return configuredReportDir;
  }
  const cwdHash = createHash("sha256")
    .update(process.cwd())
    .digest("hex")
    .slice(0, 16);
  return join(tmpdir(), "phoenix-client-test-reports", cwdHash);
}

/**
 * Delete any artifacts left over from a previous run. The reporter calls this
 * at the start of every run so summaries from an earlier watch-mode invocation
 * don't bleed into the next one.
 */
export function clearSuiteSummaryArtifacts(): void {
  const reportDir = getSuiteSummaryReportDir();
  mkdirSync(reportDir, { recursive: true });
  for (const fileName of readdirSync(reportDir)) {
    if (!isArtifactFileName(fileName)) {
      continue;
    }
    try {
      rmSync(join(reportDir, fileName), { force: true });
    } catch {
      continue;
    }
  }
}

/**
 * Write one suite's summary to the report directory. Called from each worker
 * when a suite finishes.
 *
 * The file is written to a `.tmp` path first and then atomically renamed into
 * place, so the reader never observes a half-written artifact. Failures are
 * intentionally swallowed — reporting must not break the user's tests.
 */
export function writeSuiteSummaryArtifact(suite: SuiteState): void {
  try {
    const reportDir = getSuiteSummaryReportDir();
    mkdirSync(reportDir, { recursive: true });
    const artifact: SuiteSummaryArtifact = {
      version: ARTIFACT_VERSION,
      createdAtMs: Date.now(),
      suite: createSuiteSummary(suite),
    };
    const fileName = `${ARTIFACT_FILE_PREFIX}${process.pid}-${Date.now()}-${artifactCounter++}.json`;
    const artifactPath = join(reportDir, fileName);
    const temporaryPath = `${artifactPath}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(artifact), "utf8");
    renameSync(temporaryPath, artifactPath);
  } catch {
    // Reporting artifacts are best-effort and should not fail user tests.
  }
}

/**
 * Read back all suite summaries the workers wrote during this run, sorted by
 * suite name for stable output.
 *
 * @param sinceMs - When provided, only artifacts created at or after this
 *   timestamp are returned, so summaries from a previous run that share the
 *   report directory are ignored. A one-second slack is allowed to absorb
 *   small clock differences between worker processes.
 */
export function readSuiteSummaryArtifacts({
  sinceMs,
}: {
  sinceMs?: number;
} = {}): SuiteSummary[] {
  const reportDir = getSuiteSummaryReportDir();
  if (!existsSync(reportDir)) {
    return [];
  }

  const suites: SuiteSummary[] = [];
  for (const fileName of readdirSync(reportDir)) {
    if (
      !fileName.startsWith(ARTIFACT_FILE_PREFIX) ||
      !fileName.endsWith(".json")
    ) {
      continue;
    }
    const artifactPath = join(reportDir, fileName);
    try {
      const stats = statSync(artifactPath);
      if (sinceMs !== undefined && stats.mtimeMs < sinceMs - 1000) {
        continue;
      }
      const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
      if (!isSuiteSummaryArtifact(artifact)) {
        continue;
      }
      if (sinceMs !== undefined && artifact.createdAtMs < sinceMs - 1000) {
        continue;
      }
      suites.push(artifact.suite);
    } catch {
      continue;
    }
  }

  return suites.sort((leftSuite, rightSuite) =>
    leftSuite.name.localeCompare(rightSuite.name)
  );
}

/**
 * Project the live in-memory {@link SuiteState} down to the serializable
 * {@link SuiteSummary} that gets written to disk. Drops anything that can't or
 * shouldn't cross the process boundary (clients, tracers, raw Error objects).
 */
function createSuiteSummary(suite: SuiteState): SuiteSummary {
  return {
    name: suite.name,
    trackingDisabled: suite.trackingDisabled,
    trackingDisabledReason: suite.trackingDisabledReason,
    setupError: suite.setupError
      ? { message: suite.setupError.message }
      : undefined,
    uploadFailureCount: suite.uploadFailureCount,
    results: suite.results.map(createTestResultSummary),
    acceptanceResults: suite.acceptanceResults,
    links: suite.links.map(({ label, url }) => ({ label, url })),
  };
}

function createTestResultSummary(result: TestResult): TestResult {
  return {
    suiteName: result.suiteName,
    testName: result.testName,
    status: result.status,
    output: toJsonSafeValue(result.output),
    annotations: result.annotations.map(
      ({
        name,
        score,
        label,
        explanation,
        annotatorKind,
        metadata,
        traceId,
      }) => ({
        name,
        score,
        label,
        explanation,
        annotatorKind,
        metadata,
        traceId,
      })
    ),
    error: result.error,
    durationMs: result.durationMs,
    repetitionNumber: result.repetitionNumber,
    repetitions: result.repetitions,
    dryRun: result.dryRun,
    traceId: result.traceId,
    runId: result.runId,
    exampleId: result.exampleId,
  };
}

/**
 * Make a recorded test output safe to JSON-serialize: `bigint` values are
 * stringified, and anything that still can't be serialized (cycles, etc.)
 * falls back to its `String()` form rather than throwing.
 */
function toJsonSafeValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(
      JSON.stringify(value, (_key, nestedValue: unknown) =>
        typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue
      )
    );
  } catch {
    return String(value);
  }
}

/**
 * Validate a parsed artifact before trusting it. Guards against version skew
 * and partially-written or unrelated JSON files in the report directory.
 */
function isSuiteSummaryArtifact(value: unknown): value is SuiteSummaryArtifact {
  if (!isRecord(value)) {
    return false;
  }
  const suite = value.suite;
  return (
    value.version === ARTIFACT_VERSION &&
    typeof value.createdAtMs === "number" &&
    isRecord(suite) &&
    typeof suite.name === "string" &&
    Array.isArray(suite.results) &&
    Array.isArray(suite.links)
  );
}

function isArtifactFileName(fileName: string): boolean {
  return (
    fileName.startsWith(ARTIFACT_FILE_PREFIX) &&
    (fileName.endsWith(".json") || fileName.endsWith(".json.tmp"))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
