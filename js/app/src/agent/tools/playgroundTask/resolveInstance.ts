import type { PlaygroundState } from "@phoenix/store/playground";

import { getInstanceLabel } from "../playgroundPrompt/promptStore";
import type { PlaygroundTaskResult, ResolvedPlaygroundInstance } from "./types";

/**
 * The instance an operation addresses: `instanceId`, or the only instance
 * when it is omitted, the way `playground.prompt.read` resolves it. With
 * several instances and no id, the error lists the ids to pick from.
 */
export function resolvePlaygroundInstance(
  state: Pick<PlaygroundState, "instances">,
  instanceId?: number
): PlaygroundTaskResult<ResolvedPlaygroundInstance> {
  const { instances } = state;
  const resolvedId =
    instanceId ?? (instances.length === 1 ? instances[0]?.id : undefined);
  if (resolvedId == null) {
    return {
      ok: false,
      error: `Multiple playground instances are available. Pass one of these instance IDs: ${instances
        .map((instance) => instance.id)
        .join(", ")}.`,
    };
  }
  const index = instances.findIndex((instance) => instance.id === resolvedId);
  const instance = instances[index];
  if (!instance) {
    return {
      ok: false,
      error: `Playground instance ${resolvedId} was not found.`,
      code: "NOT_FOUND",
    };
  }
  return {
    ok: true,
    output: { instance, index, label: getInstanceLabel(index) },
  };
}
