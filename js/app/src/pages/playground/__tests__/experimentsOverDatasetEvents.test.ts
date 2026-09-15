import {
  createExperimentsOverDatasetRouter,
  type ExperimentsOverDatasetPayload,
} from "@phoenix/pages/playground/experimentsOverDatasetEvents";

const SPAN = {
  id: "span-1",
  tokenCountTotal: 12,
  costSummary: { total: { cost: 0.5 } },
  latencyMs: 40,
  project: { id: "project-1" },
  context: { traceId: "trace-1" },
};

function experiment(experimentId: string): ExperimentsOverDatasetPayload {
  return {
    __typename: "ChatCompletionSubscriptionExperiment",
    experimentId,
    experiment: { id: experimentId },
  };
}

function payload<T extends ExperimentsOverDatasetPayload>(value: T): T {
  return value;
}

describe("createExperimentsOverDatasetRouter", () => {
  it("maps the opening experiment payloads to the instances in task order and routes later payloads by experiment id", () => {
    const router = createExperimentsOverDatasetRouter([7, 3]);

    expect(router.route(experiment("exp-a"))).toEqual({
      type: "experimentStarted",
      instanceId: 7,
      experimentId: "exp-a",
    });
    expect(router.route(experiment("exp-b"))).toEqual({
      type: "experimentStarted",
      instanceId: 3,
      experimentId: "exp-b",
    });

    expect(
      router.route(
        payload({
          __typename: "TextChunk",
          experimentId: "exp-b",
          datasetExampleId: "example-1",
          repetitionNumber: 2,
          content: "hello",
        })
      )
    ).toEqual({
      type: "textChunk",
      instanceId: 3,
      exampleId: "example-1",
      repetitionNumber: 2,
      content: "hello",
    });

    const evaluationChunk = payload({
      __typename: "EvaluationChunk" as const,
      experimentId: "exp-a",
      datasetExampleId: "example-1",
      repetitionNumber: null,
      evaluatorName: "no_sql_in_output",
      experimentRunEvaluation: null,
      trace: null,
      error: "boom",
    });
    expect(router.route(evaluationChunk)).toEqual({
      type: "evaluation",
      instanceId: 7,
      exampleId: "example-1",
      repetitionNumber: 1,
      evaluationChunk,
    });
  });

  it("decodes runs with their span and experiment run, defaulting the repetition to 1", () => {
    const router = createExperimentsOverDatasetRouter([1]);
    router.route(experiment("exp-a"));

    expect(
      router.route(
        payload({
          __typename: "ChatCompletionSubscriptionResult",
          experimentId: "exp-a",
          datasetExampleId: "example-1",
          repetitionNumber: null,
          span: SPAN,
          experimentRun: { id: "run-1" },
        })
      )
    ).toEqual({
      type: "runCompleted",
      instanceId: 1,
      exampleId: "example-1",
      repetitionNumber: 1,
      span: SPAN,
      experimentRunId: "run-1",
    });
    expect(
      router.route(
        payload({
          __typename: "ChatCompletionSubscriptionError",
          experimentId: "exp-a",
          datasetExampleId: "example-2",
          repetitionNumber: 3,
          message: "rate limited",
          span: null,
          experimentRun: null,
        })
      )
    ).toEqual({
      type: "runFailed",
      instanceId: 1,
      exampleId: "example-2",
      repetitionNumber: 3,
      message: "rate limited",
      span: null,
      experimentRunId: null,
    });
  });

  it("treats an error without an example as a failure of the whole experiment", () => {
    const router = createExperimentsOverDatasetRouter([1]);
    router.route(experiment("exp-a"));

    expect(
      router.route(
        payload({
          __typename: "ChatCompletionSubscriptionError",
          experimentId: "exp-a",
          datasetExampleId: null,
          repetitionNumber: null,
          message: "circuit breaker tripped",
          span: null,
          experimentRun: null,
        })
      )
    ).toEqual({
      type: "experimentFailed",
      instanceId: 1,
      message: "circuit breaker tripped",
    });
    // Anything else about no example in particular carries nothing to show.
    expect(
      router.route(
        payload({
          __typename: "TextChunk",
          experimentId: "exp-a",
          datasetExampleId: null,
          repetitionNumber: null,
          content: "stray",
        })
      )
    ).toBeNull();
  });

  it("drops payloads of experiments outside the run, extra experiments, and unknown kinds", () => {
    const router = createExperimentsOverDatasetRouter([1]);
    router.route(experiment("exp-a"));

    expect(router.route(experiment("exp-b"))).toBeNull();
    expect(
      router.route(
        payload({
          __typename: "TextChunk",
          experimentId: "exp-b",
          datasetExampleId: "example-1",
          repetitionNumber: 1,
          content: "elsewhere",
        })
      )
    ).toBeNull();
    expect(
      router.route(
        payload({
          __typename: "TextChunk",
          experimentId: null,
          datasetExampleId: "example-1",
          repetitionNumber: 1,
          content: "unattributed",
        })
      )
    ).toBeNull();
    expect(
      router.route({ __typename: "%other" } as ExperimentsOverDatasetPayload)
    ).toBeNull();
    // Seeing an experiment again keeps its column rather than taking the next one.
    expect(router.route(experiment("exp-a"))).toEqual({
      type: "experimentStarted",
      instanceId: 1,
      experimentId: "exp-a",
    });
  });
});
