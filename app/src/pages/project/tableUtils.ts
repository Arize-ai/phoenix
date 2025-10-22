import { ColumnSort } from "@tanstack/react-table";

import {
  ProjectSessionSort,
  SessionsTableQuery$variables,
} from "./__generated__/SessionsTableQuery.graphql";
import {
  SpanSort,
  TracesTableQuery$variables,
} from "./__generated__/TracesTableQuery.graphql";

export const ANNOTATIONS_COLUMN_PREFIX = "annotations";
export const ANNOTATIONS_KEY_SEPARATOR = "-";
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

export function makeAnnotationColumnId(name: string, type: string) {
  return (
    `${ANNOTATIONS_COLUMN_PREFIX}${ANNOTATIONS_KEY_SEPARATOR}${type}${ANNOTATIONS_KEY_SEPARATOR}${name}`
      // replace anything that's not alphanumeric with a dash
      .replace(/[^a-zA-Z0-9]/g, "-")
  );
}
