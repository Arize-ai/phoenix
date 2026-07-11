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
import { dndDragFeedbackCSS } from "@phoenix/components/dnd/dndCSS";

import { ColumnOrderingProvider } from "../columnOrdering";

export interface ColumnSelectorColumn {
  id: string;
  label: string;
  /**
   * When true, the column is always visible and its checkbox is disabled.
   * The column can still be reordered.
   */
  isVisibilityToggleDisabled?: boolean;
}

export interface ColumnSelectorMenuProps {
  /**
   * The selectable columns in their current display order.
   */
  columns: ColumnSelectorColumn[];
  /**
   * Map of column id to visibility. Columns absent from the map are treated
   * as visible, mirroring tanstack table's `columnVisibility` state.
   */
  columnVisibility: Record<string, boolean>;
  onColumnVisibilityChange: (columnVisibility: Record<string, boolean>) => void;
  /**
   * When provided, each column row gets a drag handle and the list can be
   * reordered. Called with the full new order of column ids.
   */
  onColumnOrderChange?: (columnIds: string[]) => void;
  /**
   * Label for the toggle-all checkbox.
   * @default "columns"
   */
  toggleAllLabel?: string;
  /**
   * Placeholder for the search input.
   * @default "Search columns..."
   */
  searchPlaceholder?: string;
  /**
   * Additional sections rendered below the column list (e.g. dynamic column
   * groups managed outside of the table's core columns).
   */
  children?: ReactNode;
}

/**
 * Horizontal inset shared by the search field, toggle-all row, column rows,
 * and any child sections so the whole menu reads as one aligned column.
 */
const MENU_INSET = "var(--global-dimension-static-size-50)";

const columnSelectorMenuCSS = css`
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 200px);
  min-width: 240px;
`;

/**
 * Scrollable body below the fixed search header. The header (a quiet,
 * borderless SearchField in a MenuHeader) stays put while the column list
 * scrolls, matching the other searchable menus in the app.
 */
const columnSelectorBodyCSS = css`
  overflow-y: auto;
  padding: ${MENU_INSET} 0;
`;

const columnListCSS = css`
  display: flex;
  flex-direction: column;
  padding: 0 ${MENU_INSET};
  list-style: none;
  margin: 0;
`;

const columnRowCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-static-size-100);
  min-height: var(--global-dimension-static-size-400);
  padding: 0 var(--global-dimension-static-size-100);
  border-radius: var(--global-rounding-small);
  label {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    gap: var(--global-dimension-static-size-100);
    min-width: 0;
  }
  .column-selector-row__handle {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: var(--global-dimension-static-size-225);
    height: var(--global-dimension-static-size-225);
    border: none;
    background: none;
    padding: 0;
    color: var(--global-dnd-handle-color);
    font-size: var(--global-font-size-m);
    opacity: 0;
    cursor: grab;
    touch-action: none;
    border-radius: var(--global-rounding-small);
    transition:
      opacity 0.12s ease-in-out,
      color 0.12s ease-in-out,
      background-color 0.12s ease-in-out;
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
  toggleAllLabel = "columns",
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

  const toggleableColumns = columns.filter(
    (column) => !column.isVisibilityToggleDisabled
  );
  const allVisible = toggleableColumns.every((column) =>
    isColumnVisible(columnVisibility, column.id)
  );
  const someVisible = toggleableColumns.some((column) =>
    isColumnVisible(columnVisibility, column.id)
  );

  const onToggleAll = (isSelected: boolean) => {
    const newVisibility = { ...columnVisibility };
    for (const column of toggleableColumns) {
      newVisibility[column.id] = isSelected;
    }
    onColumnVisibilityChange(newVisibility);
  };

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
        <div css={columnListCSS}>
          <div css={columnRowCSS}>
            <Checkbox
              name="toggle-all"
              isSelected={allVisible}
              isIndeterminate={someVisible && !allVisible}
              onChange={onToggleAll}
            >
              {toggleAllLabel}
            </Checkbox>
          </div>
        </div>
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
  /**
   * Label for the trigger button.
   * @default "Columns"
   */
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
      <Popover>
        <ColumnSelectorMenu {...menuProps} />
      </Popover>
    </DialogTrigger>
  );
}
