import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { useSortable } from "@dnd-kit/react/sortable";
import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import {
  Button,
  Checkbox,
  DebouncedSearch,
  DialogTrigger,
  Icon,
  Icons,
  MenuHeader,
  Popover,
} from "@phoenix/components";
import {
  dndDragFeedbackCSS,
  dndHandleAppearanceCSS,
} from "@phoenix/components/dnd";

import { ColumnOrderingProvider } from "../columnOrdering";

export interface ColumnSelectorColumn {
  id: string;
  label: string;
  /** When true, the column is always visible and its checkbox is disabled. Still reorderable. */
  isVisibilityToggleDisabled?: boolean;
}

export interface ColumnSelectorMenuProps {
  /** The selectable columns in their current display order. */
  columns: ColumnSelectorColumn[];
  /** Map of column id to visibility. Absent ids default to visible, like tanstack's `columnVisibility`. */
  columnVisibility: Record<string, boolean>;
  onColumnVisibilityChange: (columnVisibility: Record<string, boolean>) => void;
  /** When provided, rows get a drag handle; called with the full new column id order. */
  onColumnOrderChange?: (columnIds: string[]) => void;
  /** @default "Search columns..." */
  searchPlaceholder?: string;
  /** Additional sections rendered below the column list. */
  children?: ReactNode;
}

/** Shared horizontal inset so the whole menu reads as one aligned column. */
const MENU_INSET = "var(--global-dimension-size-50)";

const columnSelectorMenuCSS = css`
  display: flex;
  flex-direction: column;
  max-height: var(--global-menu-max-height-small);
  min-width: 240px;

  /* React Aria caps the popover at the space available on screen. Without
     this, a long column list overflows that box and paints outside it. */
  .react-aria-Popover & {
    max-height: inherit;
  }
`;

/** Scrollable body below the fixed search header. */
const columnSelectorBodyCSS = css`
  overflow-y: auto;
  /* Let the body shrink below its content height so it, not the menu, scrolls */
  min-height: 0;
  padding: ${MENU_INSET} 0;
`;

export const columnListCSS = css`
  display: flex;
  flex-direction: column;
  padding: 0 ${MENU_INSET};
  list-style: none;
  margin: 0;
`;

export const columnRowCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-height: var(--global-dimension-size-400);
  padding: 0 var(--global-dimension-size-100);
  border-radius: var(--global-rounding-small);
  label {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }
  .column-selector-row__handle {
    ${dndHandleAppearanceCSS}
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: var(--global-dimension-size-225);
    height: var(--global-dimension-size-225);
    font-size: var(--global-font-size-m);
  }
  &:hover {
    background-color: var(--global-color-gray-200);
    .column-selector-row__handle {
      opacity: 1;
    }
  }
  ${dndDragFeedbackCSS}
  &[data-dnd-dragging] {
    background-color: var(--global-menu-background-color);
  }
`;

function isColumnVisible(
  columnVisibility: Record<string, boolean>,
  columnId: string
) {
  return columnVisibility[columnId] ?? true;
}

function SortableColumnRow({
  column,
  index,
  isVisible,
  isReorderingDisabled,
  onVisibilityChange,
}: {
  column: ColumnSelectorColumn;
  index: number;
  isVisible: boolean;
  isReorderingDisabled: boolean;
  onVisibilityChange: (isSelected: boolean) => void;
}) {
  const { ref, handleRef } = useSortable({
    id: column.id,
    index,
    disabled: isReorderingDisabled,
    modifiers: [RestrictToVerticalAxis],
  });
  return (
    <li ref={ref} css={columnRowCSS} data-column-id={column.id}>
      <Checkbox
        name={column.id}
        isSelected={isVisible}
        isDisabled={column.isVisibilityToggleDisabled}
        onChange={onVisibilityChange}
      >
        {column.label}
      </Checkbox>
      {isReorderingDisabled ? null : (
        <button
          ref={handleRef}
          type="button"
          className="button--reset column-selector-row__handle"
          aria-label={`Reorder ${column.label} column`}
        >
          <Icon svg={<Icons.DragHandle />} />
        </button>
      )}
    </li>
  );
}

/**
 * The content of a column selector: a search input, a toggle-all checkbox,
 * and a list of columns that can be shown/hidden and (optionally) reordered
 * via drag handles. Place inside a Popover or render standalone.
 */
export function ColumnSelectorMenu({
  columns,
  columnVisibility,
  onColumnVisibilityChange,
  onColumnOrderChange,
  searchPlaceholder = "Search columns...",
  children,
}: ColumnSelectorMenuProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const filteredColumns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return columns;
    }
    return columns.filter((column) =>
      column.label.toLowerCase().includes(query)
    );
  }, [columns, searchQuery]);

  // Reordering a filtered list is ambiguous, so it is only enabled when the
  // full list is shown
  const isReorderingEnabled =
    onColumnOrderChange != null && filteredColumns.length === columns.length;

  return (
    <div css={columnSelectorMenuCSS}>
      <MenuHeader>
        <DebouncedSearch
          aria-label="Search columns"
          placeholder={searchPlaceholder}
          onChange={setSearchQuery}
          variant="quiet"
          autoFocus
        />
      </MenuHeader>
      <div css={columnSelectorBodyCSS}>
        <ColumnOrderingProvider
          columnOrder={columns.map((column) => column.id)}
          onColumnOrderChange={(columnOrder) =>
            onColumnOrderChange?.(columnOrder)
          }
        >
          <ul css={columnListCSS}>
            {filteredColumns.map((column, index) => (
              <SortableColumnRow
                key={column.id}
                column={column}
                // When filtered, reordering is disabled and the index within
                // the full order is not needed
                index={index}
                isVisible={isColumnVisible(columnVisibility, column.id)}
                isReorderingDisabled={!isReorderingEnabled}
                onVisibilityChange={(isSelected) =>
                  onColumnVisibilityChange({
                    ...columnVisibility,
                    [column.id]: isSelected,
                  })
                }
              />
            ))}
          </ul>
        </ColumnOrderingProvider>
        {children}
      </div>
    </div>
  );
}

export interface ColumnSelectorProps extends ColumnSelectorMenuProps {
  /** @default "Columns" */
  buttonLabel?: string;
}

/**
 * A "Columns" button that opens a popover for showing, hiding, and
 * reordering table columns.
 */
export function ColumnSelector({
  buttonLabel = "Columns",
  ...menuProps
}: ColumnSelectorProps) {
  return (
    <DialogTrigger>
      <Button leadingVisual={<Icon svg={<Icons.Column />} />}>
        {buttonLabel}
      </Button>
      <Popover placement="bottom end">
        <ColumnSelectorMenu {...menuProps} />
      </Popover>
    </DialogTrigger>
  );
}
