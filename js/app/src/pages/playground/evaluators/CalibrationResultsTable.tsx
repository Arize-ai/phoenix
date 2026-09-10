import { css } from "@emotion/react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import type { ReactNode } from "react";

import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
import { TableColumnHeader } from "@phoenix/components/table/TableColumnHeader";

const NO_ROWS: unknown[] = [];

/** Keep resize updates local to the table shell; the result cells arrive as
 * children and do not need to render again for each movement of the handle. */
export function CalibrationResultsTable({
  columns,
  children,
  isLoading,
}: {
  columns: ColumnDef<unknown>[];
  children: ReactNode;
  isLoading: boolean;
}) {
  // TanStack mutates its table objects, so the compiler cannot memoize readers.
  "use no memo";
  // eslint-disable-next-line react/incompatible-library
  const table = useReactTable({
    columns,
    data: NO_ROWS,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableSorting: false,
  });
  return (
    <table
      css={[tableCSS, borderedTableCSS, resultsTableCSS]}
      style={{ width: table.getTotalSize(), minWidth: "100%" }}
      aria-label="Evaluator comparison results"
      aria-busy={isLoading}
    >
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id}>
            {group.headers.map((header) => (
              <TableColumnHeader
                key={header.id}
                header={header}
                style={{ width: header.getSize() }}
              />
            ))}
          </tr>
        ))}
      </thead>
      {children}
    </table>
  );
}

const resultsTableCSS = css`
  table-layout: fixed;
  --global-table-cell-padding-y: var(--global-dimension-size-150);
  tbody tr > td {
    vertical-align: top;
  }
  // Evaluator cells stack a result over an expected-output band that runs
  // edge to edge, so the cell pads its own regions instead of the td — the
  // same arrangement as the experiment compare table's output cells.
  tbody tr > td.results-table__evaluator-cell,
  tbody tr > td.results-table__example-cell {
    padding: 0;
    height: 100%;
  }
  // The row's play button appears on hover, the way row actions do elsewhere,
  // with a short fade so it doesn't flicker as the pointer crosses rows. It
  // stays put while a control in the row has focus.
  .results-table__row-play {
    opacity: 0;
    transition: opacity 0.15s ease-in;
  }
  tbody tr:hover .results-table__row-play,
  tbody tr:focus-within .results-table__row-play {
    opacity: 1;
  }
`;
