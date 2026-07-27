import type { Header } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import type { CSSProperties } from "react";

import { Icon, Icons } from "@phoenix/components";

/** The `aria-sort` value for each of TanStack's sort directions. */
const SORT_LABEL = {
  asc: "ascending",
  desc: "descending",
} as const;

/**
 * A header cell for a TanStack table column: the header content, a sort
 * affordance when the column is sortable, and a drag handle when it is
 * resizable.
 *
 * Renders the `<th>` itself so that `aria-sort` — which belongs on the cell
 * rather than on anything inside it — stays in step with the sort control.
 *
 * Styling comes from the `.sort`, `.sort-icon` and `.resizer` rules in
 * `tableCSS`, so the table this is rendered in must use that stylesheet.
 *
 * @example
 * ```tsx
 * {headerGroup.headers.map((header) => (
 *   <TableColumnHeader key={header.id} header={header} />
 * ))}
 * ```
 */
export function TableColumnHeader<Data, Value>({
  header,
  style,
}: {
  header: Header<Data, Value>;
  /** Merged after the resize width, so a pinned column's width wins. */
  style?: CSSProperties;
}) {
  // TanStack mutates the same header object in place on resize and sort, so a
  // memoized version of this would never see the change and the resizer would
  // drag nothing.
  "use no memo";
  const { column } = header;
  const sorted = column.getIsSorted();
  const canSort = column.getCanSort();
  const canResize = column.getCanResize();
  const toggleSorting = column.getToggleSortingHandler();

  const content = header.isPlaceholder
    ? null
    : flexRender(column.columnDef.header, header.getContext());

  return (
    <th
      colSpan={header.colSpan}
      // `tableCSS` reads the attribute to align the sort control with it
      align={column.columnDef.meta?.textAlign}
      aria-sort={canSort ? (sorted ? SORT_LABEL[sorted] : "none") : undefined}
      // a resizable column is driven by the width the drag left it at; the rest
      // are left to the table's own layout
      style={canResize ? { width: header.getSize(), ...style } : style}
    >
      {canSort && !header.isPlaceholder ? (
        <div
          className="sort"
          role="button"
          tabIndex={0}
          onClick={toggleSorting}
          onKeyDown={(event) => {
            // a div carrying a click handler is not a button; give it the keys
            // one would have so the table can be sorted without a mouse
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggleSorting?.(event);
            }
          }}
        >
          {content}
          {sorted ? (
            <Icon
              className="sort-icon"
              svg={
                sorted === "asc" ? (
                  <Icons.CaretUpFilled />
                ) : (
                  <Icons.CaretDownFilled />
                )
              }
            />
          ) : null}
        </div>
      ) : (
        content
      )}
      {canResize ? (
        <div
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          className={`resizer ${column.getIsResizing() ? "isResizing" : ""}`}
        />
      ) : null}
    </th>
  );
}
