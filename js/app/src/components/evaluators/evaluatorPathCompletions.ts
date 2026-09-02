import type { Completion, CompletionSection } from "@codemirror/autocomplete";
import { startCompletion } from "@codemirror/autocomplete";
import type { EditorView } from "@codemirror/view";

import { TYPEAHEAD_COMPLETION_CLASS_PREFIX } from "@phoenix/components/filter/styles";
import { isStringKeyedObject } from "@phoenix/typeUtils";
import { toContentPreview } from "@phoenix/utils/contentPreviewUtils";
import {
  BARE_IDENTIFIER_PATTERN,
  toBracketSegment,
} from "@phoenix/utils/jsonUtils";
import {
  parsePathSegmentRanges,
  unescapeQuotedPathKey,
} from "@phoenix/utils/objectUtils";

/** A member name being typed, up to and including the empty one. */
const PARTIAL_MEMBER_PATTERN = /^(?:[A-Za-z_][A-Za-z0-9_]*)?$/;

/** A subscript the user has opened but not yet closed: `[`, `[0`, `['inp`. */
const PARTIAL_SUBSCRIPT_PATTERN = /^\[(?:'((?:[^'\\]|\\.)*)|(\d*))?$/;

/**
 * How many members the dropdown offers while the user is browsing a level with
 * nothing typed. A record's attribute tree can be arbitrarily wide, and past a
 * screenful the list stops being browsable; typing narrows against every
 * member, not just these.
 */
export const MAX_BROWSE_MEMBERS = 30;

export function capBrowsedMembers<T>({
  members,
  isBrowsing,
}: {
  members: T[];
  isBrowsing: boolean;
}): T[] {
  return isBrowsing ? members.slice(0, MAX_BROWSE_MEMBERS) : members;
}

/**
 * Extends a path by one key, in the notation the server parses.
 *
 * Attribute keys carry dots of their own — `llm.model_name` is one key, not two
 * — so anything that is not a bare identifier is quoted into a bracket segment
 * rather than joined with a dot.
 */
export function appendPathSegment(
  parentPath: string,
  key: string,
  isIndex: boolean
): string {
  if (isIndex) {
    return `${parentPath}[${key}]`;
  }
  if (!parentPath) {
    return key;
  }
  return BARE_IDENTIFIER_PATTERN.test(key)
    ? `${parentPath}.${key}`
    : `${parentPath}${toBracketSegment(key)}`;
}

/** A field reachable one step in from a path, and the value it holds. */
export type EvaluatorPathMember = {
  key: string;
  path: string;
  value: unknown;
  isIndex: boolean;
};

export function getEvaluatorPathMembers(
  value: unknown,
  parentPath: string
): EvaluatorPathMember[] {
  if (Array.isArray(value)) {
    return value.map((child, index) => ({
      key: `${index}`,
      path: appendPathSegment(parentPath, `${index}`, true),
      value: child,
      isIndex: true,
    }));
  }
  if (isStringKeyedObject(value)) {
    return Object.entries(value).map(([key, child]) => ({
      key,
      path: appendPathSegment(parentPath, key, false),
      value: child,
      isIndex: false,
    }));
  }
  return [];
}

/**
 * The level of the record the cursor is drilling into: the complete path to its
 * left, and the member name typed into it so far.
 *
 * `from` is where that member name starts, so the typeahead matches against the
 * name alone rather than against the whole path leading to it.
 */
export type EvaluatorPathCursor = {
  containerPath: string;
  partial: string;
  from: number;
};

/**
 * Reads the path the cursor sits in. Returns null when the text to the left is
 * not a path a member could be appended to.
 *
 * A trailing member name is always taken as still being typed — `span` offers
 * the record's `span_id` and `span_kind`, and it takes the `.` in `span.` to
 * ask for what is inside it.
 */
export function getEvaluatorPathCursor(
  textBeforeCursor: string
): EvaluatorPathCursor | null {
  for (let splitAt = textBeforeCursor.length; splitAt >= 0; splitAt--) {
    const fragment = textBeforeCursor.slice(splitAt);
    let containerEnd: number;
    let partial: string;
    let from: number;

    if (fragment.startsWith("[")) {
      const subscript = PARTIAL_SUBSCRIPT_PATTERN.exec(fragment);
      if (!subscript) {
        continue;
      }
      const [, quotedKey, index] = subscript;
      containerEnd = splitAt;
      partial =
        quotedKey === undefined
          ? (index ?? "")
          : unescapeQuotedPathKey(quotedKey);
      from = splitAt + (quotedKey === undefined ? 1 : 2);
    } else if (PARTIAL_MEMBER_PATTERN.test(fragment)) {
      const isRoot = splitAt === 0;
      if (!isRoot && textBeforeCursor[splitAt - 1] !== ".") {
        continue;
      }
      containerEnd = isRoot ? 0 : splitAt - 1;
      partial = fragment;
      from = splitAt;
    } else {
      continue;
    }

    const containerPath = textBeforeCursor.slice(0, containerEnd);
    if (
      containerPath !== "" &&
      parsePathSegmentRanges(containerPath) === null
    ) {
      continue;
    }
    return { containerPath, partial, from };
  }
  return null;
}

/** The first name in a path, before any `.` or `[` that follows it. */
const PATH_HEAD_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*/;

/**
 * The path a written container names once the home it left out is filled back
 * in, or null when it already names something.
 *
 * The record's own names live under `metadata`, and the root menu offers them
 * by their whole path — which is how typing `attributes` finds
 * `metadata.attributes`. A container is read the same way: when what the
 * author wrote reaches nothing, its first name is looked up among the roots
 * and the rest is carried across, so `attributes.` opens `metadata.attributes`
 * and `attributes.llm.` the level below it.
 */
export function reachEvaluatorContainerPath({
  source,
  containerPath,
  rootPaths,
}: {
  source: Record<string, unknown>;
  containerPath: string;
  rootPaths: readonly string[];
}): string | null {
  if (
    resolveEvaluatorPath({ source, path: containerPath }).status !==
    "unresolved"
  ) {
    return null;
  }
  const head = PATH_HEAD_PATTERN.exec(containerPath)?.[0];
  if (head === undefined) {
    return null;
  }
  const tail = containerPath.slice(head.length);
  for (const rootPath of rootPaths) {
    if (!rootPath.endsWith(`.${head}`)) {
      continue;
    }
    const reached = `${rootPath}${tail}`;
    if (resolveEvaluatorPath({ source, path: reached }).status === "resolved") {
      return reached;
    }
  }
  return null;
}

/** A row that can be drilled with `.` — styled with a trailing chevron. */
export const CONTAINER_COMPLETION_TYPE = `${TYPEAHEAD_COMPLETION_CLASS_PREFIX}container`;

export function toMemberCompletionType(value: unknown): string {
  return Array.isArray(value) || isStringKeyedObject(value)
    ? CONTAINER_COMPLETION_TYPE
    : "variable";
}

export function toMemberPreview(value: unknown): string {
  if (value == null) {
    // A field with no value has nothing to preview; the name alone reads
    // cleaner than a column of "null" — which matters most when the record
    // is the generic no-values skeleton.
    return "";
  }
  if (Array.isArray(value)) {
    return `list · ${value.length}`;
  }
  if (isStringKeyedObject(value)) {
    return `object · ${Object.keys(value).length}`;
  }
  return toContentPreview(value, { maxLength: 48 }) ?? String(value);
}

/** One dropdown row: something the cursor's level can be extended with. */
export type EvaluatorPathCompletion = {
  /** The text matched against what the user has typed. */
  key: string;
  /** The whole path the row writes into the field. */
  path: string;
  /** The value the path reads on the sampled record. */
  preview: string;
  /** Which group the row sits under. */
  section: CompletionSection;
  /** Where the row sits within its group; higher comes first. */
  boost?: number;
  /** The row's completion type, which styles it. */
  type?: string;
  /** One line on what the row reaches, shown when highlighted. */
  description?: string;
  /** Whether the row names an object the path can keep reaching into. */
  drills?: boolean;
};

/**
 * Writes a row's whole path into the field. A row that names an object is not
 * a finished path: the cursor stays after a dot and the level below opens.
 */
export function applyEvaluatorPathCompletion(
  completion: EvaluatorPathCompletion
) {
  return (
    view: EditorView,
    _completion: Completion,
    _from: number,
    to: number
  ) => {
    const insert = completion.drills ? `${completion.path}.` : completion.path;
    view.dispatch({
      changes: { from: 0, to, insert },
      selection: { anchor: insert.length },
    });
    if (completion.drills) {
      startCompletion(view);
    }
  };
}

/**
 * What keeps the top level's menu matching as a name grows into a path.
 *
 * The top level offers whole `metadata.<name>` paths, so the first dot has to
 * stay inside the same result or those rows would drop out the moment they
 * start to match. A second dot leaves — that is a level the top-level list does
 * not describe, and re-querying is what opens it.
 */
export const EVALUATOR_ROOT_PATH_PATTERN = /^\w*(?:\.\w*)?$/;

/**
 * Whether a menu of whole paths stays open as the typed text grows.
 *
 * A dot keeps the result only while it still leads into one of the paths on
 * offer — `metadata.lat` is on its way to `metadata.latency_ms`, so re-querying
 * there would drop the row the moment it starts to match. A dot that leads
 * anywhere else re-queries instead, which is what opens the level below a name
 * the list only ever named in full.
 */
export function toWholePathValidFor({
  pattern,
  labels,
}: {
  pattern: RegExp;
  labels: readonly string[];
}): (text: string) => boolean {
  const offered = labels.map((label) => label.toLowerCase());
  return (text: string) => {
    if (!pattern.test(text)) {
      return false;
    }
    if (!text.includes(".")) {
      return true;
    }
    const typed = text.toLowerCase();
    return offered.some((label) => label.startsWith(typed));
  };
}

/** Pinned examples lead the root list; everything else follows in its group. */
export const SUGGESTED_PATH_SECTION: CompletionSection = {
  name: "Suggestions",
  rank: 0,
};

/**
 * A drill level is headed by the path that reaches it. The rank places that
 * heading among whatever else the surface offers alongside it.
 */
export function toMemberSection(
  containerPath: string,
  rank: number
): CompletionSection {
  return { name: containerPath, rank };
}

/** Where a drill level sits among the path field's own groups. */
export const PATH_MEMBER_SECTION_RANK = 3;

export type EvaluatorSlotSuggestedPathLike = {
  path: string;
  description: string;
};

export type EvaluatorPathCompletionResult = {
  /** Document offset the typeahead matches and replaces from. */
  from: number;
  /** The level the rows belong to; empty at the top of the context. */
  containerPath: string;
  completions: EvaluatorPathCompletion[];
};

/**
 * The rows the typeahead offers for the path being typed.
 *
 * The top level is the evaluation context itself, so `rootCandidates` names it
 * — the shared candidate tree, whose rows are already whole paths. Each `.`
 * after that opens the level below, read off the context. `suggestedPaths` are
 * whole paths worth pinning above the rest, offered only at the top and only
 * when they resolve, so a suggestion is always a path that would actually bind.
 */
export function getEvaluatorPathCompletions({
  source,
  rootCandidates = [],
  suggestedPaths = [],
  textBeforeCursor,
}: {
  /** The evaluation context a path is resolved against. */
  source: Record<string, unknown>;
  rootCandidates?: readonly EvaluatorPathCompletion[];
  suggestedPaths?: readonly EvaluatorSlotSuggestedPathLike[];
  textBeforeCursor: string;
}): EvaluatorPathCompletionResult | null {
  const cursor = getEvaluatorPathCursor(textBeforeCursor);
  if (cursor === null) {
    return null;
  }
  if (cursor.containerPath === "") {
    const suggested: EvaluatorPathCompletion[] = [];
    for (const { path, description } of suggestedPaths) {
      const resolution = resolveEvaluatorPath({ source, path });
      if (resolution.status === "resolved") {
        suggested.push({
          key: path,
          path,
          preview: toMemberPreview(resolution.value),
          section: SUGGESTED_PATH_SECTION,
          description,
        });
      }
    }
    const completions = [...suggested, ...rootCandidates];
    return completions.length === 0
      ? null
      : { from: cursor.from, containerPath: "", completions };
  }

  const reached = reachEvaluatorContainerPath({
    source,
    containerPath: cursor.containerPath,
    rootPaths: rootCandidates.map((candidate) => candidate.path),
  });
  const containerPath = reached ?? cursor.containerPath;
  const resolution = resolveEvaluatorPath({ source, path: containerPath });
  const members = getEvaluatorPathMembers(
    resolution.status === "resolved" ? resolution.value : undefined,
    containerPath
  );
  if (members.length === 0) {
    return null;
  }

  const section = toMemberSection(containerPath, PATH_MEMBER_SECTION_RANK);
  const shown = capBrowsedMembers({
    members,
    isBrowsing: cursor.partial === "",
  });
  return {
    // A level reached through a home the author left out is offered as whole
    // paths, so the typeahead matches what was written against the whole path
    // too rather than against a member name it does not lead with.
    from: reached === null ? cursor.from : 0,
    containerPath,
    completions: shown.map((member) => ({
      ...toCompletion(member, section),
      ...(reached === null ? {} : { key: member.path }),
    })),
  };
}

function toCompletion(
  member: EvaluatorPathMember,
  section: CompletionSection
): EvaluatorPathCompletion {
  return {
    key: member.key,
    path: member.path,
    preview: toMemberPreview(member.value),
    type: toMemberCompletionType(member.value),
    section,
    drills: isStringKeyedObject(member.value),
  };
}

/**
 * What became of a path written against the mapping source.
 *
 * `unverifiable` covers everything this side cannot answer — no record has been
 * sampled yet, or the path uses syntax only the server resolves — and is
 * deliberately not an error: a path is only wrong once something has actually
 * checked it.
 */
export type EvaluatorPathResolution =
  | { status: "resolved"; value: unknown }
  | { status: "unresolved"; range: { from: number; to: number } }
  | { status: "unverifiable" };

/**
 * Reads `path` against the mapping source, blaming the segment that fails.
 *
 * The source is the whole document the server resolves a mapping against, not
 * just the record the typeahead offers — a path written before the record grew
 * a root of its own still reads a real value, and must not be flagged as if it
 * named nothing.
 */
export function resolveEvaluatorPath({
  source,
  path,
}: {
  source: Record<string, unknown>;
  path: string;
}): EvaluatorPathResolution {
  if (path === "") {
    return { status: "resolved", value: undefined };
  }
  if (Object.keys(source).length === 0) {
    return { status: "unverifiable" };
  }
  const segments = parsePathSegmentRanges(path);
  if (segments === null) {
    return { status: "unverifiable" };
  }

  let current: unknown = source;
  for (const segment of segments) {
    const member = readMember(current, segment.key);
    if (!member.exists) {
      return {
        status: "unresolved",
        range: { from: segment.from, to: segment.to },
      };
    }
    current = member.value;
  }
  return { status: "resolved", value: current };
}

function readMember(
  container: unknown,
  key: string
): { exists: boolean; value: unknown } {
  if (Array.isArray(container)) {
    const index = Number(key);
    return Number.isInteger(index) && index >= 0 && index < container.length
      ? { exists: true, value: container[index] }
      : { exists: false, value: undefined };
  }
  // Own keys only: the server resolves these paths with JSONPath, which never
  // walks the prototype chain, so `in` would preview `metadata.toString` as
  // resolved and the run would then raise on a path that names nothing.
  if (isStringKeyedObject(container) && Object.hasOwn(container, key)) {
    return { exists: true, value: container[key] };
  }
  return { exists: false, value: undefined };
}
