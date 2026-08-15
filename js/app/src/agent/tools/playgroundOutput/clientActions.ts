import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type {
  PlaygroundNormalizedInstance,
  PlaygroundStore,
} from "@phoenix/store/playground";

import { getInstanceLabel } from "../playgroundPrompt";
import { parseReadPlaygroundOutputInput } from "./parsers";
import type {
  PlaygroundOutputInstanceSnapshot,
  PlaygroundOutputRepetitionSnapshot,
  PlaygroundOutputRunStatus,
} from "./types";

function getRunStatus(
  instances: PlaygroundOutputInstanceSnapshot[]
): PlaygroundOutputRunStatus {
  const repetitions = instances.flatMap((instance) => instance.repetitions);
  if (repetitions.length === 0) {
    return "not_started";
  }

  const hasRunningRepetition = repetitions.some(
    (repetition) =>
      repetition.status === "pending" ||
      repetition.status === "streamInProgress"
  );
  const hasFinishedRepetition = repetitions.some(
    (repetition) => repetition.status === "finished"
  );

  if (hasRunningRepetition && hasFinishedRepetition) {
    return "partial";
  }
  if (hasRunningRepetition) {
    return "running";
  }
  if (hasFinishedRepetition) {
    return "finished";
  }
  return "not_started";
}

function hasRunData(repetition: PlaygroundOutputRepetitionSnapshot): boolean {
  return (
    repetition.status !== "notStarted" ||
    repetition.rawOutput != null ||
    repetition.traceId != null ||
    repetition.spanNodeId != null ||
    repetition.error != null ||
    repetition.toolCalls.length > 0
  );
}

function buildInstanceSnapshot({
  instance,
  instanceIndex,
  repetitionNumber,
}: {
  instance: PlaygroundNormalizedInstance;
  instanceIndex: number;
  repetitionNumber?: number;
}): PlaygroundOutputInstanceSnapshot {
  const repetitions = Object.entries(instance.repetitions)
    .map(([key, repetition]) => ({
      repetitionNumber: Number(key),
      repetition,
    }))
    .filter(
      (
        entry
      ): entry is {
        repetitionNumber: number;
        repetition: NonNullable<
          PlaygroundNormalizedInstance["repetitions"][number]
        >;
      } =>
        entry.repetition != null &&
        Number.isInteger(entry.repetitionNumber) &&
        (repetitionNumber == null ||
          entry.repetitionNumber === repetitionNumber)
    )
    .sort((left, right) => left.repetitionNumber - right.repetitionNumber)
    .map(({ repetitionNumber, repetition }) => ({
      repetitionNumber,
      status: repetition.status,
      rawOutput: repetition.output,
      traceId: repetition.traceId ?? null,
      spanNodeId: repetition.spanId,
      error: repetition.error,
      toolCalls: Object.values(repetition.toolCalls),
    }));

  return {
    instanceId: instance.id,
    index: instanceIndex,
    label: getInstanceLabel(instanceIndex),
    activeRunId: instance.activeRunId,
    repetitions,
  };
}

/**
 * Creates the client action handler for read_playground_output.
 * Returns raw playground run output and trace IDs from mounted browser state.
 */
export function createReadPlaygroundOutputClientAction({
  playgroundStore,
}: {
  playgroundStore: PlaygroundStore;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseReadPlaygroundOutputInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid read_playground_output input." };
    }

    const state = playgroundStore.getState();
    const selectedInstances =
      parsed.instanceId == null
        ? state.instances
        : state.instances.filter(
            (instance) => instance.id === parsed.instanceId
          );

    if (parsed.instanceId != null && selectedInstances.length === 0) {
      return {
        ok: false,
        error: `Playground instance ${parsed.instanceId} was not found.`,
      };
    }

    const instances = selectedInstances.map((instance) =>
      buildInstanceSnapshot({
        instance,
        instanceIndex: state.instances.findIndex(
          (candidate) => candidate.id === instance.id
        ),
        repetitionNumber: parsed.repetitionNumber,
      })
    );

    const repetitions = instances.flatMap((instance) => instance.repetitions);
    const hasAnyRunData = repetitions.some(hasRunData);
    if (!hasAnyRunData) {
      return {
        ok: false,
        error:
          "No playground run output is available. Call run_playground first, then read the output after the run starts or finishes.",
      };
    }

    const status = getRunStatus(instances);
    const output = {
      status,
      instances,
      message:
        status === "running" || status === "partial"
          ? "The playground run is still in progress. Read again after it finishes for final output and traceId values."
          : "Playground output read.",
    };

    return {
      ok: true,
      output: JSON.stringify(output, null, 2),
    };
  };
}
