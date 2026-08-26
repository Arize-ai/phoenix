import {
  createEvaluatorStore,
  SESSION_EVALUATOR_MAPPING_SOURCE_DEFAULT,
  type EvaluatorStoreProps,
} from "../evaluatorStore";

const createFreeformStore = (
  evaluatorMappingSourceState?: Pick<
    EvaluatorStoreProps,
    "evaluatorMappingSource"
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
  it("keeps dataset mapping sources including reference data", () => {
    const store = createFreeformStore({
      evaluatorMappingSource: {
        grain: "dataset",
        source: {
          input: { question: "What is Phoenix?" },
          output: { answer: "An AI observability platform" },
          reference: { answer: "An observability platform for AI" },
          metadata: { category: "product" },
        },
      },
    });

    expect(store.getState().evaluatorMappingSource).toEqual({
      grain: "dataset",
      source: {
        input: { question: "What is Phoenix?" },
        output: { answer: "An AI observability platform" },
        reference: { answer: "An observability platform for AI" },
        metadata: { category: "product" },
      },
    });
  });

  it("keeps span mapping sources limited to runtime context fields", () => {
    const store = createFreeformStore({
      evaluatorMappingSource: {
        grain: "span",
        source: {
          input: { question: "What is Phoenix?" },
          output: { answer: "An AI observability platform" },
          metadata: { latency_ms: 12.5, span: { span_id: "abc123" } },
        },
      },
    });

    expect(store.getState().evaluatorMappingSource.source).toEqual({
      input: { question: "What is Phoenix?" },
      output: { answer: "An AI observability platform" },
      metadata: { latency_ms: 12.5, span: { span_id: "abc123" } },
    });
    expect(store.getState().evaluator.inputMapping).toEqual({
      literalMapping: {},
      pathMapping: {},
    });
  });

  it("keeps a recorded session context under the session grain", () => {
    const store = createFreeformStore({
      evaluatorMappingSource: {
        grain: "session",
        source: SESSION_EVALUATOR_MAPPING_SOURCE_DEFAULT,
      },
    });

    store.getState().setEvaluatorMappingSource({
      input: "hi",
      output: "hello",
      metadata: { duration_ms: 42, session: { session_id: "s-1" } },
    });

    // A dataset fallthrough would coerce input/output to objects and add
    // `reference`, silently renaming what the evaluator binds against.
    expect(store.getState().evaluatorMappingSource).toEqual({
      grain: "session",
      source: {
        input: "hi",
        output: "hello",
        metadata: { duration_ms: 42, session: { session_id: "s-1" } },
      },
    });
  });

  it("resets the source to the new grain's default when the grain changes", () => {
    const store = createFreeformStore({
      evaluatorMappingSource: {
        grain: "span",
        source: {
          input: "What is Phoenix?",
          output: "An AI observability platform",
          metadata: {},
        },
      },
    });

    store.getState().setEvaluatorMappingSourceGrain("session");

    expect(store.getState().evaluatorMappingSource).toEqual({
      grain: "session",
      source: SESSION_EVALUATOR_MAPPING_SOURCE_DEFAULT,
    });
  });

  it("preserves raw string and null span input/output verbatim", () => {
    const store = createFreeformStore({
      evaluatorMappingSource: {
        grain: "span",
        source: {
          input: "What is Phoenix?",
          output: null,
          metadata: {},
        },
      },
    });

    expect(store.getState().evaluatorMappingSource.source).toEqual({
      input: "What is Phoenix?",
      output: null,
      metadata: {},
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
