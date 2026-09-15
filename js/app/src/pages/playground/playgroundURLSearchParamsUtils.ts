import type { PlaygroundInstance } from "@phoenix/store/playground";
import { getPlaygroundTaskKind } from "@phoenix/store/playground";

/**
 * A single prompt selection parsed from URL search params.
 */
export type PromptParam = {
  promptId: string;
  promptVersionId: string | null;
  tagName: string | null;
};

/**
 * The saved evaluator an evaluator task was loaded from. A dataset
 * evaluator id names the binding; an evaluator id names the shared
 * evaluator. Both null means a draft, which the URL cannot name.
 */
export type EvaluatorTaskParam = {
  evaluatorId: string | null;
  datasetEvaluatorId: string | null;
};

/**
 * Every task the page holds, in instance order, as the URL names it. The
 * two kinds never mix, so one family of params is written at a time.
 */
export type PlaygroundTaskParams =
  | { kind: "prompt"; prompts: PromptParam[] }
  | { kind: "evaluator"; evaluators: (EvaluatorTaskParam | null)[] };

/** Marks a page of evaluator tasks; it is what keeps a fresh draft's kind on reload. */
export const TASK_KIND_PARAM = "taskKind";

const EVALUATOR_TASK_KIND = "evaluator";

const EVALUATOR_PARAM_PATTERN = /^(evaluator|datasetEvaluator)(\d+)$/;

/** The evaluator tasks a URL names, and whether it asks for an evaluator page at all. */
export type EvaluatorTaskParamsParse = {
  isEvaluatorKind: boolean;
  evaluators: EvaluatorTaskParam[];
};

/**
 * Reads the evaluator tasks from `evaluator{n}` and `datasetEvaluator{n}`
 * params, ordered by their position `n`. Positions are compacted: the URL
 * names saved tasks only, so a gap left by a draft carries nothing.
 *
 * `isEvaluatorKind` is also true for `taskKind=evaluator` with no sources,
 * which the loader turns into a fresh evaluator draft.
 */
export function parseEvaluatorTaskParams(
  searchParams: URLSearchParams
): EvaluatorTaskParamsParse {
  const byPosition = new Map<number, EvaluatorTaskParam>();

  for (const [key, value] of searchParams.entries()) {
    const match = EVALUATOR_PARAM_PATTERN.exec(key);

    if (!match || !value) {
      continue;
    }

    const position = Number(match[2]);

    const current = byPosition.get(position) ?? {
      evaluatorId: null,
      datasetEvaluatorId: null,
    };

    byPosition.set(position, {
      ...current,
      [match[1] === "evaluator" ? "evaluatorId" : "datasetEvaluatorId"]: value,
    });
  }

  const evaluators = [...byPosition.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, param]) => param);

  return {
    isEvaluatorKind:
      evaluators.length > 0 ||
      searchParams.get(TASK_KIND_PARAM) === EVALUATOR_TASK_KIND,
    evaluators,
  };
}

/**
 * The task params the instances stand for. Prompt tasks without a saved
 * prompt are left out, as before; evaluator drafts keep their position as
 * null so the saved tasks around them keep theirs.
 */
export function getPlaygroundTaskParams(
  instances: ReadonlyArray<Pick<PlaygroundInstance, "task" | "prompt">>
): PlaygroundTaskParams {
  if (getPlaygroundTaskKind(instances) === "evaluator") {
    return {
      kind: "evaluator",
      evaluators: instances.map((instance) => {
        if (instance.task.kind !== "evaluator") {
          return null;
        }

        const { evaluatorId, datasetEvaluatorId } =
          instance.task.evaluator.source;

        return evaluatorId || datasetEvaluatorId
          ? { evaluatorId, datasetEvaluatorId }
          : null;
      }),
    };
  }

  return {
    kind: "prompt",
    prompts: instances.flatMap((instance) =>
      instance.prompt
        ? [
            {
              promptId: instance.prompt.id,
              promptVersionId: instance.prompt.version,
              tagName: instance.prompt.tag,
            },
          ]
        : []
    ),
  };
}

export function arePlaygroundTaskParamsEqual(
  left: PlaygroundTaskParams,
  right: PlaygroundTaskParams
): boolean {
  if (left.kind === "prompt" || right.kind === "prompt") {
    return (
      left.kind === "prompt" &&
      right.kind === "prompt" &&
      left.prompts.length === right.prompts.length &&
      left.prompts.every(
        (param, index) =>
          param.promptId === right.prompts[index].promptId &&
          param.promptVersionId === right.prompts[index].promptVersionId &&
          param.tagName === right.prompts[index].tagName
      )
    );
  }

  return (
    left.evaluators.length === right.evaluators.length &&
    left.evaluators.every(
      (param, index) =>
        param?.evaluatorId === right.evaluators[index]?.evaluatorId &&
        param?.datasetEvaluatorId ===
          right.evaluators[index]?.datasetEvaluatorId
    )
  );
}

/**
 * Writes the page's tasks to the URL: one family of params for the page's
 * kind, the other family removed. Returns whether anything changed.
 */
export function setPlaygroundTaskParams({
  searchParams,
  tasks,
}: {
  searchParams: URLSearchParams;
  tasks: PlaygroundTaskParams;
}): boolean {
  if (tasks.kind === "prompt") {
    const clearedEvaluators = clearEvaluatorTaskParams(searchParams);

    return (
      setPromptParams({ searchParams, prompts: tasks.prompts }) ||
      clearedEvaluators
    );
  }

  const clearedPrompts = setPromptParams({ searchParams, prompts: [] });

  return (
    setEvaluatorTaskParams({ searchParams, evaluators: tasks.evaluators }) ||
    clearedPrompts
  );
}

function getEvaluatorTaskParamKeys(searchParams: URLSearchParams): string[] {
  return [...searchParams.keys()].filter(
    (key) => key === TASK_KIND_PARAM || EVALUATOR_PARAM_PATTERN.test(key)
  );
}

function clearEvaluatorTaskParams(searchParams: URLSearchParams): boolean {
  const keys = getEvaluatorTaskParamKeys(searchParams);
  keys.forEach((key) => searchParams.delete(key));

  return keys.length > 0;
}

function setEvaluatorTaskParams({
  searchParams,
  evaluators,
}: {
  searchParams: URLSearchParams;
  evaluators: (EvaluatorTaskParam | null)[];
}): boolean {
  const next = new URLSearchParams();
  next.set(TASK_KIND_PARAM, EVALUATOR_TASK_KIND);
  evaluators.forEach((param, position) => {
    // The binding is the more specific reference: reopening it keeps Save
    // pointed at the dataset evaluator rather than the shared evaluator.
    if (param?.datasetEvaluatorId) {
      next.set(`datasetEvaluator${position}`, param.datasetEvaluatorId);
    } else if (param?.evaluatorId) {
      next.set(`evaluator${position}`, param.evaluatorId);
    }
  });
  const currentKeys = getEvaluatorTaskParamKeys(searchParams);

  const isInSync =
    currentKeys.length === [...next.keys()].length &&
    currentKeys.every((key) => searchParams.get(key) === next.get(key));

  if (isInSync) {
    return false;
  }

  currentKeys.forEach((key) => searchParams.delete(key));
  next.forEach((value, key) => searchParams.set(key, value));

  return true;
}

/**
 * Parses prompt-related search params from a URLSearchParams instance.
 * The three param arrays (`promptId`, `promptVersionId`, `promptTagName`)
 * are zipped by position into {@link PromptParam} tuples.
 *
 * Returns an empty array if no `promptId` params are present.
 */
export function parsePromptParams(
  searchParams: URLSearchParams
): PromptParam[] {
  const promptIds = searchParams.getAll("promptId");
  if (promptIds.length === 0) {
    return [];
  }

  const promptVersionIds = searchParams.getAll("promptVersionId");
  const promptTagNames = searchParams.getAll("promptTagName");

  return promptIds.map((promptId, index) => ({
    promptId,
    promptVersionId: promptVersionIds[index] || null,
    tagName: promptTagNames[index] || null,
  }));
}

/**
 * Sets prompt-related search params on a URLSearchParams instance,
 * replacing any existing prompt-related params.
 *
 * Returns `true` if the params actually changed, `false` if they were
 * already in sync.
 */
export function setPromptParams({
  searchParams,
  prompts,
}: {
  searchParams: URLSearchParams;
  prompts: PromptParam[];
}): boolean {
  const currentIds = searchParams.getAll("promptId");
  const currentVersionIds = searchParams.getAll("promptVersionId");
  const currentTagNames = searchParams.getAll("promptTagName");

  const newIds = prompts.map((prompt) => prompt.promptId);
  const newVersionIds = prompts.map((prompt) => prompt.promptVersionId ?? "");
  const newTagNames = prompts.map((prompt) => prompt.tagName ?? "");

  const idsMatch =
    currentIds.length === newIds.length &&
    currentIds.every((id, index) => id === newIds[index]);
  const versionIdsMatch =
    currentVersionIds.length === newVersionIds.length &&
    currentVersionIds.every((id, index) => id === newVersionIds[index]);
  const tagNamesMatch =
    currentTagNames.length === newTagNames.length &&
    currentTagNames.every((name, index) => name === newTagNames[index]);

  if (idsMatch && versionIdsMatch && tagNamesMatch) {
    return false;
  }

  searchParams.delete("promptId");
  searchParams.delete("promptVersionId");
  searchParams.delete("promptTagName");

  for (const prompt of prompts) {
    searchParams.append("promptId", prompt.promptId);
    searchParams.append("promptVersionId", prompt.promptVersionId ?? "");
    searchParams.append("promptTagName", prompt.tagName ?? "");
  }

  return true;
}

/**
 * Resolves the active playground datasetId.
 *
 * In experiment mode (an `experimentId` param is present) the playground store is
 * the source of truth for the datasetId — pass the store copy as `storeDatasetId`.
 * Outside experiment mode the URL `datasetId` param is authoritative; the store
 * copy is null for a URL-deep-linked dataset, so reading it instead would silently
 * no-op.
 *
 * This is intentionally URL-primary (not URL-with-store-fallback): the page store
 * is created once and is never re-synced from the URL, so on a navigation that
 * clears the URL `datasetId` without going through `setDatasetId` (e.g. browser
 * back/forward), a store fallback would keep the page wrongly in dataset mode.
 * An imperative caller that needs the synchronously-fresh store value right after a
 * `setDatasetId` (e.g. the `set_appended_messages_path` agent tool, which can run
 * before the URL catches up) should apply its own `?? storeDatasetId` fallback at
 * the call site rather than baking it in here.
 *
 * This is the single source of truth for the resolution — both the playground page
 * and the `set_appended_messages_path` agent tool depend on it staying in sync.
 */
export function resolvePlaygroundDatasetId({
  searchParams,
  storeDatasetId,
}: {
  searchParams: URLSearchParams;
  storeDatasetId: string | null;
}): string | null {
  const experimentId = searchParams.get("experimentId");
  return experimentId ? storeDatasetId : searchParams.get("datasetId");
}
