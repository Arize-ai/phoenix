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

export const PHOENIX_TEST_REPORT_DIR_ENV_VAR = "PHOENIX_TEST_REPORT_DIR";

const ARTIFACT_VERSION = 1;
const ARTIFACT_FILE_PREFIX = "suite-";
let artifactCounter = 0;

interface SuiteSummaryArtifact {
  version: typeof ARTIFACT_VERSION;
  createdAtMs: number;
  suite: SuiteSummary;
}

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
      ({ name, score, label, explanation, annotatorKind }) => ({
        name,
        score,
        label,
        explanation,
        annotatorKind,
      })
    ),
    error: result.error,
    durationMs: result.durationMs,
    repetitionNumber: result.repetitionNumber,
    repetitions: result.repetitions,
    dryRun: result.dryRun,
  };
}

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
