import { getDefaultCodeEvaluatorSource } from "@phoenix/components/evaluators/codeEvaluatorDefaults";
import type { ClassificationEvaluatorAnnotationConfig } from "@phoenix/types";

import type {
  PlaygroundEvaluatorTask,
  PlaygroundEvaluatorTaskKind,
  PlaygroundInstance,
  PlaygroundTaskKind,
} from "./types";

/**
 * The kind of task the page holds. Every instance shares it, so the first
 * instance decides; an empty page is a prompt page.
 */
export function getPlaygroundTaskKind(
  instances: ReadonlyArray<Pick<PlaygroundInstance, "task">>
): PlaygroundTaskKind {
  return instances[0]?.task.kind ?? "prompt";
}

/**
 * Whether the page's kind can still change. A lone instance may switch
 * kinds by being replaced; once there is something to compare against, the
 * kind is fixed until the other instances are removed.
 */
export function isTaskKindLocked(instances: ReadonlyArray<unknown>): boolean {
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
    source: { evaluatorId: null, datasetEvaluatorId: null },
    savedRevision: null,
    ...overrides,
  };
}

/** Narrows to the evaluator draft, or null for a prompt instance. */
export function getPlaygroundEvaluatorTask(
  instance: Pick<PlaygroundInstance, "task"> | undefined
): PlaygroundEvaluatorTask | null {
  return instance?.task.kind === "evaluator" ? instance.task.evaluator : null;
}

/** The kind a "new task" source of the given kind belongs to. */
export function getTaskKindForNewSource(
  kind: "prompt" | PlaygroundEvaluatorTaskKind
): PlaygroundTaskKind {
  return kind === "prompt" ? "prompt" : "evaluator";
}
