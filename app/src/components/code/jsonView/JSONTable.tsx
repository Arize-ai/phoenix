import type { ColumnDef, SortingState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";

import { TableColumnHeader } from "@phoenix/components/table/TableColumnHeader";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import type { FlatJSONEntry } from "@phoenix/utils/jsonUtils";
import { formatFlatJSONValue } from "@phoenix/utils/jsonUtils";

import { JSONTableKeyCell, JSONTableValueCell } from "./JSONTableCell";
import { jsonTableCSS } from "./styles";

const columns: ColumnDef<FlatJSONEntry>[] = [
  {
    id: "key",
    header: "Key",
    accessorKey: "key",
    // bounded at both ends so a drag cannot take the column to nothing (keys
    // become unreadable) or wide enough to squeeze the value column out
    size: 320,
    minSize: 120,
    maxSize: 720,
    // digits within a key are indices, so `messages.9` sorts before
    // `messages.10` the way the list itself is ordered
    sortingFn: "alphanumeric",
    cell: ({ getValue }) => <JSONTableKeyCell path={getValue<string>()} />,
  },
  {
    id: "value",
    header: "Value",
    // format up front so that sorting and display agree
    accessorFn: (entry) => formatFlatJSONValue(entry.value),
    // the accessor hands over strings, so the default comparison would order
    // token counts 10, 1024, 9; compare the digit runs as the numbers they are
    sortingFn: "alphanumeric",
    // the value column takes whatever the key column leaves, so there is only
    // one boundary to drag and it belongs to the key
    enableResizing: false,
    cell: ({ getValue }) => <JSONTableValueCell value={getValue<string>()} />,
  },
];

/**
 * Renders flattened JSON entries as a sortable two column table where every
 * key and value is individually copyable and the key column can be dragged
 * wider or narrower.
 *
 * Pair with `toFlatJSONEntries` and `filterFlatJSONEntries` to derive the
 * entries from a JSON value, or let `JSONViewProvider` do it.
 */
export function JSONTable({
  entries,
  emptyMessage = "No entries",
  areRowsExpanded = false,
}: {
  /** The flattened JSON entries to display, in the order they should appear */
  entries: FlatJSONEntry[];
  /** Message shown when there are no entries to display */
  emptyMessage?: string;
  /**
   * Whether a row wraps its text over as many lines as it needs, or is clipped
   * to a single line so the table can be scanned.
   * @default false
   */
  areRowsExpanded?: boolean;
}) {
  "use no memo";
  const [sorting, setSorting] = useState<SortingState>([]);

  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable<FlatJSONEntry>({
    columns,
    data: entries,
    state: { sorting },
    onSortingChange: setSorting,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <table
      css={jsonTableCSS}
      data-rows={areRowsExpanded ? "expanded" : "collapsed"}
    >
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableColumnHeader key={header.id} header={header} />
            ))}
          </tr>
        ))}
      </thead>
      {rows.length === 0 ? (
        <TableEmpty message={emptyMessage} />
      ) : (
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      )}
    </table>
  );
}
