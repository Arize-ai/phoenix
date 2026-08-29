import type { ColumnDef, ColumnSort } from "@tanstack/react-table";

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
/** Wide enough for a full annotation pill beside `OverflowRow`'s "+N" badge */
export const ANNOTATION_COLUMN_SIZING = {
  size: 250,
  minSize: 150,
} satisfies Partial<ColumnDef<unknown>>;
export const DEFAULT_SORT: SpanSort = {
  col: "startTime",
  dir: "desc",
};

export const DEFAULT_SESSION_SORT: ProjectSessionSort = {
  col: "startTime",
  dir: "desc",
};

function parseAnnotationColumnSortKey(columnId: string): {
  attr: string;
  name: string;
} {
  const [, attr, ...encodedNameParts] = columnId.split(
    ANNOTATIONS_KEY_SEPARATOR
  );
  return {
    attr,
    name: decodeURIComponent(encodedNameParts.join(ANNOTATIONS_KEY_SEPARATOR)),
  };
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
    const { attr, name } = parseAnnotationColumnSortKey(sort.id);
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
    const { attr, name } = parseAnnotationColumnSortKey(sort.id);
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

/** The id of the flat table column for one named annotation. */
export function makeFlatAnnotationColumnId(
  name: string,
  kind: "span" | "trace" = "span"
) {
  const prefix =
    kind === "trace"
      ? TRACE_ANNOTATIONS_COLUMN_PREFIX
      : ANNOTATIONS_COLUMN_PREFIX;
  // The "score" segment survives from the grouped-column era so persisted
  // sort, order, and visibility ids stay valid. Encode only the name suffix
  // so ids remain reversible for names with spaces or punctuation, while
  // alphanumeric names keep the same persisted ids.
  return `${prefix}${ANNOTATIONS_KEY_SEPARATOR}score${ANNOTATIONS_KEY_SEPARATOR}${encodeURIComponent(name)}`;
}

/** A kind of flat annotation columns: names plus the column id each maps to. */
export interface AnnotationColumnIdSource {
  names: readonly string[];
  getColumnId: (name: string) => string;
}

/**
 * Converts annotation-name ids from the former grouped columns to the flat
 * columns' ids while leaving ordinary and already-flat ids unchanged. The
 * first kind listed wins a name shared across kinds, so every reader of the
 * same persisted order must list its kinds in the same order (span before
 * trace, as the column selectors do).
 */
export function normalizeAnnotationColumnOrder({
  columnOrder,
  annotationKinds,
}: {
  columnOrder: string[];
  annotationKinds: readonly AnnotationColumnIdSource[];
}) {
  const columnIdsByName = new Map<string, string>();
  for (const kind of annotationKinds) {
    for (const name of kind.names) {
      if (!columnIdsByName.has(name)) {
        columnIdsByName.set(name, kind.getColumnId(name));
      }
    }
  }
  return [
    ...new Set(
      columnOrder.map((columnId) => columnIdsByName.get(columnId) ?? columnId)
    ),
  ];
}
