import type { Column } from "@tanstack/react-table";

import type { ColumnSelectorColumn } from "@phoenix/components/table";
import {
  applySubsetColumnOrder,
  CHECKBOX_COLUMN_ID,
  ColumnSelector,
  mergeColumnOrder,
} from "@phoenix/components/table";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import { normalizeAnnotationColumnOrder } from "./tableUtils";

/**
 * A set of dynamic annotation columns backed by its own visibility map in the
 * tracing store (span annotations, trace annotations, session annotations).
 * Unlike regular columns, these default to hidden and only exist in the table
 * while visible, so the selector lists them from their names.
 */
export interface AnnotationColumnKind {
  names: string[];
  visibility: Record<string, boolean>;
  onVisibilityChange: (visibility: Record<string, boolean>) => void;
  /** Returns the TanStack id for this annotation's visible flat column. */
  getColumnId: (name: string) => string;
  /** Distinguishes an annotation from a same-named one of another kind. */
  getLabel?: (name: string) => string;
}

export interface TracingColumnSelectorProps {
  /**
   * All of the top-level columns of the table, including visible dynamic
   * annotation columns.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: Column<any>[];
  /** Columns that are always visible. They remain reorderable. */
  unHidableColumnIds: string[];
  annotationKinds: AnnotationColumnKind[];
  /** Labels for columns whose header is not a plain string. */
  columnLabels?: Record<string, string>;
}

function getColumnLabel(column: Column<unknown>): string {
  const header = column.columnDef.header;
  return typeof header === "string" ? header : column.id;
}

/**
 * The "Columns" button for the tables backed by the tracing store (spans,
 * traces, sessions). Presents table columns and each kind's annotation columns
 * as one flat, reorderable list, and writes visibility back to the map that
 * owns each column.
 */
export function TracingColumnSelector({
  columns,
  unHidableColumnIds,
  annotationKinds,
  columnLabels = {},
}: TracingColumnSelectorProps) {
  const columnVisibility = useTracingContext((state) => state.columnVisibility);
  const setColumnVisibility = useTracingContext(
    (state) => state.setColumnVisibility
  );
  const columnOrder = useTracingContext((state) => state.columnOrder);
  const setColumnOrder = useTracingContext((state) => state.setColumnOrder);

  const columnsById = new Map(columns.map((column) => [column.id, column]));
  const tableColumnIds = columns
    .map((column) => column.id)
    .filter((id) => id !== CHECKBOX_COLUMN_ID);

  const annotationByColumnId = new Map<
    string,
    { kind: AnnotationColumnKind; name: string }
  >();
  const annotationColumnIdsByName = new Map<string, string>();
  for (const kind of annotationKinds) {
    for (const name of kind.names) {
      const columnId = kind.getColumnId(name);
      annotationByColumnId.set(columnId, { kind, name });
      // The old grouped columns could not distinguish same-named span and
      // trace annotations, so map that legacy id to the first kind.
      if (!annotationColumnIdsByName.has(name)) {
        annotationColumnIdsByName.set(name, columnId);
      }
    }
  }
  const normalizedColumnOrder = normalizeAnnotationColumnOrder({
    columnOrder,
    annotationColumnIdsByName,
  });

  // One flat order over everything: table columns (including visible
  // annotation columns) plus hidden annotation columns, which keep their
  // persisted position even while not rendered in the table.
  const fullColumnOrder = mergeColumnOrder({
    columnOrder: normalizedColumnOrder,
    columnIds: [
      ...tableColumnIds,
      ...[...annotationByColumnId.keys()].filter(
        (columnId) => !columnsById.has(columnId)
      ),
    ],
  });

  const selectorColumns = fullColumnOrder.flatMap<ColumnSelectorColumn>(
    (id) => {
      const annotation = annotationByColumnId.get(id);
      if (annotation != null) {
        return [
          {
            id,
            label:
              annotation.kind.getLabel?.(annotation.name) ?? annotation.name,
          },
        ];
      }
      const column = columnsById.get(id);
      if (column != null && column.columns.length === 0) {
        return [
          {
            id,
            label: columnLabels[id] ?? getColumnLabel(column),
            isVisibilityToggleDisabled: unHidableColumnIds.includes(id),
          },
        ];
      }
      return [];
    }
  );

  // Annotation columns default to hidden, unlike regular columns, so their
  // visibility must be explicit in the merged map
  const mergedColumnVisibility: Record<string, boolean> = {
    ...columnVisibility,
  };
  for (const [columnId, { kind, name }] of annotationByColumnId) {
    mergedColumnVisibility[columnId] = kind.visibility[name] ?? false;
  }

  const onColumnVisibilityChange = (
    newColumnVisibility: Record<string, boolean>
  ) => {
    const columnUpdates: Record<string, boolean> = {};
    const updatesByKind = new Map(
      annotationKinds.map((kind) => [kind, { ...kind.visibility }])
    );
    for (const [id, isVisible] of Object.entries(newColumnVisibility)) {
      const annotation = annotationByColumnId.get(id);
      if (annotation != null) {
        updatesByKind.get(annotation.kind)![annotation.name] = isVisible;
      } else {
        columnUpdates[id] = isVisible;
      }
    }
    setColumnVisibility(columnUpdates);
    for (const [kind, updates] of updatesByKind) {
      kind.onVisibilityChange(updates);
    }
  };

  const onColumnOrderChange = (orderedSubset: string[]) => {
    setColumnOrder(
      applySubsetColumnOrder({
        columnOrder: fullColumnOrder,
        orderedSubset,
      })
    );
  };

  return (
    <ColumnSelector
      columns={selectorColumns}
      columnVisibility={mergedColumnVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
      onColumnOrderChange={onColumnOrderChange}
    />
  );
}
