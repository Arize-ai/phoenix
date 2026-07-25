import type { ColumnSort } from "@tanstack/react-table";

import type {
  ProjectSessionColumn,
  ProjectSessionSort,
  SessionsTableQuery$variables,
} from "./__generated__/SessionsTableQuery.graphql";
import type {
  EvalAttr,
  SpanColumn,
  SpanSort,
  TracesTableQuery$variables,
} from "./__generated__/TracesTableQuery.graphql";

export const ANNOTATIONS_COLUMN_PREFIX = "annotations";
export const TRACE_ANNOTATIONS_COLUMN_PREFIX = "trace-annotations";
export const ANNOTATIONS_KEY_SEPARATOR = "-";
export const TRACE_ANNOTATIONS_COLUMN_ID = "traceAnnotations";
export const TRACE_ANNOTATIONS_COLUMN_LABEL = "trace annotations";
export const DEFAULT_SORT: SpanSort = {
  col: "startTime",
  dir: "desc",
};

export const DEFAULT_SESSION_SORT: ProjectSessionSort = {
  col: "startTime",
  dir: "desc",
};

/**
 * Sortable columns, keyed so the record is exhaustive: adding a column to the
 * GraphQL schema fails to compile here until it is listed, and removing one is
 * caught too. That is what lets the guards below narrow a raw column id without
 * asserting.
 */
const SPAN_COLUMNS = {
  cumulativeTokenCostTotal: true,
  cumulativeTokenCountCompletion: true,
  cumulativeTokenCountPrompt: true,
  cumulativeTokenCountTotal: true,
  endTime: true,
  latencyMs: true,
  startTime: true,
  tokenCostTotal: true,
  tokenCountCompletion: true,
  tokenCountPrompt: true,
  tokenCountTotal: true,
} satisfies Record<SpanColumn, true>;

const PROJECT_SESSION_COLUMNS = {
  costTotal: true,
  endTime: true,
  numTraces: true,
  startTime: true,
  tokenCountTotal: true,
} satisfies Record<ProjectSessionColumn, true>;

function isSpanColumn(value: string): value is SpanColumn {
  return value in SPAN_COLUMNS;
}

function isProjectSessionColumn(value: string): value is ProjectSessionColumn {
  return value in PROJECT_SESSION_COLUMNS;
}

/** An annotation column id encodes its attr and name; both must be present. */
function isEvalAttr(value: string | undefined): value is EvalAttr {
  return value === "label" || value === "score";
}

export function getGqlSort(
  sort: ColumnSort
): TracesTableQuery$variables["sort"] {
  let col = null,
    evalResultKey = null;
  // Trace-annotation columns are not sortable on the spans connection.
  // Short-circuit defensively to avoid emitting an invalid evalResultKey.
  if (sort.id && sort.id.startsWith(TRACE_ANNOTATIONS_COLUMN_PREFIX)) {
    return {
      col: null,
      evalResultKey: null,
      dir: sort.desc ? "desc" : "asc",
    };
  }
  if (sort.id && sort.id.startsWith(ANNOTATIONS_COLUMN_PREFIX)) {
    const [, attr, name] = sort.id.split(ANNOTATIONS_KEY_SEPARATOR);
    if (isEvalAttr(attr) && name !== undefined) {
      evalResultKey = { attr, name };
    }
  } else if (isSpanColumn(sort.id)) {
    col = sort.id;
  }

  return {
    col,
    evalResultKey,
    dir: sort.desc ? "desc" : "asc",
  };
}

export function getGqlSessionSort(
  sort: ColumnSort
): SessionsTableQuery$variables["sort"] {
  let col = null,
    annoResultKey = null;
  // Trace-annotation columns are not sortable on the sessions connection.
  if (sort.id && sort.id.startsWith(TRACE_ANNOTATIONS_COLUMN_PREFIX)) {
    return {
      col: null,
      annoResultKey: null,
      dir: sort.desc ? "desc" : "asc",
    };
  }
  if (sort.id && sort.id.startsWith(ANNOTATIONS_COLUMN_PREFIX)) {
    const [, attr, name] = sort.id.split(ANNOTATIONS_KEY_SEPARATOR);
    if (isEvalAttr(attr) && name !== undefined) {
      annoResultKey = { attr, name };
    }
  } else if (isProjectSessionColumn(sort.id)) {
    col = sort.id;
  }

  return {
    col,
    annoResultKey,
    dir: sort.desc ? "desc" : "asc",
  };
}

export function makeAnnotationColumnId(
  name: string,
  type: string,
  kind: "span" | "trace" = "span"
) {
  const prefix =
    kind === "trace"
      ? TRACE_ANNOTATIONS_COLUMN_PREFIX
      : ANNOTATIONS_COLUMN_PREFIX;
  return (
    `${prefix}${ANNOTATIONS_KEY_SEPARATOR}${type}${ANNOTATIONS_KEY_SEPARATOR}${name}`
      // replace anything that's not alphanumeric with a dash
      .replace(/[^a-zA-Z0-9]/g, "-")
  );
}
