import type { PlaygroundInstance } from "@phoenix/store/playground";
import { getPlaygroundMode } from "@phoenix/store/playground";

/**
 * A single prompt selection parsed from URL search params.
 */
export type PromptParam = {
  promptId: string;
  promptVersionId: string | null;
  tagName: string | null;
};

/**
 * A single decision selection parsed from URL search params: the saved
 * decision, and the version or tag a decision task was loaded at.
 */
export type DecisionParam = {
  decisionId: string;
  decisionVersionId: string | null;
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
  projectEvaluatorId: string | null;
};

const EVALUATOR_PARAM_KEYS = {
  evaluator: "evaluatorId",
  datasetEvaluator: "datasetEvaluatorId",
  projectEvaluator: "projectEvaluatorId",
} as const satisfies Record<string, keyof EvaluatorTaskParam>;

/**
 * Every task the page holds, in instance order within its member, as the URL
 * names it. The two modes never mix, so one mode's params are written at a
 * time; a task page's prompts and decisions are two families of params.
 */
export type PlaygroundTaskParams =
  | {
      mode: "task";
      prompts: PromptParam[];
      decisions: DecisionParam[];
      hasDecisionDraft?: boolean;
    }
  | { mode: "evaluator"; evaluators: (EvaluatorTaskParam | null)[] };

/** Marks a page of evaluator tasks; it is what keeps a fresh draft's mode on reload. */
export const TASK_KIND_PARAM = "taskKind";

const EVALUATOR_TASK_KIND = "evaluator";

const EVALUATOR_PARAM_PATTERN =
  /^(evaluator|datasetEvaluator|projectEvaluator)(\d+)$/;

/** The evaluator tasks a URL names, and whether it asks for an evaluator page at all. */
export type EvaluatorTaskParamsParse = {
  isEvaluatorKind: boolean;
  evaluators: EvaluatorTaskParam[];
};

/**
 * Reads the evaluator tasks from `evaluator{n}`, `datasetEvaluator{n}` and
 * `projectEvaluator{n}` params, ordered by their position `n`. Positions are compacted: the URL
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
      projectEvaluatorId: null,
    };

    byPosition.set(position, {
      ...current,
      [EVALUATOR_PARAM_KEYS[match[1] as keyof typeof EVALUATOR_PARAM_KEYS]]:
        value,
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
 * The task params the instances stand for. Prompt and decision tasks without
 * a saved prompt or decision are left out, as before; evaluator drafts keep
 * their position as null so the saved tasks around them keep theirs.
 */
export function getPlaygroundTaskParams(
  instances: ReadonlyArray<
    Pick<PlaygroundInstance, "task" | "prompt" | "decision">
  >
): PlaygroundTaskParams {
  if (getPlaygroundMode(instances) === "evaluator") {
    return {
      mode: "evaluator",
      evaluators: instances.map((instance) => {
        if (instance.task.member !== "evaluator") {
          return null;
        }

        const { evaluatorId, datasetEvaluatorId, projectEvaluatorId } =
          instance.task.evaluator.source;

        return evaluatorId || datasetEvaluatorId || projectEvaluatorId
          ? { evaluatorId, datasetEvaluatorId, projectEvaluatorId }
          : null;
      }),
    };
  }

  const prompts = instances.flatMap((instance) =>
    instance.task.member === "prompt" && instance.prompt
      ? [
          {
            promptId: instance.prompt.id,
            promptVersionId: instance.prompt.version,
            tagName: instance.prompt.tag,
          },
        ]
      : []
  );
  const decisions = instances.flatMap((instance) =>
    instance.task.member === "decision" && instance.decision
      ? [
          {
            decisionId: instance.decision.id,
            decisionVersionId: instance.decision.versionId,
            tagName: instance.decision.tag,
          },
        ]
      : []
  );
  const hasDecisionDraft =
    prompts.length === 0 &&
    decisions.length === 0 &&
    instances.some((instance) => instance.task.member === "decision");

  return {
    mode: "task",
    prompts,
    decisions,
    ...(hasDecisionDraft ? { hasDecisionDraft: true } : {}),
  };
}

export function arePlaygroundTaskParamsEqual(
  left: PlaygroundTaskParams,
  right: PlaygroundTaskParams
): boolean {
  if (left.mode === "task" || right.mode === "task") {
    return (
      left.mode === "task" &&
      right.mode === "task" &&
      Boolean(left.hasDecisionDraft) === Boolean(right.hasDecisionDraft) &&
      left.prompts.length === right.prompts.length &&
      left.prompts.every(
        (param, index) =>
          param.promptId === right.prompts[index].promptId &&
          param.promptVersionId === right.prompts[index].promptVersionId &&
          param.tagName === right.prompts[index].tagName
      ) &&
      left.decisions.length === right.decisions.length &&
      left.decisions.every(
        (param, index) =>
          param.decisionId === right.decisions[index].decisionId &&
          param.decisionVersionId ===
            right.decisions[index].decisionVersionId &&
          param.tagName === right.decisions[index].tagName
      )
    );
  }

  return (
    left.evaluators.length === right.evaluators.length &&
    left.evaluators.every(
      (param, index) =>
        param?.evaluatorId === right.evaluators[index]?.evaluatorId &&
        param?.datasetEvaluatorId ===
          right.evaluators[index]?.datasetEvaluatorId &&
        param?.projectEvaluatorId ===
          right.evaluators[index]?.projectEvaluatorId
    )
  );
}

/**
 * Writes the current mode's task selections to the URL and removes selections
 * from the other mode. Returns whether anything changed.
 */
export function setPlaygroundTaskParams({
  searchParams,
  tasks,
}: {
  searchParams: URLSearchParams;
  tasks: PlaygroundTaskParams;
}): boolean {
  if (tasks.mode === "task") {
    const clearedEvaluators = clearEvaluatorTaskParams(searchParams);
    const clearedNewDecision =
      !tasks.hasDecisionDraft && searchParams.has("newDecision");
    if (clearedNewDecision) {
      searchParams.delete("newDecision");
    }
    const setPrompts = setPromptParams({
      searchParams,
      prompts: tasks.prompts,
    });
    const setDecisions = setDecisionParams({
      searchParams,
      decisions: tasks.decisions,
    });

    return (
      setPrompts || setDecisions || clearedEvaluators || clearedNewDecision
    );
  }

  const clearedNewDecision = searchParams.has("newDecision");
  if (clearedNewDecision) {
    searchParams.delete("newDecision");
  }
  const clearedPrompts = setPromptParams({ searchParams, prompts: [] });
  const clearedDecisions = setDecisionParams({ searchParams, decisions: [] });

  return (
    setEvaluatorTaskParams({ searchParams, evaluators: tasks.evaluators }) ||
    clearedPrompts ||
    clearedDecisions ||
    clearedNewDecision
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
    // pointed at the dataset or project evaluator rather than the shared evaluator.
    if (param?.projectEvaluatorId) {
      next.set(`projectEvaluator${position}`, param.projectEvaluatorId);
    } else if (param?.datasetEvaluatorId) {
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
 * Parses decision-related search params from a URLSearchParams instance.
 * The three param arrays (`decisionId`, `decisionVersionId`,
 * `decisionTagName`) are zipped by position into {@link DecisionParam}
 * tuples, as the prompt params are.
 *
 * Returns an empty array if no `decisionId` params are present.
 */
export function parseDecisionParams(
  searchParams: URLSearchParams
): DecisionParam[] {
  const decisionIds = searchParams.getAll("decisionId");
  const versionIds = searchParams.getAll("decisionVersionId");
  const tagNames = searchParams.getAll("decisionTagName");

  return decisionIds.map((decisionId, index) => ({
    decisionId,
    decisionVersionId: versionIds[index] || null,
    tagName: tagNames[index] || null,
  }));
}

/**
 * Sets decision-related search params on a URLSearchParams instance,
 * replacing any existing ones.
 *
 * Returns `true` if the params actually changed, `false` if they were
 * already in sync.
 */
export function setDecisionParams({
  searchParams,
  decisions,
}: {
  searchParams: URLSearchParams;
  decisions: DecisionParam[];
}): boolean {
  const current = {
    ids: searchParams.getAll("decisionId"),
    versionIds: searchParams.getAll("decisionVersionId"),
    tagNames: searchParams.getAll("decisionTagName"),
  };
  const next = {
    ids: decisions.map((decision) => decision.decisionId),
    versionIds: decisions.map((decision) => decision.decisionVersionId ?? ""),
    tagNames: decisions.map((decision) => decision.tagName ?? ""),
  };
  const isInSync = (left: string[], right: string[]) =>
    left.length === right.length &&
    left.every((value, index) => value === right[index]);

  if (
    isInSync(current.ids, next.ids) &&
    isInSync(current.versionIds, next.versionIds) &&
    isInSync(current.tagNames, next.tagNames)
  ) {
    return false;
  }

  searchParams.delete("decisionId");
  searchParams.delete("decisionVersionId");
  searchParams.delete("decisionTagName");

  for (const decision of decisions) {
    searchParams.append("decisionId", decision.decisionId);
    searchParams.append("decisionVersionId", decision.decisionVersionId ?? "");
    searchParams.append("decisionTagName", decision.tagName ?? "");
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
