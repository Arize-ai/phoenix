import type { Column } from "@tanstack/react-table";

import {
  applySubsetColumnOrder,
  CHECKBOX_COLUMN_ID,
  ColumnSelector,
  mergeColumnOrder,
} from "@phoenix/components/table";

import { ACTIONS_COLUMN_ID, ANNOTATION_COLUMN_PREFIX } from "./constants";

const UN_HIDABLE_COLUMN_IDS = ["name"];

type ExperimentColumnSelectorProps<T extends object> = {
  /** All of the columns of the experiments table. */
  columns: Column<T>[];
  columnVisibility: Record<string, boolean>;
  onColumnVisibilityChange: (visibility: Record<string, boolean>) => void;
  columnOrder: string[];
  onColumnOrderChange: (columnOrder: string[]) => void;
};

function getColumnLabel<T extends object>(column: Column<T>): string {
  if (column.id.startsWith(ANNOTATION_COLUMN_PREFIX)) {
    return column.id.slice(ANNOTATION_COLUMN_PREFIX.length);
  }
  const header = column.columnDef.header;
  return typeof header === "string" ? header : column.id;
}

/** The column selector for the experiments table. */
export function ExperimentColumnSelector<T extends object>({
  columns,
  columnVisibility,
  onColumnVisibilityChange,
  columnOrder,
  onColumnOrderChange,
}: ExperimentColumnSelectorProps<T>) {
  // The pinned columns sit at the edges of the table and are neither hidable
  // nor reorderable, so they are left out of the list entirely
  const selectableColumns = columns.filter(
    (column) =>
      column.id !== CHECKBOX_COLUMN_ID && column.id !== ACTIONS_COLUMN_ID
  );
  const columnsById = new Map(
    selectableColumns.map((column) => [column.id, column])
  );
  const fullColumnOrder = mergeColumnOrder({
    columnOrder,
    columnIds: selectableColumns.map((column) => column.id),
  });

  const selectorColumns = fullColumnOrder.flatMap((id) => {
    const column = columnsById.get(id);
    if (column == null) {
      return [];
    }
    return [
      {
        id,
        label: getColumnLabel(column),
        isVisibilityToggleDisabled: UN_HIDABLE_COLUMN_IDS.includes(id),
      },
    ];
  });

  // The selector and persisted order use top-level ids so grouped columns move
  // as a unit. Visibility remains a leaf-level TanStack state, so expose one
  // aggregate value for each group and fan changes back out to all its leaves.
  const selectorColumnVisibility = { ...columnVisibility };
  for (const column of selectableColumns) {
    if (column.columns.length > 0) {
      selectorColumnVisibility[column.id] = column
        .getLeafColumns()
        .some((leafColumn) => columnVisibility[leafColumn.id] ?? true);
    }
  }

  const onSelectorColumnVisibilityChange = (
    newColumnVisibility: Record<string, boolean>
  ) => {
    const nextColumnVisibility = { ...columnVisibility };
    for (const column of selectableColumns) {
      const isVisible = newColumnVisibility[column.id] ?? true;
      if (column.columns.length === 0) {
        nextColumnVisibility[column.id] = isVisible;
        continue;
      }
      for (const leafColumn of column.getLeafColumns()) {
        nextColumnVisibility[leafColumn.id] = isVisible;
      }
    }
    onColumnVisibilityChange(nextColumnVisibility);
  };

  return (
    <ColumnSelector
      columns={selectorColumns}
      columnVisibility={selectorColumnVisibility}
      onColumnVisibilityChange={onSelectorColumnVisibilityChange}
      onColumnOrderChange={(orderedSubset) =>
        onColumnOrderChange(
          applySubsetColumnOrder({
            columnOrder: fullColumnOrder,
            orderedSubset,
          })
        )
      }
    />
  );
}
