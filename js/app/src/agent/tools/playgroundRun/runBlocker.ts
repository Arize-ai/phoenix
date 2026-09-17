import type { PlaygroundNormalizedInstance } from "@phoenix/store/playground";

import type { EvaluatorTaskAgentHost } from "../playgroundEvaluator/types";
import { getInstanceLabel } from "../playgroundPrompt/promptStore";

/**
 * Why `playground.run` cannot start for the evaluator tasks on the page, or
 * null. Evaluators judge dataset examples, so they need a dataset, and one
 * whose editor reports a validation error would finish with no experiment;
 * the Run button is disabled or the run errors for the same reasons.
 */
export function getPlaygroundRunBlocker({
  instances,
  datasetId,
  getEvaluatorHost,
}: {
  instances: ReadonlyArray<Pick<PlaygroundNormalizedInstance, "id" | "task">>;
  datasetId: string | null;
  getEvaluatorHost: (instanceId: number) => EvaluatorTaskAgentHost | undefined;
}): string | null {
  const evaluatorTasks = instances.flatMap((instance, index) =>
    instance.task.kind === "evaluator" ? [{ instance, index }] : []
  );

  if (evaluatorTasks.length === 0) {
    return null;
  }

  if (!datasetId) {
    return "Evaluator tasks run over a dataset. Load one with playground.dataset.load before running.";
  }

  for (const { instance, index } of evaluatorTasks) {
    const label = getInstanceLabel(index);
    const host = getEvaluatorHost(instance.id);

    if (!host) {
      return `Evaluator task ${label} is still loading. Wait for it, then run again.`;
    }

    const validationError = host.read().validationError;

    if (validationError) {
      return `Evaluator task ${label} cannot run: ${validationError}`;
    }
  }

  return null;
}
