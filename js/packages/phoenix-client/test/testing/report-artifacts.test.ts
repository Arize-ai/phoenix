import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PHOENIX_TEST_REPORT_DIR_ENV_VAR,
  clearSuiteSummaryArtifacts,
  readSuiteSummaryArtifacts,
  writeSuiteSummaryArtifact,
} from "../../src/testing/core/report-artifacts";
import type { SuiteState } from "../../src/testing/core/state";

const originalReportDir = process.env[PHOENIX_TEST_REPORT_DIR_ENV_VAR];

let reportDir: string | undefined;

beforeEach(() => {
  reportDir = mkdtempSync(join(tmpdir(), "phoenix-report-artifacts-"));
  process.env[PHOENIX_TEST_REPORT_DIR_ENV_VAR] = reportDir;
  clearSuiteSummaryArtifacts();
});

afterEach(() => {
  if (originalReportDir === undefined) {
    delete process.env[PHOENIX_TEST_REPORT_DIR_ENV_VAR];
  } else {
    process.env[PHOENIX_TEST_REPORT_DIR_ENV_VAR] = originalReportDir;
  }
  if (reportDir) {
    rmSync(reportDir, { recursive: true, force: true });
  }
});

describe("report artifacts", () => {
  it("persists a serializable suite summary for isolated reporters", () => {
    const suite = createSuiteState();

    writeSuiteSummaryArtifact(suite);

    expect(readSuiteSummaryArtifacts()).toEqual([
      {
        name: "artifact suite",
        trackingDisabled: true,
        trackingDisabledReason: "PHOENIX_TEST_TRACKING is disabled",
        results: [
          {
            suiteName: "artifact suite",
            testName: "captures output",
            status: "passed",
            output: { greeting: "hello" },
            annotations: [
              {
                name: "pass",
                score: true,
              },
              {
                name: "quality",
                score: 0.9,
                label: "good",
              },
            ],
            durationMs: 12,
          },
        ],
        links: [{ label: "Experiment", url: "https://app.example/compare" }],
      },
    ]);
  });

  it("clears artifacts between reporter runs", () => {
    writeSuiteSummaryArtifact(createSuiteState());

    clearSuiteSummaryArtifacts();

    expect(readSuiteSummaryArtifacts()).toEqual([]);
  });
});

function createSuiteState(): SuiteState {
  return {
    name: "artifact suite",
    config: {},
    registeredExamples: new Map(),
    exampleIdsByTest: new Map(),
    trackingDisabled: true,
    trackingDisabledReason: "PHOENIX_TEST_TRACKING is disabled",
    results: [
      {
        suiteName: "artifact suite",
        testName: "captures output",
        status: "passed",
        output: { greeting: "hello" },
        annotations: [
          {
            name: "pass",
            score: true,
          },
          {
            name: "quality",
            score: 0.9,
            label: "good",
          },
        ],
        durationMs: 12,
      },
    ],
    links: [{ label: "Experiment", url: "https://app.example/compare" }],
  };
}
