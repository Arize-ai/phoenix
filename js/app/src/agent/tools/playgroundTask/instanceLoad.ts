import type {
  PlaygroundInstanceSource,
  PlaygroundNormalizedInstance,
  PlaygroundState,
  PlaygroundStore,
} from "@phoenix/store/playground";
import { getPlaygroundEvaluatorTask } from "@phoenix/store/playground";
import { selectPlaygroundInstance } from "@phoenix/store/playground/selectors";
import { assertUnreachable } from "@phoenix/typeUtils";

import type { PlaygroundTaskResult } from "./types";

/** How long a saved prompt or evaluator may take to land in its instance. */
export const INSTANCE_LOAD_TIMEOUT_MS = 15_000;

function isInstanceSettled(state: PlaygroundState, instanceId: number) {
  return selectPlaygroundInstance(instanceId)(state)?.loadingSource == null;
}

/**
 * Resolves with true once the instance no longer carries a `loadingSource`
 * (its content landed, the load failed, or the instance is gone), or with
 * false when that takes longer than `timeoutMs`. Subscribes to the store
 * instead of polling it.
 */
export function waitForInstanceLoad(
  playgroundStore: PlaygroundStore,
  instanceId: number,
  timeoutMs = INSTANCE_LOAD_TIMEOUT_MS
): Promise<boolean> {
  if (isInstanceSettled(playgroundStore.getState(), instanceId)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeoutMs);

    const unsubscribe = playgroundStore.subscribe((state) => {
      if (!isInstanceSettled(state, instanceId)) {
        return;
      }

      clearTimeout(timer);
      unsubscribe();
      resolve(true);
    });
  });
}

/**
 * Whether the instance holds what `source` names. A fresh draft always
 * does; a saved source must have landed its prompt or evaluator reference,
 * which a failed load leaves unset.
 */
export function hasInstanceLoaded(
  instance: Pick<PlaygroundNormalizedInstance, "prompt" | "task">,
  source: PlaygroundInstanceSource
): boolean {
  switch (source.type) {
    case "new":
    case "duplicate":
      return true;
    case "prompt":
      return (
        instance.prompt?.id === source.promptId &&
        (source.promptVersionId == null ||
          instance.prompt.version === source.promptVersionId)
      );
    case "evaluator":
      return (
        getPlaygroundEvaluatorTask(instance)?.source.evaluatorId ===
        source.evaluatorId
      );
    case "datasetEvaluator":
      return (
        getPlaygroundEvaluatorTask(instance)?.source.datasetEvaluatorId ===
        source.datasetEvaluatorId
      );
    case "projectEvaluator":
      return (
        getPlaygroundEvaluatorTask(instance)?.source.projectEvaluatorId ===
        source.projectEvaluatorId
      );
    default:
      return assertUnreachable(source);
  }
}

function describeLoadFailure(source: PlaygroundInstanceSource): string {
  switch (source.type) {
    case "prompt":
      return `Prompt ${source.promptId} could not be loaded. It may have been deleted, or it is not a chat prompt.`;
    case "evaluator":
      return `Evaluator ${source.evaluatorId} could not be loaded. It may have been deleted, or it is a built-in evaluator, which the playground cannot edit.`;
    case "datasetEvaluator":
      return `Dataset evaluator ${source.datasetEvaluatorId} could not be loaded. It may have been deleted, or it binds a built-in evaluator, which the playground cannot edit.`;
    case "projectEvaluator":
      return `Project evaluator ${source.projectEvaluatorId} could not be loaded. It may have been deleted, or it binds a built-in evaluator, which the playground cannot edit.`;
    default:
      return "The task could not be loaded.";
  }
}

/**
 * Waits for the instance to finish loading `source`, then checks the load
 * landed. Resolves null on success, otherwise the failure the operation
 * should resolve with: a timeout, or `NOT_FOUND` for a source that could
 * not be loaded.
 */
export async function settleInstanceSource({
  playgroundStore,
  instanceId,
  source,
}: {
  playgroundStore: PlaygroundStore;
  instanceId: number;
  source: PlaygroundInstanceSource;
}): Promise<Extract<PlaygroundTaskResult<never>, { ok: false }> | null> {
  const settled = await waitForInstanceLoad(playgroundStore, instanceId);

  if (!settled) {
    return {
      ok: false,
      error: `The task is still loading after ${INSTANCE_LOAD_TIMEOUT_MS / 1000}s. Read the instance again before continuing.`,
    };
  }

  const instance = selectPlaygroundInstance(instanceId)(
    playgroundStore.getState()
  );

  if (!instance) {
    return {
      ok: false,
      error: `Playground instance ${instanceId} was removed while its task loaded.`,
      code: "NOT_FOUND",
    };
  }

  if (!hasInstanceLoaded(instance, source)) {
    return { ok: false, error: describeLoadFailure(source), code: "NOT_FOUND" };
  }

  return null;
}
