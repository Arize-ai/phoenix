import type {
  PlaygroundEvaluatorTask,
  PlaygroundState,
} from "@phoenix/store/playground";
import { getPlaygroundEvaluatorTask } from "@phoenix/store/playground";

import { resolvePlaygroundInstance } from "../playgroundTask/resolveInstance";
import type {
  PlaygroundTaskResult,
  ResolvedPlaygroundInstance,
} from "../playgroundTask/types";

export type ResolvedEvaluatorInstance = ResolvedPlaygroundInstance & {
  evaluator: PlaygroundEvaluatorTask;
};

/**
 * The evaluator task an operation addresses. A prompt task is a
 * `NOT_FOUND`: the caller wanted an evaluator, and the error points at the
 * operations that do apply to the instance.
 */
export function resolveEvaluatorInstance(
  state: Pick<PlaygroundState, "instances">,
  instanceId?: number
): PlaygroundTaskResult<ResolvedEvaluatorInstance> {
  const resolved = resolvePlaygroundInstance(state, instanceId);
  if (!resolved.ok) {
    return resolved;
  }
  const evaluator = getPlaygroundEvaluatorTask(resolved.output.instance);
  if (!evaluator) {
    const { label, instance } = resolved.output;
    return {
      ok: false,
      error: `Instance ${label} (${instance.id}) is a prompt task, not an evaluator task. Read it with playground.prompt.read, or make it an evaluator task with playground.task.select.`,
      code: "NOT_FOUND",
    };
  }
  return { ok: true, output: { ...resolved.output, evaluator } };
}
