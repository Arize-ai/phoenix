import { css } from "@emotion/react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";

import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";

const containerCSS = css`
  max-height: 250px;
  overflow: auto;
  overscroll-behavior: none;
`;

const cellCSS = css`
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const highlightedHeaderCSS = css`
  background-color: var(--global-color-primary-100);
`;

type RowPreviewTableProps = {
  columns: string[];
  rows: string[][] | Record<string, unknown>[];
  highlightedColumn?: string | null;
};

type RowData = Record<string, string>;

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function RowPreviewTable({
  columns,
  rows,
  highlightedColumn,
}: RowPreviewTableProps) {
  "use no memo";
  const columnHelper = createColumnHelper<RowData>();

  const tableColumns = useMemo(
    () =>
      columns.map((col) =>
        columnHelper.accessor(col, {
          header: col,
          cell: (info) => info.getValue(),
        })
      ),
    [columns, columnHelper]
  );

  const tableData = useMemo<RowData[]>(() => {
    return rows.map((row) => {
      if (Array.isArray(row)) {
        // CSV data: string[][]
        const rowData: RowData = {};
        columns.forEach((col, index) => {
          rowData[col] = row[index] ?? "";
        });
        return rowData;
      } else {
        // JSONL data: Record<string, unknown>[]
        const rowData: RowData = {};
        columns.forEach((col) => {
          rowData[col] = formatCellValue(row[col]);
        });
        return rowData;
      }
    });
  }, [rows, columns]);

  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    columns: tableColumns,
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div css={containerCSS}>
      <table css={[tableCSS, borderedTableCSS]}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const isHighlighted =
                  highlightedColumn != null &&
                  header.column.id === highlightedColumn;
                return (
                  <th
                    key={header.id}
                    css={[cellCSS, isHighlighted && highlightedHeaderCSS]}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  css={cellCSS}
                  title={cell.getValue() as string | undefined}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
