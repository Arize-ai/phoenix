import {
  dropReferencePathMappings,
  getProjectEvaluatorMappingDiagnostics,
  getSessionScopeUnschedulableReason,
  toProjectEvaluatorSamplingFraction,
  type ProjectEvaluatorScope,
} from "../projectEvaluatorTypes";

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

describe("getSessionScopeUnschedulableReason", () => {
  const sessionScope: ProjectEvaluatorScope = {
    targetType: "SESSION",
    filterCondition: "",
    samplingRate: 1,
    evaluationDelaySeconds: 300,
  };

  it.each<[string, Partial<ProjectEvaluatorScope>, string | null]>([
    ["an unfiltered, unsampled session scope", {}, null],
    [
      "a filtered session scope",
      { filterCondition: "name == 'chat'" },
      "filter",
    ],
    ["a sampled session scope", { samplingRate: 0.5 }, "sampling"],
    [
      "a filtered and sampled session scope",
      { filterCondition: "name == 'chat'", samplingRate: 0.5 },
      "filter",
    ],
    [
      "a filtered span scope",
      { targetType: "SPAN", filterCondition: "a" },
      null,
    ],
  ])("reports %s as %s", (_label, overrides, expected) => {
    expect(
      getSessionScopeUnschedulableReason({ ...sessionScope, ...overrides })
    ).toBe(expected);
  });
});

describe("getProjectEvaluatorMappingDiagnostics", () => {
  it("checks explicit and implicit mappings for declared variables only", () => {
    expect(
      getProjectEvaluatorMappingDiagnostics({
        context: {
          input: { question: "What is Phoenix?" },
          answer: "An AI observability platform",
          unrelated: true,
        },
        pathMapping: {
          question: "input.question",
          missing: "output.missing",
          complex: "metadata['custom-key']",
          unrelated: "unrelated",
        },
        variables: ["question", "answer", "missing", "complex"],
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
        variable: "complex",
        path: "metadata['custom-key']",
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
