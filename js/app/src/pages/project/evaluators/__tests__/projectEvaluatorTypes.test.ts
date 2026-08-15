import {
  dropOtherGrainEntityPathMappings,
  dropReferencePathMappings,
  formatProjectEvaluatorRunCounts,
  getProjectEvaluatorMappingDiagnostics,
  getProjectEvaluatorStatus,
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

describe("dropReferencePathMappings", () => {
  it("drops only reference-rooted paths", () => {
    expect(
      dropReferencePathMappings({
        literalMapping: { rubric: "helpfulness" },
        pathMapping: {
          direct: "reference",
          nested: "reference.answer",
          similarPrefix: "referenceX.answer",
          input: "input.question",
        },
      })
    ).toEqual({
      literalMapping: { rubric: "helpfulness" },
      pathMapping: {
        similarPrefix: "referenceX.answer",
        input: "input.question",
      },
    });
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

  it("counts a name the record supplies as resolved", () => {
    expect(
      getProjectEvaluatorMappingDiagnostics({
        context: { input: "hi", output: "hello", metadata: {} },
        pathMapping: {},
        variables: ["latency_ms", "made_up"],
        boundVariableNames: new Set(["latency_ms"]),
      })
    ).toEqual([
      {
        variable: "latency_ms",
        path: "latency_ms",
        status: "resolved",
        source: "record",
      },
      {
        variable: "made_up",
        path: "made_up",
        status: "missing",
        source: "context",
      },
    ]);
  });

  it("prefers an explicit mapping over a name the record supplies", () => {
    expect(
      getProjectEvaluatorMappingDiagnostics({
        context: { span: { latency_ms: 12 } },
        pathMapping: { latency_ms: "span.missing" },
        variables: ["latency_ms"],
        boundVariableNames: new Set(["latency_ms"]),
      })
    ).toEqual([
      {
        variable: "latency_ms",
        path: "span.missing",
        status: "missing",
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
            whole: "span",
            nested: "span.attributes.llm.model_name",
            bracketed: "span['a.b']",
            similarPrefix: "spanX.name",
            kept: "session.turns[0].input",
            slot: "metadata.turns",
          },
        },
        "session"
      )
    ).toEqual({
      literalMapping: { rubric: "helpfulness" },
      pathMapping: {
        similarPrefix: "spanX.name",
        kept: "session.turns[0].input",
        slot: "metadata.turns",
      },
    });
  });

  it("drops session-rooted paths when the evaluator moves to spans", () => {
    expect(
      dropOtherGrainEntityPathMappings(
        {
          literalMapping: {},
          pathMapping: {
            stale: "session.turns[0].input",
            kept: "span.attributes",
          },
        },
        "span"
      )
    ).toEqual({
      literalMapping: {},
      pathMapping: { kept: "span.attributes" },
    });
  });
});
