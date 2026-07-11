import type { CSSProperties, ReactNode } from "react";

import { SortableColumnHeader } from "./SortableColumnHeader";

export interface ColumnHeaderCellProps {
  columnId: string;
  /**
   * The column's index in the surrounding provider's `columnOrder`, or -1 if
   * it is not reorderable (a pinned column, or a header in a group row).
   * @see useColumnOrder
   */
  index: number;
  /** Accessible label for the drag handle. Falls back to columnId. */
  label?: string;
  colSpan?: number;
  style?: CSSProperties;
  align?: "left" | "center" | "right";
  children: ReactNode;
}

/**
 * A table header cell that is draggable to reorder its column when `index` is
 * a valid position in the surrounding {@link ColumnOrderingProvider}, and a
 * plain `<th>` otherwise.
 */
export function ColumnHeaderCell({
  columnId,
  index,
  label,
  colSpan,
  style,
  align,
  children,
}: ColumnHeaderCellProps) {
  if (index < 0) {
    return (
      <th colSpan={colSpan} style={style} align={align}>
        {children}
      </th>
    );
  }
  return (
    <SortableColumnHeader
      columnId={columnId}
      index={index}
      label={label}
      colSpan={colSpan}
      style={style}
      align={align}
    >
      {children}
    </SortableColumnHeader>
  );
}
