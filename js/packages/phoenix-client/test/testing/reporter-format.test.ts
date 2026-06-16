import { describe, expect, it } from "vitest";

import { formatSuiteSummary } from "../../src/testing/reporter-format";
import type { SuiteSummary } from "../../src/testing/reporter-format";

describe("reporter format", () => {
  it("renders acceptance criteria results", () => {
    const summary: SuiteSummary = {
      name: "scorecard",
      results: [
        {
          suiteName: "scorecard",
          testName: "case",
          status: "passed",
          annotations: [{ name: "token_f1", score: 0.75 }],
          durationMs: 10,
        },
      ],
      acceptanceResults: [
        {
          annotationName: "token_f1",
          metric: "average",
          threshold: 0.8,
          value: 0.75,
          sampleCount: 1,
          passed: false,
        },
      ],
      links: [],
    };

    expect(formatSuiteSummary(summary)).toContain(
      [
        "  Acceptance Criteria:",
        "    FAIL token_f1 average 0.750 < 0.800 (1 sample)",
      ].join("\n")
    );
  });
});
