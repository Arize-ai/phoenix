import {
  dropOtherGrainEntityPathMappings,
  formatProjectEvaluatorRunCounts,
  getProjectEvaluatorMappingDiagnostics,
  getProjectEvaluatorStatus,
  isSameInputMapping,
  toProjectEvaluatorSamplingFraction,
} from "../projectEvaluatorTypes";

const runSummary = {
  status: "HEALTHY",
  lastRunAt: "2026-08-14T12:00:00Z",
  queuedCount: 3,
  evaluatedCount: 118,
  failedCount: 2,
};

describe("getProjectEvaluatorStatus", () => {
  it("reports the run status of a schedulable evaluator", () => {
    expect(
      getProjectEvaluatorStatus({
        schedulabilityStatus: "SCHEDULABLE",
        schedulabilityReason: null,
        runSummary,
      }).label
    ).toBe("Healthy");
  });

  it("reports a blocking configuration ahead of past runs", () => {
    expect(
      getProjectEvaluatorStatus({
        schedulabilityStatus: "NOT_SCHEDULABLE",
        schedulabilityReason: "DISABLED",
        runSummary,
      })
    ).toMatchObject({
      label: "Not scheduled",
      explanation:
        "This evaluator is disabled. Enable it to resume scheduling.",
    });
  });
});

describe("formatProjectEvaluatorRunCounts", () => {
  it("omits the parts of the funnel that are empty", () => {
    expect(formatProjectEvaluatorRunCounts(runSummary)).toBe(
      "118 evaluated · 2 failed · 3 queued"
    );
    expect(
      formatProjectEvaluatorRunCounts({ ...runSummary, failedCount: 0 })
    ).toBe("118 evaluated · 3 queued");
  });
});

describe("toProjectEvaluatorSamplingFraction", () => {
  it.each([
    [-10, 0],
    [0, 0],
    [50, 0.5],
    [100, 1],
    [150, 1],
  ])("clamps %s percent to %s", (percent, expected) => {
    expect(toProjectEvaluatorSamplingFraction(percent)).toBe(expected);
  });
});

describe("getProjectEvaluatorMappingDiagnostics", () => {
  it("checks explicit and implicit mappings for declared variables only", () => {
    expect(
      getProjectEvaluatorMappingDiagnostics({
        context: {
          input: { question: "What is Phoenix?" },
          answer: "An AI observability platform",
          metadata: { "custom-key": "tagged" },
          unrelated: true,
        },
        pathMapping: {
          question: "input.question",
          missing: "output.missing",
          bracketed: "metadata['custom-key']",
          complex: "metadata[*]",
          unrelated: "unrelated",
        },
        variables: ["question", "answer", "missing", "bracketed", "complex"],
      })
    ).toEqual([
      {
        variable: "question",
        path: "input.question",
        status: "resolved",
        source: "path",
      },
      {
        variable: "answer",
        path: "answer",
        status: "resolved",
        source: "context",
      },
      {
        variable: "missing",
        path: "output.missing",
        status: "missing",
        source: "path",
      },
      {
        variable: "bracketed",
        path: "metadata['custom-key']",
        status: "resolved",
        source: "path",
      },
      {
        variable: "complex",
        path: "metadata[*]",
        status: "unverified",
        source: "path",
      },
    ]);
  });

  it("does not flag missing optional variables as errors", () => {
    expect(
      getProjectEvaluatorMappingDiagnostics({
        context: { output: "answer" },
        pathMapping: {},
        variables: ["output", "reference"],
        requiredVariables: ["output"],
      })
    ).toEqual([
      {
        variable: "output",
        path: "output",
        status: "resolved",
        source: "context",
      },
      {
        variable: "reference",
        path: "reference",
        status: "optional-missing",
        source: "context",
      },
    ]);
  });

  // An unmapped variable binds from a top-level field of the same name, never
  // by walking into the context, which is what the server does when it runs.
  it("does not resolve an unmapped variable by walking into the context", () => {
    expect(
      getProjectEvaluatorMappingDiagnostics({
        context: { metadata: { turns: [] } },
        pathMapping: {},
        variables: ["metadata.turns"],
      })
    ).toEqual([
      {
        variable: "metadata.turns",
        path: "metadata.turns",
        status: "missing",
        source: "context",
      },
    ]);
  });

  // Binding is the three top-level names and nothing else, so a record name
  // reaches the evaluator only through a path that maps it.
  it("fails an unmapped record name, and resolves the path that maps it", () => {
    expect(
      getProjectEvaluatorMappingDiagnostics({
        context: { input: "hi", output: "hello", metadata: { latency_ms: 12 } },
        pathMapping: {},
        variables: ["latency_ms"],
      })
    ).toEqual([
      {
        variable: "latency_ms",
        path: "latency_ms",
        status: "missing",
        source: "context",
      },
    ]);

    expect(
      getProjectEvaluatorMappingDiagnostics({
        context: { input: "hi", output: "hello", metadata: { latency_ms: 12 } },
        pathMapping: { latency_ms: "metadata.latency_ms" },
        variables: ["latency_ms"],
      })
    ).toEqual([
      {
        variable: "latency_ms",
        path: "metadata.latency_ms",
        status: "resolved",
        source: "path",
      },
    ]);
  });
});

describe("dropOtherGrainEntityPathMappings", () => {
  it("drops paths rooted at the record kind the evaluator no longer runs on", () => {
    expect(
      dropOtherGrainEntityPathMappings(
        {
          literalMapping: { rubric: "helpfulness" },
          pathMapping: {
            whole: "metadata.span",
            nested: "metadata.span.attributes.llm.model_name",
            bracketed: "metadata.span['a.b']",
            similarPrefix: "metadata.spanX.name",
            kept: "metadata.session.turns[0].input",
            slot: "metadata.first_input",
          },
        },
        "session"
      )
    ).toEqual({
      literalMapping: { rubric: "helpfulness" },
      pathMapping: {
        similarPrefix: "metadata.spanX.name",
        kept: "metadata.session.turns[0].input",
        slot: "metadata.first_input",
      },
    });
  });

  it("drops session-rooted paths when the evaluator moves to spans", () => {
    expect(
      dropOtherGrainEntityPathMappings(
        {
          literalMapping: {},
          pathMapping: {
            stale: "metadata.session.turns[0].input",
            kept: "metadata.span.attributes",
          },
        },
        "span"
      )
    ).toEqual({
      literalMapping: {},
      pathMapping: { kept: "metadata.span.attributes" },
    });
  });
});

describe("isSameInputMapping", () => {
  it("reads the store's copy of a stored mapping as unchanged", () => {
    // The store merges a loaded mapping onto defaults that list `literalMapping`
    // first, so its copy of an untouched mapping serializes differently from the
    // value that was loaded. Comparing the two as strings reported an edit on a
    // form nobody touched, which wrote an empty mapping over a stored `null`.
    const loaded = { pathMapping: {}, literalMapping: {} };
    const storeCopy = { literalMapping: {}, pathMapping: {} };
    expect(JSON.stringify(loaded)).not.toEqual(JSON.stringify(storeCopy));
    expect(isSameInputMapping(storeCopy, loaded)).toBe(true);

    expect(
      isSameInputMapping(
        {
          literalMapping: {},
          pathMapping: { output: "metadata.span.attributes" },
        },
        loaded
      )
    ).toBe(false);
  });
});
