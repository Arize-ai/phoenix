import type { ColumnSort } from "@tanstack/react-table";

import type {
  ProjectSessionSort,
  SessionsTableQuery$variables,
} from "./__generated__/SessionsTableQuery.graphql";
import type {
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
    evalResultKey = {
      attr,
      name,
    } as SpanSort["evalResultKey"];
  } else {
    col = sort.id as SpanSort["col"];
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
    annoResultKey = {
      attr,
      name,
    } as ProjectSessionSort["annoResultKey"];
  } else {
    col = sort.id as ProjectSessionSort["col"];
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
