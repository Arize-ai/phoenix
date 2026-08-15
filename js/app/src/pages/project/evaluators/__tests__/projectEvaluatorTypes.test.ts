import {
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
      },
      { variable: "answer", path: "answer", status: "resolved" },
      {
        variable: "missing",
        path: "output.missing",
        status: "missing",
      },
      {
        variable: "bracketed",
        path: "metadata['custom-key']",
        status: "resolved",
      },
      {
        variable: "complex",
        path: "metadata[*]",
        status: "unverified",
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
      { variable: "output", path: "output", status: "resolved" },
      {
        variable: "reference",
        path: "reference",
        status: "optional-missing",
      },
    ]);
  });
});
