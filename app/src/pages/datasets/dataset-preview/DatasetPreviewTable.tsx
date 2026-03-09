import { css } from "@emotion/react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";

import { Text } from "@phoenix/components";
import { JSONText } from "@phoenix/components/code/JSONText";
import { Counter } from "@phoenix/components/core/counter";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";

const MAX_CELL_LENGTH = 200;

const containerCSS = css`
  min-height: 0;
`;

const headerColumnCSS = css`
  width: 33.33%;
`;

const dataColumnCSS = css`
  width: 33.33%;
  padding: 0 !important;
  vertical-align: top;
`;

const contentCSS = css`
  flex: none;
  padding: var(--global-dimension-size-200);
`;

const noAssignmentsCSS = css`
  padding: var(--global-dimension-size-300);
  text-align: center;
  color: var(--global-text-color-700);
`;

type DatasetPreviewRow = {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

// Hoisted outside component - createColumnHelper returns a stateless factory
const columnHelper = createColumnHelper<DatasetPreviewRow>();

function PreviewCell({ value }: { value: Record<string, unknown> }) {
  const isEmpty = Object.keys(value).length === 0;
  return (
    <div css={contentCSS}>
      {isEmpty ? (
        <Text color="text-500">--</Text>
      ) : (
        <JSONText json={value} maxLength={MAX_CELL_LENGTH} />
      )}
    </div>
  );
}

export type DatasetPreviewTableProps = {
  /** All column names from the file */
  columns: string[];
  /** Raw rows from the file (CSV: string[][], JSONL: Record<string, unknown>[]) */
  rows: string[][] | Record<string, unknown>[];
  /** Columns assigned to input */
  inputColumns: string[];
  /** Columns assigned to output */
  outputColumns: string[];
  /** Columns assigned to metadata */
  metadataColumns: string[];
};

/**
 * Preview table showing how data will look in the final dataset.
 * Each row shows input/output/metadata as JSON objects.
 */
export function DatasetPreviewTable({
  columns,
  rows,
  inputColumns,
  outputColumns,
  metadataColumns,
}: DatasetPreviewTableProps) {
  "use no memo";
  // Transform raw rows into dataset preview format
  const previewData = useMemo(() => {
    return rows.map((row): DatasetPreviewRow => {
      const input: Record<string, unknown> = {};
      const output: Record<string, unknown> = {};
      const metadata: Record<string, unknown> = {};

      if (Array.isArray(row)) {
        // CSV row - array of strings
        columns.forEach((col, idx) => {
          const value = row[idx] ?? "";
          if (inputColumns.includes(col)) {
            input[col] = value;
          }
          if (outputColumns.includes(col)) {
            output[col] = value;
          }
          if (metadataColumns.includes(col)) {
            metadata[col] = value;
          }
        });
      } else {
        // JSONL row - object
        for (const col of inputColumns) {
          if (col in row) {
            input[col] = row[col];
          }
        }
        for (const col of outputColumns) {
          if (col in row) {
            output[col] = row[col];
          }
        }
        for (const col of metadataColumns) {
          if (col in row) {
            metadata[col] = row[col];
          }
        }
      }

      return { input, output, metadata };
    });
  }, [rows, columns, inputColumns, outputColumns, metadataColumns]);

  const tableColumns = useMemo(
    () => [
      columnHelper.accessor("input", {
        header: () => (
          <>
            Input <Counter>{inputColumns.length}</Counter>
          </>
        ),
        cell: (info) => <PreviewCell value={info.getValue()} />,
      }),
      columnHelper.accessor("output", {
        header: () => (
          <>
            Output <Counter>{outputColumns.length}</Counter>
          </>
        ),
        cell: (info) => <PreviewCell value={info.getValue()} />,
      }),
      columnHelper.accessor("metadata", {
        header: () => (
          <>
            Metadata <Counter>{metadataColumns.length}</Counter>
          </>
        ),
        cell: (info) => <PreviewCell value={info.getValue()} />,
      }),
    ],
    [inputColumns.length, outputColumns.length, metadataColumns.length]
  );

  // eslint-disable-next-line react-hooks-js/incompatible-library
  const table = useReactTable({
    data: previewData,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const hasAnyAssignments =
    inputColumns.length > 0 ||
    outputColumns.length > 0 ||
    metadataColumns.length > 0;

  if (!hasAnyAssignments) {
    return (
      <div css={noAssignmentsCSS}>
        Assign columns below to preview the dataset structure
      </div>
    );
  }

  return (
    <div css={containerCSS}>
      <table css={[tableCSS, borderedTableCSS]}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} css={headerColumnCSS}>
                  {flexRender(
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
                <td key={cell.id} css={dataColumnCSS}>
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
