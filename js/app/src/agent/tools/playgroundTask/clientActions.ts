import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import type { PlaygroundStore } from "@phoenix/store/playground";

import { settleInstanceSource } from "./instanceLoad";
import { resolvePlaygroundInstance } from "./resolveInstance";
import type { SelectTaskInput } from "./schemas";
import { applyTaskSource, getSelectTaskRejection } from "./selectTask";
import type { WaitForEvaluatorTaskHost } from "./taskSnapshot";
import { readTaskSnapshot } from "./taskSnapshot";

/**
 * Creates the handler for `playground.task.select`: what picking an item in
 * the task menu does, then a wait for the task to land and the snapshot of
 * the instance in the shape of its kind's read operation.
 */
export function createSelectTaskClientAction({
  playgroundStore,
  waitForEvaluatorHost,
}: {
  playgroundStore: PlaygroundStore;
  waitForEvaluatorHost: WaitForEvaluatorTaskHost;
}) {
  return async (input: SelectTaskInput): Promise<UIOperationResult> => {
    const resolved = resolvePlaygroundInstance(
      playgroundStore.getState(),
      input.instanceId
    );
    if (!resolved.ok) {
      return resolved;
    }
    const { instance, label } = resolved.output;
    const rejection = getSelectTaskRejection({
      state: playgroundStore.getState(),
      instance,
      label,
      source: input.source,
      discardChanges: input.discardChanges,
    });
    if (rejection) {
      return rejection;
    }
    const targetId = applyTaskSource({
      playgroundStore,
      instanceId: instance.id,
      source: input.source,
    });
    if (targetId == null) {
      return {
        ok: false,
        error: `Playground instance ${instance.id} could not take the task.`,
        code: "NOT_FOUND",
      };
    }
    const failure = await settleInstanceSource({
      playgroundStore,
      instanceId: targetId,
      source: input.source,
    });
    if (failure) {
      return failure;
    }
    return readTaskSnapshot({
      playgroundStore,
      instanceId: targetId,
      waitForEvaluatorHost,
    });
  };
}
