import { TASK_MENU_LOCK_NOTE } from "@phoenix/pages/playground/TaskMenu/taskMenuItems";
import type {
  PlaygroundNormalizedInstance,
  PlaygroundState,
  PlaygroundStore,
  PlaygroundTaskKind,
} from "@phoenix/store/playground";
import {
  getPlaygroundTaskKind,
  getTaskKindForNewSource,
  isTaskKindLocked,
} from "@phoenix/store/playground";
import { selectPlaygroundInstance } from "@phoenix/store/playground/selectors";

import type { TaskSource } from "./schemas";
import type { PlaygroundTaskResult } from "./types";

type TaskRejection = Extract<PlaygroundTaskResult<never>, { ok: false }>;

/** The kind of task a source produces. */
export function getTaskSourceKind(source: TaskSource): PlaygroundTaskKind {
  switch (source.type) {
    case "new":
      return getTaskKindForNewSource(source.kind);
    case "prompt":
      return "prompt";
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
  return !(instance.task.kind === "prompt" && source.type === "prompt");
}

/**
 * Why the task menu would refuse `source` for the instance, or null: a run
 * in progress, a page whose kind is locked to the other kind, or unsaved
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
  const pageKind = getPlaygroundTaskKind(state.instances);
  if (
    isTaskKindLocked(state.instances) &&
    getTaskSourceKind(source) !== pageKind
  ) {
    return {
      ok: false,
      error: `This page holds ${pageKind} tasks and has more than one instance, so its kind is fixed. ${TASK_MENU_LOCK_NOTE}`,
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
  if (instance.task.kind === "prompt" && source.type === "prompt") {
    state.updateInstance({
      instanceId,
      patch: { loadingSource: source },
      dirty: null,
    });
    return instanceId;
  }
  return state.replaceInstance({ instanceId, source });
}
