import type { ProjectEvaluatorRecordKind } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { assertUnreachable, isStringKeyedObject } from "@phoenix/typeUtils";
import { toBracketSegment } from "@phoenix/utils/jsonUtils";

import type { EvaluatorPathStep } from "./evaluatorJsonPath";
import {
  isPlainEvaluatorPathKey,
  parseEvaluatorPath,
} from "./evaluatorJsonPath";
import type { EvaluatorPathIdea } from "./evaluatorPathCompletions";
import {
  appendPathSegment,
  isEvaluatorPathContainer,
  resolveEvaluatorPath,
} from "./evaluatorPathCompletions";

/** Subscript syntax an idea's path uses, which not every surface can write. */
export type EvaluatorPathSyntax =
  | "index"
  | "negativeIndex"
  | "wildcard"
  | "slice";

export const MAPPING_PATH_SYNTAX: ReadonlySet<EvaluatorPathSyntax> = new Set([
  "index",
  "negativeIndex",
  "wildcard",
  "slice",
]);

export const F_STRING_PATH_SYNTAX: ReadonlySet<EvaluatorPathSyntax> = new Set([
  "index",
  "negativeIndex",
]);

type CuratedEvaluatorPathIdea = {
  path: string;
  description: string;
  recordKinds: readonly ProjectEvaluatorRecordKind[];
  /** Offered in the empty field too, not only once its path is drilled into. */
  atRoot: boolean;
};

export const CURATED_EVALUATOR_PATH_IDEAS: readonly CuratedEvaluatorPathIdea[] =
  [
    {
      path: "input.messages[-1].content",
      description: "Last message",
      recordKinds: ["span"],
      atRoot: true,
    },
    {
      path: "input.messages",
      description: "Input messages",
      recordKinds: ["span"],
      atRoot: true,
    },
    {
      path: "input.tools",
      description: "Available tools",
      recordKinds: ["span"],
      atRoot: true,
    },
    {
      path: "output.messages[-1].tool_calls",
      description: "Tool calls",
      recordKinds: ["span"],
      atRoot: true,
    },
    {
      path: "output.messages[-1].content",
      description: "Reply",
      recordKinds: ["span"],
      atRoot: true,
    },
    {
      path: "output.documents[*].content",
      description: "Document text",
      recordKinds: ["span"],
      atRoot: true,
    },
    {
      path: "output.documents[0].content",
      description: "First document",
      recordKinds: ["span"],
      atRoot: true,
    },
    {
      path: "input.tools[*].function.name",
      description: "Tool names",
      recordKinds: ["span"],
      atRoot: false,
    },
    {
      path: "output.messages[-1].tool_calls[*].function.name",
      description: "Tools called",
      recordKinds: ["span"],
      atRoot: false,
    },
    {
      path: "output.messages[-1].tool_calls[-1].function.arguments",
      description: "Last call's arguments",
      recordKinds: ["span"],
      atRoot: false,
    },
    {
      path: "metadata.turns[-1].input",
      description: "Last user message",
      recordKinds: ["session"],
      atRoot: true,
    },
    {
      path: "metadata.turns[-1].output",
      description: "Last response",
      recordKinds: ["session"],
      atRoot: true,
    },
    {
      path: "metadata.turns[:-1]",
      description: "Earlier turns",
      recordKinds: ["session"],
      atRoot: true,
    },
    {
      path: "metadata.turns[*].input",
      description: "All user messages",
      recordKinds: ["session"],
      atRoot: true,
    },
  ];

/**
 * An idea built from the shape of the data. `{item}` is one item of the list,
 * `{items}` the list's own name, `{list}` the list's key, and `{field}` /
 * `{Field}` the field the most items have.
 */
type EvaluatorPathIdeaTemplate = { path: string; description: string };

const LIST_IDEA_TEMPLATES: readonly EvaluatorPathIdeaTemplate[] = [
  { path: "[0]", description: "First {item}" },
  { path: "[-1]", description: "Last {item}" },
  { path: "[*]", description: "All {items}" },
  { path: "[:-1]", description: "All but last" },
  { path: "[*].{field}", description: "{Field} of each" },
];

/** Applied to each of an object's first lists, after its curated ideas. */
const OBJECT_IDEA_TEMPLATES: readonly EvaluatorPathIdeaTemplate[] = [
  { path: "{list}[-1]", description: "Last {item}" },
  { path: "{list}[*].{field}", description: "{Field} of each {item}" },
];

const MAX_OBJECT_IDEA_LISTS = 2;

const MAX_IDEAS = 5;

/**
 * The ideas offered one level below `containerPath`, empty for the root:
 * curated ideas whose path goes through it, then ideas built from the shape of
 * what it holds, then the curated ideas this record does not have. Only ideas
 * the surface can write are kept.
 */
export function getEvaluatorPathIdeas({
  recordKind,
  source,
  containerPath,
  syntax,
}: {
  recordKind: ProjectEvaluatorRecordKind;
  source: Record<string, unknown>;
  containerPath: string;
  /** The subscript syntax the surface can write. */
  syntax: ReadonlySet<EvaluatorPathSyntax>;
}): EvaluatorPathIdea[] {
  const resolveIdeas = (candidates: readonly IdeaCandidate[]) =>
    candidates.flatMap(({ relativePath, description }) => {
      const path = joinRelativePath(containerPath, relativePath);
      return canWrite({ path, containerPath, syntax })
        ? resolveIdea({ source, path, relativePath, description })
        : [];
    });
  const curated = resolveIdeas(getCuratedIdeas({ recordKind, containerPath }));
  const generic = resolveIdeas(getGenericIdeas({ source, containerPath }));
  const ordered = [
    ...curated.filter((idea) => idea.status === "resolved"),
    ...generic.filter((idea) => idea.status === "resolved"),
    ...curated.filter((idea) => idea.status === "unresolved"),
  ];
  return ordered
    .filter(
      (idea, index) =>
        ordered.findIndex((other) => other.path === idea.path) === index
    )
    .slice(0, MAX_IDEAS);
}

function resolveIdea({
  source,
  path,
  relativePath,
  description,
}: {
  source: Record<string, unknown>;
  path: string;
  relativePath: string;
  description: string;
}): EvaluatorPathIdea[] {
  const resolution = resolveEvaluatorPath({ source, path });
  switch (resolution.status) {
    case "resolved":
      return [
        {
          path,
          relativePath,
          description,
          status: "resolved",
          value: resolution.value,
          matches: resolution.matches,
        },
      ];
    case "unresolved":
      return [{ path, relativePath, description, status: "unresolved" }];
    // With no record to read, an idea's absence has not been checked.
    case "unverifiable":
    case "invalid":
      return [];
    default:
      return assertUnreachable(resolution);
  }
}

type IdeaCandidate = { relativePath: string; description: string };

function getCuratedIdeas({
  recordKind,
  containerPath,
}: {
  recordKind: ProjectEvaluatorRecordKind;
  containerPath: string;
}): IdeaCandidate[] {
  return CURATED_EVALUATOR_PATH_IDEAS.flatMap(
    ({ path, description, recordKinds, atRoot }) => {
      if (!recordKinds.includes(recordKind)) {
        return [];
      }
      if (containerPath === "") {
        return atRoot ? [{ relativePath: path, description }] : [];
      }
      const next = path[containerPath.length];
      if (!path.startsWith(containerPath) || (next !== "." && next !== "[")) {
        return [];
      }
      return [
        {
          relativePath: path.slice(
            containerPath.length + (next === "." ? 1 : 0)
          ),
          description,
        },
      ];
    }
  );
}

function getGenericIdeas({
  source,
  containerPath,
}: {
  source: Record<string, unknown>;
  containerPath: string;
}): IdeaCandidate[] {
  const value = getSingleValue({ source, containerPath });
  if (Array.isArray(value)) {
    return LIST_IDEA_TEMPLATES.flatMap((template) =>
      fillTemplate({ template, listPath: containerPath, items: value })
    );
  }
  if (!isStringKeyedObject(value)) {
    return [];
  }
  return Object.entries(value)
    .filter(
      (entry): entry is [string, unknown[]] =>
        Array.isArray(entry[1]) && entry[1].length > 0
    )
    .slice(0, MAX_OBJECT_IDEA_LISTS)
    .flatMap(([key, items]) =>
      OBJECT_IDEA_TEMPLATES.flatMap((template) =>
        fillTemplate({
          template,
          listPath: appendPathSegment(containerPath, key, false),
          listKey: key,
          items,
        })
      )
    );
}

/** What the container holds, when it is one value rather than several matches. */
function getSingleValue({
  source,
  containerPath,
}: {
  source: Record<string, unknown>;
  containerPath: string;
}): unknown {
  if (containerPath === "") {
    return source;
  }
  const resolution = resolveEvaluatorPath({ source, path: containerPath });
  return resolution.status === "resolved" && resolution.matches.length === 1
    ? resolution.value
    : undefined;
}

function fillTemplate({
  template,
  listPath,
  listKey,
  items,
}: {
  template: EvaluatorPathIdeaTemplate;
  listPath: string;
  listKey?: string;
  items: readonly unknown[];
}): IdeaCandidate[] {
  const field = template.path.includes("{field}")
    ? getProjectedField(items)
    : null;
  if (template.path.includes("{field}") && field === null) {
    return [];
  }
  const relativePath = template.path
    .replace("{list}", listKey === undefined ? "" : toLeadingSegment(listKey))
    .replace(".{field}", field === null ? "" : toTrailingSegment(field));
  const description = template.description
    .replace("{item}", toItemNoun(listPath))
    .replace("{items}", toListWords(listPath))
    .replace("{Field}", field === null ? "" : capitalize(toWords(field)));
  return [{ relativePath, description }];
}

function joinRelativePath(containerPath: string, relativePath: string) {
  if (containerPath === "" || relativePath.startsWith("[")) {
    return `${containerPath}${relativePath}`;
  }
  return `${containerPath}.${relativePath}`;
}

function toLeadingSegment(key: string): string {
  return isPlainEvaluatorPathKey(key) ? key : toBracketSegment(key);
}

function toTrailingSegment(key: string): string {
  return isPlainEvaluatorPathKey(key) ? `.${key}` : toBracketSegment(key);
}

/** Whether the surface can write every subscript the idea adds to its level. */
function canWrite({
  path,
  containerPath,
  syntax,
}: {
  path: string;
  containerPath: string;
  syntax: ReadonlySet<EvaluatorPathSyntax>;
}): boolean {
  const parsed = parseEvaluatorPath(path);
  if (!parsed.isValid) {
    return false;
  }
  return parsed.steps
    .filter((step) => step.from >= containerPath.length)
    .every((step) => toStepSyntax(step).every((needed) => syntax.has(needed)));
}

function toStepSyntax(step: EvaluatorPathStep): EvaluatorPathSyntax[] {
  switch (step.kind) {
    case "index":
      return step.indices.map((index) =>
        index < 0 ? "negativeIndex" : "index"
      );
    case "slice":
      return step.start === null && step.end === null && step.step === null
        ? ["wildcard"]
        : ["slice"];
    case "fields":
      return step.keys.includes("*") ? ["wildcard"] : [];
    case "root":
      return [];
    default:
      return assertUnreachable(step);
  }
}

/**
 * The scalar field the most items have. Ties go to the field with the most
 * text, so a message projects its `content` rather than its `role`.
 */
function getProjectedField(items: readonly unknown[]): string | null {
  const tallies = new Map<string, { count: number; length: number }>();
  for (const item of items) {
    if (Array.isArray(item) || !isStringKeyedObject(item)) {
      continue;
    }
    for (const [key, value] of Object.entries(item)) {
      if (value == null || isEvaluatorPathContainer(value)) {
        continue;
      }
      const tally = tallies.get(key) ?? { count: 0, length: 0 };
      tallies.set(key, {
        count: tally.count + 1,
        length: tally.length + String(value).length,
      });
    }
  }
  let projected: string | null = null;
  let best = { count: 0, length: 0 };
  for (const [key, tally] of tallies) {
    if (
      tally.count > best.count ||
      (tally.count === best.count && tally.length > best.length)
    ) {
      projected = key;
      best = tally;
    }
  }
  return projected;
}

/** What one item of the list at `listPath` is called: `messages` → message. */
function toItemNoun(listPath: string): string {
  return singularize(toListWords(listPath));
}

/** The list's own name in words: `tool_calls` → tool calls. */
function toListWords(listPath: string): string {
  const parsed = parseEvaluatorPath(listPath);
  const lastStep = parsed.isValid ? parsed.steps.at(-1) : undefined;
  const name =
    lastStep?.kind === "fields" && lastStep.keys.length === 1
      ? (lastStep.keys[0].split(".").at(-1) ?? "")
      : "";
  const words = toWords(name);
  return /[a-z]/.test(words) ? words : "items";
}

function toWords(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-\s]+/g, " ")
    .trim()
    .toLowerCase();
}

function capitalize(words: string): string {
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

const SINGULAR_ENDINGS: readonly [RegExp, string][] = [
  [/ies$/, "y"],
  [/(ss|us|is)$/, "$1"],
  [/(ch|sh|x|ss|us)es$/, "$1"],
  [/s$/, ""],
];

function singularize(words: string): string {
  const rule = SINGULAR_ENDINGS.find(([ending]) => ending.test(words));
  return rule === undefined ? words : words.replace(rule[0], rule[1]);
}
