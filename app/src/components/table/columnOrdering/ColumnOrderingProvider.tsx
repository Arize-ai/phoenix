import { move } from "@dnd-kit/helpers";
import {
  DragDropProvider,
  KeyboardSensor,
  PointerSensor,
} from "@dnd-kit/react";
import { useRef } from "react";
import type { ReactNode } from "react";

/**
 * Elements inside a sortable header that own their own pointer interactions
 * and must never start a column drag: the column resize grip and interactive
 * elements such as a contextual-help trigger. Sort toggles are plain divs and
 * are intentionally draggable — a click on them still sorts because a press
 * outside the drag handle only becomes a drag once the pointer travels.
 */
const nonDraggableSelector = [
  ".resizer",
  "input",
  "select",
  "textarea",
  "button",
  "a[href]",
  "[contenteditable]",
].join(", ");

const sensors = [
  PointerSensor.configure({
    // Activate from anywhere on the header cell, not only the drag handle.
    // Presses on the handle start a drag immediately; presses elsewhere fall
    // back to dnd-kit's default distance/delay constraints so clicks (e.g.
    // toggling the sort) keep working.
    activatorElements: (source) => [source.element],
    preventActivation: (event, source) => {
      const { target } = event;
      if (!(target instanceof Element)) {
        return false;
      }
      if (source.handle != null && source.handle.contains(target)) {
        return false;
      }
      return target.closest(nonDraggableSelector) != null;
    },
  }),
  KeyboardSensor,
];

export interface ColumnOrderingProviderProps {
  /** Ids of sortable columns in current display order. Every sortable inside must appear here with a matching index. */
  columnOrder: string[];
  /** Called with the new order as it changes during a drag and when a canceled drag restores the original order. */
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
  // The order when the current drag started, restored if the drag is canceled
  const initialColumnOrderRef = useRef<string[] | null>(null);
  return (
    <DragDropProvider
      sensors={sensors}
      onDragStart={() => {
        initialColumnOrderRef.current = columnOrder;
      }}
      onDragOver={(event) => {
        // Commit each reorder as the drag previews it so the column bodies
        // move with the headers. Committing state here also makes dnd-kit's
        // optimistic-sorting plugin defer to React: without a state update it
        // reorders the header cells directly in the DOM, and a drag released
        // outside every header (e.g. past the far left of the table) then
        // left the headers permanently out of sync with the cells (#14609).
        const newColumnOrder = move(columnOrder, event);
        if (newColumnOrder === columnOrder) {
          return;
        }
        onColumnOrderChange(newColumnOrder);
      }}
      onDragEnd={(event) => {
        const initialColumnOrder = initialColumnOrderRef.current;
        initialColumnOrderRef.current = null;
        // The order the user saw was already committed during the drag;
        // re-applying move() here would shift the column a second time.
        if (!event.canceled) {
          return;
        }
        if (initialColumnOrder != null) {
          onColumnOrderChange(initialColumnOrder);
        }
      }}
    >
      {children}
    </DragDropProvider>
  );
}
