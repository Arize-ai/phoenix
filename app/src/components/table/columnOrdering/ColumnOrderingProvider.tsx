import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import type { ReactNode } from "react";

export interface ColumnOrderingProviderProps {
  /**
   * The ids of the sortable columns in their current display order. Every
   * sortable rendered within the provider must appear in this list with a
   * matching index.
   */
  columnOrder: string[];
  /**
   * Called with the new column order when a drag completes and the order
   * actually changed.
   */
  onColumnOrderChange: (columnOrder: string[]) => void;
  children: ReactNode;
}

/**
 * Drag-and-drop boundary for a set of reorderable columns. Pair with
 * {@link SortableColumnHeader} for table headers or any `useSortable`-based
 * row (e.g. the column selector) to enable reordering.
 */
export function ColumnOrderingProvider({
  columnOrder,
  onColumnOrderChange,
  children,
}: ColumnOrderingProviderProps) {
  return (
    <DragDropProvider
      onDragEnd={(event) => {
        const newColumnOrder = move(columnOrder, event);
        if (newColumnOrder === columnOrder) {
          return;
        }
        onColumnOrderChange(newColumnOrder);
      }}
    >
      {children}
    </DragDropProvider>
  );
}
