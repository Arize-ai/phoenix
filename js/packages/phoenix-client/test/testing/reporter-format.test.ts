import { describe, expect, it } from "vitest";

import {
  formatScoreboard,
  formatSuiteSummary,
  resolveRenderOptions,
} from "../../src/testing/reporter-format";
import type {
  RenderOptions,
  SuiteSummary,
} from "../../src/testing/reporter-format";
import type { TestResult } from "../../src/testing/state";

const COMPACT: RenderOptions = {
  verbose: false,
  color: false,
  maxRows: 10,
  maxWidth: 120,
};

/** Build a TestResult with a single `accuracy` annotation. */
function result(
  testName: string,
  status: TestResult["status"],
  accuracy: number,
  extra: Partial<TestResult> = {}
): TestResult {
  return {
    suiteName: "suite",
    testName,
    status,
    annotations: [{ name: "accuracy", score: accuracy }],
    durationMs: 1000,
    ...extra,
  };
}

/** Build a SuiteSummary with an `accuracy` average acceptance criterion. */
function suite(
  results: TestResult[],
  overrides: Partial<SuiteSummary> = {}
): SuiteSummary {
  const value =
    results.length > 0
      ? results.reduce((a, r) => {
          const s = r.annotations[0]?.score;
          return a + (typeof s === "number" ? s : 0);
        }, 0) / results.length
      : 0;
  return {
    name: "suite",
    results,
    acceptanceResults: [
      {
        annotationName: "accuracy",
        metric: "average",
        threshold: 0.8,
        value,
        sampleCount: results.length,
        passed: value >= 0.8,
      },
    ],
    links: [{ label: "Experiment", url: "http://localhost:6006/exp/1" }],
    ...overrides,
  };
}

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

  it("compact hides passing rows and reports the hidden count", () => {
    const out = formatSuiteSummary(
      suite([
        result("passing one", "passed", 1),
        result("passing two", "passed", 1),
        result("a clear miss", "passed", 0),
      ]),
      COMPACT
    );
    expect(out).toContain("a clear miss");
    expect(out).not.toContain("passing one");
    expect(out).not.toContain("passing two");
    expect(out).toContain("2 passing rows hidden");
    // The aggregate is computed over the full suite, not the visible rows.
    expect(out).toContain("AGGREGATE (3)");
    // No raw output dump in compact mode.
    expect(out).not.toContain("output:");
  });

  it("shows failures and below-threshold misses, hides clean passes", () => {
    const out = formatSuiteSummary(
      suite([
        result("threw up", "failed", 0, { error: "boom" }),
        result("low score", "passed", 0.2),
        result("fine", "passed", 1),
      ]),
      COMPACT
    );
    expect(out).toContain("FAIL");
    expect(out).toContain("threw up");
    expect(out).toContain("MISS");
    expect(out).toContain("low score");
    expect(out).not.toContain("fine");
  });

  it("never hides a failure even past maxRows", () => {
    const out = formatSuiteSummary(
      suite([
        result("fail one", "failed", 0, { error: "a" }),
        result("fail two", "failed", 0, { error: "b" }),
        result("fail three", "failed", 0, { error: "c" }),
        result("fine", "passed", 1),
      ]),
      { ...COMPACT, maxRows: 1 }
    );
    expect(out).toContain("fail one");
    expect(out).toContain("fail two");
    expect(out).toContain("fail three");
    expect(out).not.toContain("fine");
  });

  it("verbose shows every row and the output detail", () => {
    const out = formatSuiteSummary(
      suite([
        result("passing one", "passed", 1, { output: { score: 1 } }),
        result("a clear miss", "passed", 0, { output: { score: 0 } }),
      ]),
      { ...COMPACT, verbose: true }
    );
    expect(out).toContain("passing one");
    expect(out).toContain("a clear miss");
    expect(out).toContain("output:");
  });

  it("scoreboard renders one row per suite plus a totals line", () => {
    const out = formatScoreboard(
      [
        suite([result("a", "passed", 1)], { name: "alpha" }),
        suite([result("b", "passed", 0.5)], { name: "beta" }),
      ],
      COMPACT
    );
    expect(out).toContain("alpha");
    expect(out).toContain("beta");
    expect(out).toContain("PASS");
    expect(out).toContain("FAIL");
    expect(out).toContain("2 suites · 2/2 passed · 1 acceptance failure");
  });

  it("scoreboard collapses to a summary line for a single suite", () => {
    const out = formatScoreboard([suite([result("a", "passed", 1)])], COMPACT);
    expect(out).toBe("1 suite · 1/1 passed · 0 acceptance failures");
  });

  it("emits no ANSI when color is off and aligns table columns", () => {
    const plain = formatScoreboard(
      [
        suite([result("a", "passed", 1)], { name: "alpha" }),
        suite([result("b", "passed", 0.5)], { name: "beta" }),
      ],
      COMPACT
    );
    expect(plain).not.toContain("\x1b[");
    const lines = plain.split("\n");
    const headerIdx = lines.findIndex((l) => l.startsWith("Suite"));
    expect(headerIdx).toBeGreaterThan(-1);
    // Header and its rule line are padded to the same width.
    expect(lines[headerIdx + 1]!.length).toBe(lines[headerIdx]!.length);

    const colored = formatScoreboard(
      [
        suite([result("a", "passed", 1)], { name: "alpha" }),
        suite([result("b", "passed", 0.5)], { name: "beta" }),
      ],
      { ...COMPACT, color: true }
    );
    expect(colored).toContain("\x1b[");
  });

  describe("resolveRenderOptions", () => {
    it("defaults to compact with maxRows 10", () => {
      const o = resolveRenderOptions({}, { isTTY: false });
      expect(o.verbose).toBe(false);
      expect(o.maxRows).toBe(10);
    });

    it("honors verbose via name or alias", () => {
      expect(
        resolveRenderOptions({ PHOENIX_TEST_REPORTER: "verbose" }, {}).verbose
      ).toBe(true);
      expect(
        resolveRenderOptions({ PHOENIX_TEST_VERBOSE: "1" }, {}).verbose
      ).toBe(true);
    });

    it("parses a custom max rows", () => {
      expect(
        resolveRenderOptions({ PHOENIX_TEST_REPORTER_MAX_ROWS: "25" }, {})
          .maxRows
      ).toBe(25);
    });

    it("gates color on TTY / CI / NO_COLOR / overrides", () => {
      expect(resolveRenderOptions({}, { isTTY: true }).color).toBe(true);
      expect(resolveRenderOptions({}, { isTTY: false }).color).toBe(false);
      expect(resolveRenderOptions({ CI: "true" }, { isTTY: true }).color).toBe(
        false
      );
      expect(
        resolveRenderOptions({ NO_COLOR: "1" }, { isTTY: true }).color
      ).toBe(false);
      expect(
        resolveRenderOptions({ PHOENIX_TEST_COLOR: "true" }, { isTTY: false })
          .color
      ).toBe(true);
    });
  });
});
