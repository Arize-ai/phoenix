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
  min-height: 0;
`;

const cellCSS = css`
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

type RowPreviewTableProps = {
  columns: string[];
  rows: string[][] | Record<string, unknown>[];
};

type RowData = Record<string, string>;

// Hoisted outside component - createColumnHelper returns a stateless factory
const columnHelper = createColumnHelper<RowData>();

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function RowPreviewTable({ columns, rows }: RowPreviewTableProps) {
  "use no memo";
  const tableColumns = useMemo(
    () =>
      columns.map((col) =>
        columnHelper.accessor(col, {
          header: col,
          cell: (info) => info.getValue(),
        })
      ),
    [columns]
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
              {headerGroup.headers.map((header) => (
                <th key={header.id} css={cellCSS}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
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
