import { getDefaultCodeEvaluatorSource } from "@phoenix/components/evaluators/codeEvaluatorDefaults";
import type { ClassificationEvaluatorAnnotationConfig } from "@phoenix/types";

import type {
  PlaygroundEvaluatorTask,
  PlaygroundInstance,
  PlaygroundTaskType,
  PlaygroundMode,
} from "./types";

/**
 * Maps each task type to its playground mode.
 */
export const PLAYGROUND_MODE_BY_TASK_TYPE: Record<
  PlaygroundTaskType,
  PlaygroundMode
> = {
  prompt: "task",
  decision: "task",
  evaluator: "evaluator",
};

/** Returns the instance's task type. */
export function getPlaygroundTaskType(
  instance: Pick<PlaygroundInstance, "task">
): PlaygroundTaskType {
  return instance.task.type;
}

/** Whether the instance runs a decision rather than a chat prompt. */
export function isDecisionInstance(
  instance: Pick<PlaygroundInstance, "task"> | undefined
): boolean {
  return instance?.task.type === "decision";
}

/**
 * Returns the page's mode from its first instance. An empty page defaults
 * to task mode.
 */
export function getPlaygroundMode(
  instances: ReadonlyArray<Pick<PlaygroundInstance, "task">>
): PlaygroundMode {
  const first = instances[0];

  return first
    ? PLAYGROUND_MODE_BY_TASK_TYPE[getPlaygroundTaskType(first)]
    : "task";
}

/**
 * Whether the page's mode can still change. A lone instance may switch modes
 * by being replaced; once there is something to compare against, the mode is
 * fixed until the other instances are removed. Task types in the same mode mix
 * freely: a decision can sit beside a prompt.
 */
export function isPlaygroundModeLocked(
  instances: ReadonlyArray<unknown>
): boolean {
  return instances.length > 1;
}

/** The output a new evaluator draft starts with. */
export const DEFAULT_EVALUATOR_TASK_OUTPUT_CONFIG: ClassificationEvaluatorAnnotationConfig =
  {
    name: "result",
    optimizationDirection: "MAXIMIZE",
    values: [
      { label: "pass", score: 1 },
      { label: "fail", score: 0 },
    ],
  };

/**
 * A fresh evaluator draft of the given kind; a code draft opens on the
 * placeholder source for a dataset example. Other fields override the
 * defaults, so a fetched evaluator can be built through the same path.
 */
export function createPlaygroundEvaluatorTask({
  kind,
  ...overrides
}: Pick<PlaygroundEvaluatorTask, "kind"> &
  Partial<Omit<PlaygroundEvaluatorTask, "kind">>): PlaygroundEvaluatorTask {
  return {
    kind,
    name: "",
    description: "",
    outputConfigs: [DEFAULT_EVALUATOR_TASK_OUTPUT_CONFIG],
    inputMapping: { literalMapping: {}, pathMapping: {} },
    includeExplanation: true,
    code:
      kind === "CODE"
        ? {
            language: "PYTHON",
            sourceCode: getDefaultCodeEvaluatorSource("PYTHON", "dataset"),
            sandboxConfigId: null,
          }
        : null,
    source: {
      evaluatorId: null,
      datasetEvaluatorId: null,
      projectEvaluatorId: null,
    },
    savedContentKey: null,
    ...overrides,
  };
}

/** Narrows to the evaluator draft, or null for a prompt or decision instance. */
export function getPlaygroundEvaluatorTask(
  instance: Pick<PlaygroundInstance, "task"> | undefined
): PlaygroundEvaluatorTask | null {
  return instance?.task.type === "evaluator" ? instance.task.evaluator : null;
}
