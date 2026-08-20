import { isStringKeyedObject } from "@phoenix/typeUtils";
import { toContentPreview } from "@phoenix/utils/contentPreviewUtils";
import { toBracketSegment } from "@phoenix/utils/jsonUtils";
import { parsePathSegmentRanges } from "@phoenix/utils/objectUtils";

const BARE_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

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

/** The members of `value`, as the paths that read them. */
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
      partial = quotedKey?.replace(/\\(.)/g, "$1") ?? index ?? "";
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

/**
 * What a row shows to the right of the member name: the value the member holds
 * on the sampled record, or what kind of thing it is when the member is a
 * branch to drill into rather than a value to read.
 */
function toMemberPreview(value: unknown): string {
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
    return "object";
  }
  return toContentPreview(value, { maxLength: 48 }) ?? String(value);
}

/** One dropdown row: a member of the level the cursor is in. */
export type EvaluatorPathCompletion = {
  /** The member name, matched against what the user has typed. */
  key: string;
  /** The whole path the row writes into the field. */
  path: string;
  /** The member's value on the sampled record. */
  preview: string;
  /** Which group the row sits under. */
  section: EvaluatorPathCompletionSection;
};

export type EvaluatorPathCompletionSection = "suggested" | "members";

export type EvaluatorPathCompletionResult = {
  /** Document offset the typeahead matches and replaces from. */
  from: number;
  /** The level the rows belong to; names the dropdown's member group. */
  containerPath: string;
  completions: EvaluatorPathCompletion[];
};

/**
 * The members the typeahead offers for the path being typed.
 *
 * The vocabulary is the record itself: `rootToken` (`span`, `session`) names it,
 * the root level offers the record's own fields, and each `.` opens the level
 * below. `suggestedPaths` names root-relative paths worth pinning above the
 * rest — worked examples of what a mapping can reach. They are offered only at
 * the root, and only when they resolve on the record, so a suggestion is
 * always a path that would actually bind.
 */
export function getEvaluatorPathCompletions({
  source,
  rootToken,
  suggestedPaths = [],
  textBeforeCursor,
}: {
  /** The mapping source a path is resolved against. */
  source: Record<string, unknown>;
  rootToken: string;
  suggestedPaths?: readonly string[];
  textBeforeCursor: string;
}): EvaluatorPathCompletionResult | null {
  const cursor = getEvaluatorPathCursor(textBeforeCursor);
  if (cursor === null) {
    return null;
  }
  const isRoot = cursor.containerPath === "";
  const containerPath = isRoot ? rootToken : cursor.containerPath;
  const resolution = resolveEvaluatorPath({ source, path: containerPath });
  const members = getEvaluatorPathMembers(
    resolution.status === "resolved" ? resolution.value : undefined,
    containerPath
  );
  if (members.length === 0) {
    return null;
  }

  const isBrowsing = cursor.partial === "";
  const suggested: EvaluatorPathCompletion[] = [];
  if (isRoot) {
    for (const relativePath of suggestedPaths) {
      const path = `${rootToken}.${relativePath}`;
      const resolution = resolveEvaluatorPath({ source, path });
      if (resolution.status === "resolved") {
        suggested.push({
          key: relativePath,
          path,
          preview: toMemberPreview(resolution.value),
          section: "suggested",
        });
      }
    }
  }

  return {
    from: cursor.from,
    containerPath,
    completions: [
      ...suggested,
      ...(isBrowsing ? members.slice(0, MAX_BROWSE_MEMBERS) : members).map(
        (member) => toCompletion(member, "members")
      ),
    ],
  };
}

function toCompletion(
  member: EvaluatorPathMember,
  section: EvaluatorPathCompletionSection
): EvaluatorPathCompletion {
  return {
    key: member.key,
    path: member.path,
    preview: toMemberPreview(member.value),
    section,
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
  if (isStringKeyedObject(container) && key in container) {
    return { exists: true, value: container[key] };
  }
  return { exists: false, value: undefined };
}
