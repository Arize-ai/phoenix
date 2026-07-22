import type { OrderableColumnDef } from "./columnOrderingUtils";
import {
  applySubsetColumnOrder,
  expandColumnOrderToLeafIds,
  getLeafIdsByTopLevelId,
  getTopLevelColumnIds,
  mergeColumnOrder,
} from "./columnOrderingUtils";

export interface UseColumnOrderProps {
  /** The table's top-level column defs, in their natural order. */
  columns: OrderableColumnDef[];
  /** The persisted top-level column order. Empty means natural order. */
  columnOrder: string[];
  onColumnOrderChange: (columnOrder: string[]) => void;
  /** Tanstack's column visibility map. Absent ids default to visible. */
  columnVisibility: Record<string, boolean>;
  /** Ids that cannot be reordered, e.g. a pinned checkbox or actions column. */
  nonOrderableColumnIds?: string[];
}

export interface UseColumnOrderResult {
  /** Pass to tanstack's `state.columnOrder`. */
  leafColumnOrder: string[];
  /** Pass to {@link ColumnOrderingProvider}'s `columnOrder`. */
  visibleColumnOrder: string[];
  /** Pass to {@link ColumnOrderingProvider}'s `onColumnOrderChange`. */
  onVisibleColumnOrderChange: (visibleColumnOrder: string[]) => void;
  /**
   * The column's index within `visibleColumnOrder`, or -1 when it is not
   * reorderable. Pass to {@link ColumnHeaderCell}'s `index`.
   */
  getColumnOrderIndex: (columnId: string) => number;
}

/**
 * Derives the column order state a table needs to support drag-and-drop
 * reordering of its headers: reconciles the persisted order with the columns
 * that currently exist (dynamic annotation columns come and go), expands group
 * columns into the leaf order tanstack expects, and maps drags over the visible
 * headers back onto the full order.
 */
export function useColumnOrder({
  columns,
  columnOrder,
  onColumnOrderChange,
  columnVisibility,
  nonOrderableColumnIds = [],
}: UseColumnOrderProps): UseColumnOrderResult {
  const nonOrderable = new Set(nonOrderableColumnIds);
  const topLevelColumnIds = getTopLevelColumnIds(columns);
  const orderableColumnIds = topLevelColumnIds.filter(
    (id) => !nonOrderable.has(id)
  );
  const topLevelColumnOrder = mergeColumnOrder({
    columnOrder,
    columnIds: orderableColumnIds,
  });
  // Persisted ids that are temporarily absent from the column defs may be
  // hidden dynamic columns. Keep them out of the table order, but retain their
  // positions when a header drag writes the current order back to storage.
  const topLevelColumnIdSet = new Set(topLevelColumnIds);
  const absentColumnIds = columnOrder.filter(
    (id) => !topLevelColumnIdSet.has(id)
  );
  const persistedColumnOrder = mergeColumnOrder({
    columnOrder,
    columnIds: [...absentColumnIds, ...orderableColumnIds],
  });
  const leafIdsByTopLevelId = getLeafIdsByTopLevelId(columns);
  const leafColumnOrder = expandColumnOrderToLeafIds(
    topLevelColumnOrder,
    columns
  );
  // Hidden columns render no header, so header drag-and-drop operates on the
  // visible subset and the result is merged back into the full order
  const visibleColumnOrder = topLevelColumnOrder.filter((id) =>
    (leafIdsByTopLevelId.get(id) ?? [id]).some(
      (leafId) => columnVisibility[leafId] ?? true
    )
  );
  const visibleOrderIndexById = new Map(
    visibleColumnOrder.map((id, index) => [id, index])
  );
  return {
    leafColumnOrder,
    visibleColumnOrder,
    onVisibleColumnOrderChange: (orderedSubset) => {
      onColumnOrderChange(
        applySubsetColumnOrder({
          columnOrder: persistedColumnOrder,
          orderedSubset,
        })
      );
    },
    getColumnOrderIndex: (columnId) =>
      visibleOrderIndexById.get(columnId) ?? -1,
  };
}
