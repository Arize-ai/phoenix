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

/** A suite whose `accuracy` acceptance criterion is forced to a given verdict. */
function suite(
  results: TestResult[],
  overrides: Partial<SuiteSummary> = {},
  passed = true
): SuiteSummary {
  return {
    name: "suite",
    results,
    acceptanceResults: [
      {
        annotationName: "accuracy",
        metric: "average",
        threshold: 0.8,
        value: passed ? 1 : 0,
        sampleCount: results.length,
        passed,
      },
    ],
    links: [{ label: "Experiment", url: "http://localhost:6006/exp/1" }],
    ...overrides,
  };
}

describe("per-suite block", () => {
  it("collapses a clean suite to a single line", () => {
    const out = formatSuiteSummary(
      suite([result("alpha", "passed", 1)]),
      COMPACT
    );
    expect(out).not.toContain("\n");
    expect(out).toContain("1/1 passed");
    expect(out).toContain("accuracy 1.00");
    expect(out).not.toContain("✗");
    expect(out).not.toContain("acceptance");
  });

  it("expands a miss into a per-row diagnosis and hides clean rows", () => {
    const out = formatSuiteSummary(
      suite([
        result("low one", "passed", 0.2, {
          output: { sql: "SELECT 1" },
          annotations: [
            { name: "accuracy", score: 0.2, explanation: "off by a column" },
          ],
          traceId: "t1",
          runId: "r1",
          exampleId: "e1",
        }),
        result("clean", "passed", 1),
      ]),
      COMPACT
    );
    expect(out).toContain("✗ low one");
    expect(out).toContain("accuracy 0.2 · off by a column");
    expect(out).toContain("output sql=");
    expect(out).toContain("trace=t1");
    expect(out).toContain("run=r1");
    expect(out).toContain("example=e1");
    expect(out).not.toContain("✗ clean");
  });

  it("humanizes a JSON test-each name into a readable title", () => {
    const out = formatSuiteSummary(
      suite([result('{"userQuery":"Show active users"}', "passed", 0)]),
      COMPACT
    );
    expect(out).toContain("✗ Show active users");
    expect(out).not.toContain('{"userQuery"');
  });

  it("shows only the sub-perfect metrics that drove a miss", () => {
    const out = formatSuiteSummary(
      suite([
        result("multi", "passed", 0, {
          annotations: [
            { name: "accuracy", score: 0, explanation: "wrong table" },
            { name: "valid_sql", score: 1, explanation: "well formed" },
          ],
        }),
      ]),
      COMPACT
    );
    expect(out).toContain("accuracy 0 · wrong table");
    // A passing 1.0 metric isn't the problem — it stays out of the rationale.
    expect(out).not.toContain("valid_sql 1 · well formed");
  });

  it("collapses a multi-line error to its first line", () => {
    const out = formatSuiteSummary(
      suite(
        [
          result("boom", "failed", 0, {
            error: "TypeError: boom\n  at file.ts:1:1\n  at file.ts:2:2",
          }),
        ],
        {},
        false
      ),
      COMPACT
    );
    expect(out).toContain("✗ boom");
    expect(out).toContain("TypeError: boom");
    expect(out).not.toContain("at file.ts:2:2");
  });

  it("surfaces only failing acceptance criteria", () => {
    const failing = suite([result("c", "passed", 0.75)], {}, false);
    const out = formatSuiteSummary(failing, COMPACT);
    expect(out).toContain("✗ acceptance");
    expect(out).toContain("accuracy average 0.000 (need mean >= 0.800");
  });

  it("prints the experiment link in a problem block", () => {
    const out = formatSuiteSummary(
      suite([result("low", "passed", 0)]),
      COMPACT
    );
    expect(out).toContain("Experiment: http://localhost:6006/exp/1");
  });

  it("caps misses and reports how many more were hidden", () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      result(`m${i}`, "passed", 0)
    );
    const out = formatSuiteSummary(suite(many), { ...COMPACT, maxRows: 5 });
    expect((out.match(/✗ m/g) ?? []).length).toBe(5);
    expect(out).toContain("… 10 more misses");
  });
});

describe("overview", () => {
  it("returns just the header line for a single suite", () => {
    const out = formatScoreboard([suite([result("a", "passed", 1)])], COMPACT);
    expect(out).toBe("Eval Results · 1 suite · 1/1 passed");
  });

  it("lists each suite with its status in a multi-suite table", () => {
    const out = formatScoreboard(
      [
        suite([result("a", "passed", 1)], { name: "alpha" }),
        suite([result("b", "passed", 0)], { name: "beta" }, false),
        {
          name: "gamma",
          results: [result("g", "passed", 0)],
          acceptanceResults: [],
          links: [],
        },
      ],
      COMPACT
    );
    expect(out).toContain(
      "Eval Results · 3 suites · 3/3 passed · 2 misses · 1 acceptance failure"
    );
    expect(out).toContain("alpha");
    expect(out).toContain("beta");
    expect(out).toContain("gamma");
    expect(out).toContain("accept ✗"); // beta failed acceptance
    expect(out).toContain("1 miss"); // gamma below bar, no criteria
    expect(out).toContain("PASS"); // alpha accept
    expect(out).toContain("FAIL"); // beta accept
  });

  it("hoists a single tracking note and never leaks the env var", () => {
    const out = formatScoreboard(
      [
        suite([result("a", "passed", 1)], {
          name: "alpha",
          trackingDisabled: true,
          trackingDisabledReason: "PHOENIX_TEST_TRACKING is disabled",
        }),
        suite([result("b", "passed", 1)], {
          name: "beta",
          trackingDisabled: true,
        }),
      ],
      COMPACT
    );
    expect(out).toContain("tracking disabled (local only)");
    expect(out).not.toContain("PHOENIX_TEST_TRACKING");
  });

  it("emits no ANSI when color is off and aligns columns", () => {
    const suites = [
      suite([result("a", "passed", 1)], { name: "alpha" }),
      suite([result("b", "passed", 0.5)], { name: "beta" }, false),
    ];
    const plain = formatScoreboard(suites, COMPACT);
    expect(plain).not.toContain("\x1b[");

    const lines = plain.split("\n");
    const header = lines.find((l) => l.startsWith("Suite"))!;
    const headerIdx = lines.indexOf(header);
    // No dashed rule line between the header and the first data row.
    expect(lines[headerIdx + 1]).not.toMatch(/^-+/);
    // The "Tests" column starts at the same offset in the header and the
    // first data row (alpha → 1/1).
    const col1 = header.indexOf("Tests");
    expect(col1).toBeGreaterThan(0);
    expect(lines[headerIdx + 1]!.slice(col1)).toMatch(/^1\/1\b/);

    const colored = formatScoreboard(suites, { ...COMPACT, color: true });
    expect(colored).toContain("\x1b[");
  });
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
      resolveRenderOptions({ PHOENIX_TEST_REPORTER_MAX_ROWS: "25" }, {}).maxRows
    ).toBe(25);
  });

  it("gates color on TTY / CI / NO_COLOR / overrides", () => {
    expect(resolveRenderOptions({}, { isTTY: true }).color).toBe(true);
    expect(resolveRenderOptions({}, { isTTY: false }).color).toBe(false);
    expect(resolveRenderOptions({ CI: "true" }, { isTTY: true }).color).toBe(
      false
    );
    expect(resolveRenderOptions({ NO_COLOR: "1" }, { isTTY: true }).color).toBe(
      false
    );
    expect(
      resolveRenderOptions({ PHOENIX_TEST_COLOR: "true" }, { isTTY: false })
        .color
    ).toBe(true);
  });
});
