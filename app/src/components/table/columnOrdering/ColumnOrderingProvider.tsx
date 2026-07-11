import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import type { ReactNode } from "react";

export interface ColumnOrderingProviderProps {
  /** Ids of sortable columns in current display order. Every sortable inside must appear here with a matching index. */
  columnOrder: string[];
  /** Called with the new order when a drag completes and the order changed. */
  onColumnOrderChange: (columnOrder: string[]) => void;
  children: ReactNode;
}

/**
 * Drag-and-drop boundary for reorderable columns. Pair with
 * {@link SortableColumnHeader} or any `useSortable`-based row.
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
