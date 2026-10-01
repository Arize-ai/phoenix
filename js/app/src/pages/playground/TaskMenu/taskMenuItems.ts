import type {
  PlaygroundEvaluatorTaskKind,
  PlaygroundInstance,
  PlaygroundInstanceSource,
  PlaygroundTaskKind,
} from "@phoenix/store/playground";

export type TaskMenuPrompt = {
  id: string;
  name: string;
  /** The version a bare prompt selection loads. */
  latestVersionId: string | null;
};

export type TaskMenuEvaluator = {
  id: string;
  name: string;
  kind: PlaygroundEvaluatorTaskKind;
};

export type TaskMenuItem = {
  key: string;
  label: string;
  evaluatorKind?: PlaygroundEvaluatorTaskKind;
  /** A "New …" action rather than a saved entity. */
  isAction?: boolean;
};

export type TaskMenuSection = {
  id: "duplicate" | "prompts" | "evaluators" | "new";
  title: string | null;
  items: TaskMenuItem[];
};

/** One kind of task in the menu: its saved items and its "New" actions. */
export type TaskMenuTab = {
  kind: PlaygroundTaskKind;
  title: string;
  sections: TaskMenuSection[];
};

const TAB_TITLES: Record<PlaygroundTaskKind, string> = {
  prompt: "Prompts",
  evaluator: "Evaluators",
};

/** Shown in the menu while the page holds more than one task. */
export const TASK_MENU_LOCK_NOTE =
  "Remove the other tasks to switch between prompts and evaluators.";

const NEW_ITEMS: Record<PlaygroundTaskKind, TaskMenuItem[]> = {
  prompt: [{ key: "new:prompt", label: "New prompt", isAction: true }],
  evaluator: [
    {
      key: "new:LLM",
      label: "New LLM evaluator",
      evaluatorKind: "LLM",
      isAction: true,
    },
    {
      key: "new:CODE",
      label: "New code evaluator",
      evaluatorKind: "CODE",
      isAction: true,
    },
  ],
};

/**
 * The tabs a task menu offers, one per kind of task. With the kind unlocked
 * both kinds have a tab; locked, only the page's kind does, so the other kind
 * cannot be mixed in. Each tab lists that kind's saved items, then its "New"
 * actions. Prompts are filtered here; evaluators arrive already filtered by
 * the server.
 */
export function getTaskMenuTabs({
  kind,
  isLocked,
  prompts,
  evaluators,
  search,
  matches,
}: {
  kind: PlaygroundTaskKind;
  isLocked: boolean;
  prompts: TaskMenuPrompt[];
  evaluators: TaskMenuEvaluator[];
  search: string;
  matches: (text: string, search: string) => boolean;
}): TaskMenuTab[] {
  const kinds: PlaygroundTaskKind[] = isLocked
    ? [kind]
    : ["prompt", "evaluator"];

  return kinds.map((tabKind) => ({
    kind: tabKind,
    title: TAB_TITLES[tabKind],
    sections: getKindSections({
      kind: tabKind,
      prompts,
      evaluators,
      search,
      matches,
    }),
  }));
}

/** A tab's sections: the saved items, if any match, then the "New" actions. */
function getKindSections({
  kind,
  prompts,
  evaluators,
  search,
  matches,
}: {
  kind: PlaygroundTaskKind;
  prompts: TaskMenuPrompt[];
  evaluators: TaskMenuEvaluator[];
  search: string;
  matches: (text: string, search: string) => boolean;
}): TaskMenuSection[] {
  const sections: TaskMenuSection[] = [];

  // The tab names the kind, so the saved items need no title of their own.
  if (kind === "prompt") {
    const items = prompts
      .filter((prompt) => !search || matches(prompt.name, search))
      .map((prompt) => ({ key: `prompt:${prompt.id}`, label: prompt.name }));

    if (items.length) {
      sections.push({ id: "prompts", title: null, items });
    }
  } else if (evaluators.length) {
    sections.push({
      id: "evaluators",
      title: null,
      items: evaluators.map((evaluator) => ({
        key: `evaluator:${evaluator.id}`,
        label: evaluator.name,
        evaluatorKind: evaluator.kind,
      })),
    });
  }

  sections.push({ id: "new", title: "New", items: NEW_ITEMS[kind] });

  return sections;
}

/** The section the Compare menu adds ahead of the task list. */
export const DUPLICATE_SECTION: TaskMenuSection = {
  id: "duplicate",
  title: null,
  items: [{ key: "duplicate", label: "Duplicate this task", isAction: true }],
};

/** The instance source a menu key stands for. */
export function parseTaskMenuKey(
  key: string,
  prompts: TaskMenuPrompt[]
): PlaygroundInstanceSource | null {
  if (key === "duplicate") {
    return { type: "duplicate" };
  }

  const separator = key.indexOf(":");

  if (separator === -1) {
    return null;
  }

  const type = key.slice(0, separator);
  const value = key.slice(separator + 1);

  switch (type) {
    case "new":
      return value === "prompt" || value === "LLM" || value === "CODE"
        ? { type: "new", kind: value }
        : null;
    case "prompt":
      return {
        type: "prompt",
        promptId: value,
        promptVersionId:
          prompts.find((prompt) => prompt.id === value)?.latestVersionId ??
          null,
        tagName: null,
      };
    case "evaluator":
      return { type: "evaluator", evaluatorId: value };
    default:
      return null;
  }
}

/** The menu key the instance's current task answers to, if any. */
export function getTaskMenuSelectedKey(
  instance: Pick<PlaygroundInstance, "task" | "prompt">
): string | null {
  if (instance.task.kind === "prompt") {
    return instance.prompt ? `prompt:${instance.prompt.id}` : null;
  }

  const { evaluatorId } = instance.task.evaluator.source;

  return evaluatorId
    ? `evaluator:${evaluatorId}`
    : `new:${instance.task.evaluator.kind}`;
}

/**
 * What the menu's trigger reads: the loaded prompt's name, the evaluator
 * draft's name, or what a nameless draft is; null for a prompt task that
 * has no prompt yet, so the trigger shows its placeholder.
 */
export function getTaskMenuLabel(
  instance: Pick<PlaygroundInstance, "task" | "prompt" | "loadingSource">
): string | null {
  if (instance.loadingSource) {
    return "Loading…";
  }

  if (instance.task.kind === "prompt") {
    return instance.prompt?.name ?? null;
  }

  const { name, kind } = instance.task.evaluator;

  return (
    name.trim() ||
    (kind === "CODE" ? "New code evaluator" : "New LLM evaluator")
  );
}
