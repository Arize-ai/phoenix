import { KeyboardSensor, PointerSensor } from "@dnd-kit/react";
import type { ReactNode } from "react";

import { ReorderProvider } from "@phoenix/components/dnd";

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

/**
 * The column-flavored names for `ReorderProviderProps` (in
 * `components/dnd/ReorderProvider`), which documents what each one does.
 */
export interface ColumnOrderingProviderProps {
  /** Maps to `order`. */
  columnOrder: string[];
  /** Maps to `onOrderChange`. */
  onColumnOrderChange: (columnOrder: string[]) => void;
  /** Maps to `onOrderCommit`. */
  onColumnOrderCommit?: (columnOrder: string[]) => void;
  children: ReactNode;
}

/**
 * Drag-and-drop boundary for reorderable columns. Pair with
 * {@link SortableColumnHeader} or any `useSortable`-based row.
 */
export function ColumnOrderingProvider({
  columnOrder,
  onColumnOrderChange,
  onColumnOrderCommit,
  children,
}: ColumnOrderingProviderProps) {
  return (
    <ReorderProvider
      order={columnOrder}
      onOrderChange={onColumnOrderChange}
      onOrderCommit={onColumnOrderCommit}
      sensors={sensors}
    >
      {children}
    </ReorderProvider>
  );
}
