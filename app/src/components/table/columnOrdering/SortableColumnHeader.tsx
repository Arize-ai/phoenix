import { RestrictToHorizontalAxis } from "@dnd-kit/abstract/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import { css } from "@emotion/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Icon, Icons } from "@phoenix/components";
import {
  dndDragFeedbackCSS,
  dndHandleAppearanceCSS,
} from "@phoenix/components/dnd";

const sortableColumnHeaderCSS = css`
  position: relative;
  /* Reserve the trailing edge for the drag handle so it never overlaps the
     header's own content, which is what a right-aligned label would collide
     with. Header labels stay leading-aligned; cells keep their own alignment. */
  padding-right: var(--global-dimension-size-300);
  text-align: left;
  ${dndDragFeedbackCSS}
  /* Keep the lifted copy opaque over the table */
  &[data-dnd-dragging] {
    background-color: var(--global-table-header-background-color);
  }
  /* Extend the drop tint down the full column body */
  &[data-dnd-placeholder]::after {
    content: "";
    position: absolute;
    pointer-events: none;
    left: 0;
    right: 0;
    top: 100%;
    height: 100vh;
    background-color: var(--global-dnd-drop-target-background-color);
  }
  .sortable-column-header__handle {
    ${dndHandleAppearanceCSS}
    position: absolute;
    top: 50%;
    right: var(--global-dimension-size-50);
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--global-dimension-size-225);
    height: var(--global-dimension-size-225);
    font-size: var(--global-font-size-s);
    z-index: 1;
  }
  &:hover .sortable-column-header__handle {
    opacity: 1;
  }
`;

export interface SortableColumnHeaderProps extends ComponentPropsWithoutRef<"th"> {
  /** Must be present in the surrounding provider's `columnOrder`. */
  columnId: string;
  /** Index of the column within the provider's `columnOrder`. */
  index: number;
  /** Accessible label for the drag handle. Falls back to columnId. */
  label?: string;
  /** Disables dragging for this column (e.g. pinned columns). */
  isReorderingDisabled?: boolean;
  children: ReactNode;
}

/**
 * A `<th>` draggable horizontally to reorder its column, with a hover-visible
 * grab handle. Must be rendered inside a {@link ColumnOrderingProvider}. Any
 * other `<th>` attributes pass through.
 */
export function SortableColumnHeader({
  columnId,
  index,
  label,
  isReorderingDisabled = false,
  style,
  children,
  ...thProps
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
      {...thProps}
      style={{
        ...style,
        // Inline so it survives the top layer the drag feedback renders into
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
          className="button--reset sortable-column-header__handle"
          aria-label={`Reorder ${label ?? columnId} column`}
        >
          <Icon svg={<Icons.DragHandle />} />
        </button>
      )}
      {children}
    </th>
  );
}
