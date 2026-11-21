import { TASK_MENU_LOCK_NOTE } from "@phoenix/pages/playground/TaskMenu/taskMenuItems";
import type {
  PlaygroundInstanceSource,
  PlaygroundNormalizedInstance,
  PlaygroundState,
  PlaygroundStore,
  PlaygroundMode,
} from "@phoenix/store/playground";
import {
  getPlaygroundMode,
  isPlaygroundModeLocked,
  PLAYGROUND_MODE_BY_TASK_TYPE,
} from "@phoenix/store/playground";
import { selectPlaygroundInstance } from "@phoenix/store/playground/selectors";

import type { TaskSource } from "./schemas";
import type { PlaygroundTaskResult } from "./types";

type TaskRejection = Extract<PlaygroundTaskResult<never>, { ok: false }>;

/** Returns the playground mode for a task source. */
export function getTaskSourceMode(
  source: Exclude<PlaygroundInstanceSource, { type: "duplicate" }>
): PlaygroundMode {
  switch (source.type) {
    case "new":
      return PLAYGROUND_MODE_BY_TASK_TYPE[source.taskType];
    case "prompt":
    case "decision":
      return "task";
    default:
      return "evaluator";
  }
}

/**
 * Whether selecting `source` swaps the instance for a fresh one. Another
 * prompt loads into a prompt task in place, as the prompt menu always has;
 * anything else is a different task.
 */
export function doesTaskSourceReplace(
  instance: Pick<PlaygroundNormalizedInstance, "task">,
  source: TaskSource
): boolean {
  return !(instance.task.type === "prompt" && source.type === "prompt");
}

/**
 * Why the task menu would refuse `source` for the instance, or null: a run
 * in progress, a page whose mode is locked to the other mode, or unsaved
 * changes the caller has not agreed to discard.
 */
export function getSelectTaskRejection({
  state,
  instance,
  label,
  source,
  discardChanges,
}: {
  state: Pick<PlaygroundState, "instances" | "dirtyInstances">;
  instance: Pick<PlaygroundNormalizedInstance, "id" | "task">;
  label: string;
  source: TaskSource;
  discardChanges: boolean;
}): TaskRejection | null {
  if (state.instances.some((candidate) => candidate.activeRunId != null)) {
    return {
      ok: false,
      error:
        "The playground is running. Wait for the run to finish, or cancel it with playground.run.cancel, before changing a task.",
    };
  }

  const pageMode = getPlaygroundMode(state.instances);

  if (
    isPlaygroundModeLocked(state.instances) &&
    getTaskSourceMode(source) !== pageMode
  ) {
    return {
      ok: false,
      error: `This page holds ${describeMode(pageMode)} and has more than one instance, so its mode is fixed. ${TASK_MENU_LOCK_NOTE}`,
    };
  }

  if (
    doesTaskSourceReplace(instance, source) &&
    state.dirtyInstances[instance.id] === true &&
    !discardChanges
  ) {
    return {
      ok: false,
      error: `Instance ${label} has unsaved changes. Save it first, or pass discardChanges: true to replace it.`,
    };
  }

  return null;
}

/** Describes the tasks available in a playground mode. */
export function describeMode(mode: PlaygroundMode): string {
  return mode === "task" ? "prompt and decision tasks" : "evaluator tasks";
}

/**
 * Makes the instance the task `source` names, the way the task menu does.
 * Returns the id of the instance that now holds the task: the same id for
 * a prompt loaded into a prompt task, a new id for a replacement; null when
 * the instance is gone.
 */
export function applyTaskSource({
  playgroundStore,
  instanceId,
  source,
}: {
  playgroundStore: PlaygroundStore;
  instanceId: number;
  source: TaskSource;
}): number | null {
  const state = playgroundStore.getState();
  const instance = selectPlaygroundInstance(instanceId)(state);

  if (!instance) {
    return null;
  }

  if (instance.task.type === "prompt" && source.type === "prompt") {
    state.updateInstance({
      instanceId,
      patch: { loadingSource: source },
      dirty: null,
    });

    return instanceId;
  }

  return state.replaceInstance({ instanceId, source });
}
