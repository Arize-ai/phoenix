import { RestrictToHorizontalAxis } from "@dnd-kit/abstract/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import { css } from "@emotion/react";
import type { CSSProperties, ReactNode } from "react";

import { Icon, Icons } from "@phoenix/components";
import { dndDragFeedbackCSS } from "@phoenix/components/dnd/dndCSS";

const sortableColumnHeaderCSS = css`
  position: relative;
  ${dndDragFeedbackCSS}
  /* Keep the lifted copy opaque so it reads clearly over the table, but keep
     its shape identical to the resting header so the drop is a settle, not a
     morph. Shape/shadow come from the shared feedback CSS. */
  &[data-dnd-dragging] {
    background-color: var(--global-table-header-background-color);
  }
  .column-drag-handle {
    position: absolute;
    top: 50%;
    right: var(--global-dimension-static-size-50);
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--global-dimension-static-size-225);
    height: var(--global-dimension-static-size-225);
    border: none;
    border-radius: var(--global-rounding-small);
    background-color: transparent;
    color: var(--global-dnd-handle-color);
    font-size: var(--global-font-size-s);
    opacity: 0;
    transition:
      opacity 0.12s ease-in-out,
      color 0.12s ease-in-out,
      background-color 0.12s ease-in-out;
    cursor: grab;
    touch-action: none;
    z-index: 1;
    &:hover {
      color: var(--global-dnd-handle-color-hover);
      background-color: var(--global-dnd-handle-background-color-hover);
    }
    &:focus-visible {
      opacity: 1;
      outline: 1px solid var(--global-color-primary);
      outline-offset: -1px;
    }
  }
  &:hover .column-drag-handle {
    opacity: 1;
  }
`;

export interface SortableColumnHeaderProps {
  /**
   * The id of the column. Must be present in the surrounding
   * ColumnOrderingProvider's `columnOrder`.
   */
  columnId: string;
  /**
   * The index of the column within the provider's `columnOrder`.
   */
  index: number;
  /**
   * Human-readable column name for the drag handle's accessible label.
   * Falls back to the column id.
   */
  label?: string;
  /**
   * Disables dragging for this column (e.g. pinned columns).
   */
  isReorderingDisabled?: boolean;
  colSpan?: number;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * A `<th>` that can be dragged horizontally to reorder its column. Renders a
 * grab handle on hover; while dragging, the header follows the pointer and
 * the destination slot is highlighted as a drop invitation.
 *
 * Must be rendered inside a {@link ColumnOrderingProvider}.
 */
export function SortableColumnHeader({
  columnId,
  index,
  label,
  isReorderingDisabled = false,
  colSpan,
  style,
  children,
}: SortableColumnHeaderProps) {
  const { ref, handleRef, isDragSource } = useSortable({
    id: columnId,
    index,
    disabled: isReorderingDisabled,
    modifiers: [RestrictToHorizontalAxis],
  });
  return (
    <th
      ref={ref}
      colSpan={colSpan}
      style={{
        ...style,
        // Inline so the style survives the popover top layer the drag
        // feedback element is rendered into
        ...(isDragSource
          ? {
              backgroundColor: "var(--global-table-header-background-color)",
            }
          : null),
      }}
      css={sortableColumnHeaderCSS}
      data-column-id={columnId}
    >
      {isReorderingDisabled ? null : (
        <button
          ref={handleRef}
          type="button"
          className="button--reset column-drag-handle"
          aria-label={`Reorder ${label ?? columnId} column`}
        >
          <Icon svg={<Icons.DragHandle />} />
        </button>
      )}
      {children}
    </th>
  );
}
