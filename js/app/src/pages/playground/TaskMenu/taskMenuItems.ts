import type {
  PlaygroundEvaluatorTaskKind,
  PlaygroundInstance,
  PlaygroundInstanceSource,
  PlaygroundTaskMember,
  PlaygroundMode,
} from "@phoenix/store/playground";
import { PLAYGROUND_MODE_BY_MEMBER } from "@phoenix/store/playground";

export type TaskMenuPrompt = {
  id: string;
  name: string;
  /** The version a bare prompt selection loads. */
  latestVersionId: string | null;
};

export type TaskMenuDecision = {
  id: string;
  name: string;
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
  id: "duplicate" | "prompts" | "decisions" | "evaluators" | "new";
  title: string | null;
  items: TaskMenuItem[];
};

/** One member of the tasks in the menu: its saved items and its "New" actions. */
export type TaskMenuTab = {
  member: PlaygroundTaskMember;
  title: string;
  sections: TaskMenuSection[];
};

/** The tabs in the order the menu shows them, grouped by mode. */
const TAB_MEMBERS: PlaygroundTaskMember[] = ["prompt", "decision", "evaluator"];

const TAB_TITLES: Record<PlaygroundTaskMember, string> = {
  prompt: "Prompts",
  decision: "Decisions",
  evaluator: "Evaluators",
};

/** Shown in the menu while the page holds more than one task. */
export const TASK_MENU_LOCK_NOTE =
  "Prompts and decisions can share a page; evaluators run alone. Remove the other tasks to switch.";

const NEW_ITEMS: Record<PlaygroundTaskMember, TaskMenuItem[]> = {
  prompt: [{ key: "new:prompt", label: "New prompt", isAction: true }],
  decision: [{ key: "new:decision", label: "New decision", isAction: true }],
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
 * The tabs a task menu offers, one per member of the tasks. With the mode
 * unlocked every member has a tab, grouped by mode: prompts and decisions
 * (task mode), then evaluators (evaluator mode). Locked, only the members available in the current mode
 * do, so a task of the other mode cannot be mixed in; prompts and decisions
 * mix freely. Each tab lists that member's saved items, then its "New"
 * actions. Prompts are filtered here; decisions and evaluators arrive already
 * filtered by the server.
 */
export function getTaskMenuTabs({
  mode,
  isLocked,
  prompts,
  decisions,
  evaluators,
  search,
  matches,
}: {
  mode: PlaygroundMode;
  isLocked: boolean;
  prompts: TaskMenuPrompt[];
  decisions: TaskMenuDecision[];
  evaluators: TaskMenuEvaluator[];
  search: string;
  matches: (text: string, search: string) => boolean;
}): TaskMenuTab[] {
  const members = TAB_MEMBERS.filter(
    (member) => !isLocked || PLAYGROUND_MODE_BY_MEMBER[member] === mode
  );

  return members.map((member) => ({
    member,
    title: TAB_TITLES[member],
    sections: getMemberSections({
      member,
      prompts,
      decisions,
      evaluators,
      search,
      matches,
    }),
  }));
}

/** A tab's sections: the saved items, if any match, then the "New" actions. */
function getMemberSections({
  member,
  prompts,
  decisions,
  evaluators,
  search,
  matches,
}: {
  member: PlaygroundTaskMember;
  prompts: TaskMenuPrompt[];
  decisions: TaskMenuDecision[];
  evaluators: TaskMenuEvaluator[];
  search: string;
  matches: (text: string, search: string) => boolean;
}): TaskMenuSection[] {
  const sections: TaskMenuSection[] = [];

  // The tab names the member, so the saved items need no title of their own.
  if (member === "prompt") {
    const items = prompts
      .filter((prompt) => !search || matches(prompt.name, search))
      .map((prompt) => ({ key: `prompt:${prompt.id}`, label: prompt.name }));

    if (items.length) {
      sections.push({ id: "prompts", title: null, items });
    }
  } else if (member === "decision") {
    if (decisions.length) {
      sections.push({
        id: "decisions",
        title: null,
        items: decisions.map((decision) => ({
          key: `decision:${decision.id}`,
          label: decision.name,
        })),
      });
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

  sections.push({ id: "new", title: "New", items: NEW_ITEMS[member] });

  return sections;
}

/** The section the Compare menu adds ahead of the task list. */
export const DUPLICATE_SECTION: TaskMenuSection = {
  id: "duplicate",
  title: null,
  items: [{ key: "duplicate", label: "Duplicate this task", isAction: true }],
};

/**
 * Whether choosing `source` for the instance loads it into the same task
 * rather than replacing the task: another prompt into a prompt task, another
 * decision into a decision task.
 */
export function doesSourceLoadInPlace(
  member: PlaygroundTaskMember,
  source: PlaygroundInstanceSource
): boolean {
  return (
    (member === "prompt" && source.type === "prompt") ||
    (member === "decision" && source.type === "decision")
  );
}

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
      return value === "prompt" ||
        value === "decision" ||
        value === "LLM" ||
        value === "CODE"
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
    case "decision":
      // A bare decision selection loads its latest version.
      return {
        type: "decision",
        decisionId: value,
        decisionVersionId: null,
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
  instance: Pick<PlaygroundInstance, "task" | "prompt" | "decision">
): string | null {
  if (instance.task.member === "prompt") {
    return instance.prompt ? `prompt:${instance.prompt.id}` : null;
  }

  if (instance.task.member === "decision") {
    return instance.decision
      ? `decision:${instance.decision.id}`
      : "new:decision";
  }

  const { evaluatorId } = instance.task.evaluator.source;

  return evaluatorId
    ? `evaluator:${evaluatorId}`
    : `new:${instance.task.evaluator.kind}`;
}

/**
 * What the menu's trigger reads: the loaded prompt's or decision's name, the
 * evaluator draft's name, or what a nameless draft is; null for a prompt task
 * that has no prompt yet, so the trigger shows its placeholder.
 */
export function getTaskMenuLabel(
  instance: Pick<
    PlaygroundInstance,
    "task" | "prompt" | "decision" | "loadingSource"
  >
): string | null {
  if (instance.loadingSource) {
    return "Loading…";
  }

  if (instance.task.member === "prompt") {
    return instance.prompt?.name ?? null;
  }

  if (instance.task.member === "decision") {
    return instance.decision?.name ?? "New decision";
  }

  const { name, kind } = instance.task.evaluator;

  return (
    name.trim() ||
    (kind === "CODE" ? "New code evaluator" : "New LLM evaluator")
  );
}
