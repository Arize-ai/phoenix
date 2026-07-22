import {
  createEvaluatorStore,
  type EvaluatorStoreProps,
} from "../evaluatorStore";

const createFreeformStore = (
  evaluatorMappingSourceState?: Pick<
    EvaluatorStoreProps,
    "evaluatorMappingSource" | "evaluatorMappingSourceGrain"
  >
) =>
  createEvaluatorStore({
    evaluator: {
      kind: "CODE",
      globalName: "my_eval",
      name: "my_eval",
      description: "",
      inputMapping: { literalMapping: {}, pathMapping: {} },
      isBuiltin: false,
      includeExplanation: false,
    },
    outputConfigs: [
      {
        name: "my_eval",
        optimizationDirection: "NONE",
        threshold: null,
        lowerBound: null,
        upperBound: null,
      },
    ],
    ...evaluatorMappingSourceState,
  });

describe("evaluatorStore mapping source grain", () => {
  it("keeps span mapping sources limited to runtime context fields", () => {
    const store = createFreeformStore({
      evaluatorMappingSourceGrain: "span",
      evaluatorMappingSource: {
        input: { question: "What is Phoenix?" },
        output: { answer: "An AI observability platform" },
        metadata: { attributes: { "openinference.span.kind": "LLM" } },
      },
    });

    expect(store.getState().evaluatorMappingSource).toEqual({
      input: { question: "What is Phoenix?" },
      output: { answer: "An AI observability platform" },
      metadata: { attributes: { "openinference.span.kind": "LLM" } },
    });
    expect(store.getState().evaluator.inputMapping).toEqual({
      literalMapping: {},
      pathMapping: {},
    });
  });

  it("preserves raw string and null span input/output verbatim", () => {
    const store = createFreeformStore({
      evaluatorMappingSourceGrain: "span",
      evaluatorMappingSource: {
        input: "What is Phoenix?",
        output: null,
        metadata: { attributes: { "openinference.span.kind": "LLM" } },
      },
    });

    expect(store.getState().evaluatorMappingSource).toEqual({
      input: "What is Phoenix?",
      output: null,
      metadata: { attributes: { "openinference.span.kind": "LLM" } },
    });
  });
});

describe("evaluatorStore bounds handlers", () => {
  it("setOutputConfigLowerBoundAtIndex updates lowerBound on the freeform config", () => {
    const store = createFreeformStore();
    store.getState().setOutputConfigLowerBoundAtIndex(0, 0);
    expect(store.getState().outputConfigs[0]).toMatchObject({ lowerBound: 0 });
  });

  it("setOutputConfigUpperBoundAtIndex updates upperBound on the freeform config", () => {
    const store = createFreeformStore();
    store.getState().setOutputConfigUpperBoundAtIndex(0, 1);
    expect(store.getState().outputConfigs[0]).toMatchObject({ upperBound: 1 });
  });

  it("setOutputConfigLowerBoundAtIndex accepts null to clear the value", () => {
    const store = createFreeformStore();
    store.getState().setOutputConfigLowerBoundAtIndex(0, 0.5);
    store.getState().setOutputConfigLowerBoundAtIndex(0, null);
    expect(store.getState().outputConfigs[0]).toMatchObject({
      lowerBound: null,
    });
  });

  it("toggling optimizationDirection between NONE and MAXIMIZE preserves the threshold value", () => {
    const store = createFreeformStore();
    store.getState().setOutputConfigThresholdAtIndex(0, 0.75);
    expect(store.getState().outputConfigs[0]).toMatchObject({
      threshold: 0.75,
      optimizationDirection: "NONE",
    });

    store.getState().setOutputConfigOptimizationDirectionAtIndex(0, "MAXIMIZE");
    expect(store.getState().outputConfigs[0]).toMatchObject({
      threshold: 0.75,
      optimizationDirection: "MAXIMIZE",
    });

    store.getState().setOutputConfigOptimizationDirectionAtIndex(0, "NONE");
    expect(store.getState().outputConfigs[0]).toMatchObject({
      threshold: 0.75,
      optimizationDirection: "NONE",
    });
  });
});
