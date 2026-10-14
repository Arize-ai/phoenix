import { assertUnreachable } from "@phoenix/typeUtils";

import type { PlaygroundDatasetExamplesTableSubscription$data } from "./__generated__/PlaygroundDatasetExamplesTableSubscription.graphql";

export type ExperimentsOverDatasetPayload =
  PlaygroundDatasetExamplesTableSubscription$data["experimentsOverDataset"];

type PayloadOf<T extends ExperimentsOverDatasetPayload["__typename"]> = Extract<
  ExperimentsOverDatasetPayload,
  { __typename: T }
>;

type RunPayload = Exclude<
  ExperimentsOverDatasetPayload,
  PayloadOf<"ChatCompletionSubscriptionExperiment"> | PayloadOf<"%other">
>;

/** The instance run (example × repetition) a payload is about. */
export type ExperimentRunKey = {
  instanceId: number;
  exampleId: string;
  repetitionNumber: number;
};

/**
 * A subscription payload decoded against the instances of the run: which
 * column it belongs to, and whether it is about the experiment as a whole or
 * one of its runs.
 */
export type ExperimentsOverDatasetEvent =
  | { type: "experimentStarted"; instanceId: number; experimentId: string }
  | { type: "experimentFailed"; instanceId: number; message: string }
  | ({
      type: "runCompleted";
      span: PayloadOf<"ChatCompletionSubscriptionResult">["span"];
      experimentRunId: string | null;
    } & ExperimentRunKey)
  | ({
      type: "runFailed";
      message: string;
      span: PayloadOf<"ChatCompletionSubscriptionError">["span"];
      experimentRunId: string | null;
    } & ExperimentRunKey)
  | ({ type: "textChunk"; content: string } & ExperimentRunKey)
  | ({
      type: "toolCallChunk";
      toolCallChunk: PayloadOf<"ToolCallChunk">;
    } & ExperimentRunKey)
  | ({
      type: "evaluation";
      evaluationChunk: PayloadOf<"EvaluationChunk">;
    } & ExperimentRunKey);

/**
 * Routes the payloads of one experimentsOverDataset subscription to the
 * instances that were run. The server opens the stream with one
 * ChatCompletionSubscriptionExperiment per task, in task order, before any
 * run payload; that order is the only link between an experiment id and its
 * instance, so the router learns it from those first payloads and reads
 * `experimentId` off everything after.
 */
export function createExperimentsOverDatasetRouter(
  taskInstanceIds: readonly number[]
) {
  const instanceIdByExperimentId = new Map<string, number>();

  return {
    /** Null for payloads that belong to no instance of this run. */
    route(
      payload: ExperimentsOverDatasetPayload
    ): ExperimentsOverDatasetEvent | null {
      if (payload.__typename === "%other") {
        return null;
      }

      if (payload.__typename === "ChatCompletionSubscriptionExperiment") {
        const experimentId = payload.experimentId ?? payload.experiment.id;

        const instanceId =
          instanceIdByExperimentId.get(experimentId) ??
          taskInstanceIds[instanceIdByExperimentId.size];

        if (instanceId == null) {
          return null;
        }

        instanceIdByExperimentId.set(experimentId, instanceId);

        return { type: "experimentStarted", instanceId, experimentId };
      }

      const instanceId =
        payload.experimentId != null
          ? instanceIdByExperimentId.get(payload.experimentId)
          : undefined;

      return instanceId == null ? null : toRunEvent(payload, instanceId);
    },
  };
}

export type ExperimentsOverDatasetRouter = ReturnType<
  typeof createExperimentsOverDatasetRouter
>;

function toRunEvent(
  payload: RunPayload,
  instanceId: number
): ExperimentsOverDatasetEvent | null {
  if (payload.datasetExampleId == null) {
    // Only an error can be about the experiment as a whole (the circuit
    // breaker tripping, say); every other payload names its run.
    return payload.__typename === "ChatCompletionSubscriptionError"
      ? { type: "experimentFailed", instanceId, message: payload.message }
      : null;
  }

  const key: ExperimentRunKey = {
    instanceId,
    exampleId: payload.datasetExampleId,
    repetitionNumber: payload.repetitionNumber ?? 1,
  };

  switch (payload.__typename) {
    case "ChatCompletionSubscriptionResult":
      return {
        type: "runCompleted",
        ...key,
        span: payload.span,
        experimentRunId: payload.experimentRun?.id ?? null,
      };
    case "ChatCompletionSubscriptionError":
      return {
        type: "runFailed",
        ...key,
        message: payload.message,
        span: payload.span,
        experimentRunId: payload.experimentRun?.id ?? null,
      };
    case "TextChunk":
      return { type: "textChunk", ...key, content: payload.content };
    case "ToolCallChunk":
      return { type: "toolCallChunk", ...key, toolCallChunk: payload };
    case "EvaluationChunk":
      return { type: "evaluation", ...key, evaluationChunk: payload };
    default:
      return assertUnreachable(payload);
  }
}
