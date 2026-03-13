import { css } from "@emotion/react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type CellContext,
} from "@tanstack/react-table";
import { useMemo } from "react";

import { Text } from "@phoenix/components";
import { Counter } from "@phoenix/components/core/counter";
import { CompactJSONCell } from "@phoenix/components/table";
import { borderedTableCSS, tableCSS } from "@phoenix/components/table/styles";
import { isPlainObject, safelyParseJSONString } from "@phoenix/utils/jsonUtils";

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

function PreviewCell(
  row: CellContext<DatasetPreviewRow, Record<string, unknown>>
) {
  const { getValue } = row;
  const value = getValue();
  const isEmpty = Object.keys(value).length === 0;
  return (
    <div css={contentCSS}>
      {isEmpty ? (
        <Text color="text-500">--</Text>
      ) : (
        <CompactJSONCell {...row} collapseSingleKey={false} />
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
  /** Whether collapsing is enabled */
  collapseKeys?: boolean;
  /** Keys that will be collapsed (their children promoted to top-level) */
  keysToCollapse?: string[];
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
  collapseKeys = false,
  keysToCollapse = [],
}: DatasetPreviewTableProps) {
  "use no memo";
  const keysToCollapseSet = useMemo(
    () => new Set(keysToCollapse),
    [keysToCollapse]
  );

  // Transform raw rows into dataset preview format
  const previewData = useMemo(() => {
    /**
     * Adds a value to the target bucket, handling collapse logic.
     * If the column is in keysToCollapse and the value is an object,
     * spread its children into the target instead of nesting under the column name.
     */
    const addToBucket = (
      bucket: Record<string, unknown>,
      col: string,
      value: unknown
    ) => {
      if (
        collapseKeys &&
        keysToCollapseSet.has(col) &&
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // Collapse: spread children into the bucket
        Object.assign(bucket, value);
      } else {
        // Normal: add under the column name
        bucket[col] = value;
      }
    };

    return rows.map((row): DatasetPreviewRow => {
      const input: Record<string, unknown> = {};
      const output: Record<string, unknown> = {};
      const metadata: Record<string, unknown> = {};

      if (Array.isArray(row)) {
        // CSV row - array of strings
        columns.forEach((col, idx) => {
          let value: unknown = row[idx] ?? "";
          // For CSV, try to parse JSON strings so they render as objects
          // instead of escaped JSON with backslashes
          if (typeof value === "string") {
            const parsed = safelyParseJSONString(value);
            if (isPlainObject(parsed)) {
              value = parsed;
            }
          }
          if (inputColumns.includes(col)) {
            addToBucket(input, col, value);
          }
          if (outputColumns.includes(col)) {
            addToBucket(output, col, value);
          }
          if (metadataColumns.includes(col)) {
            addToBucket(metadata, col, value);
          }
        });
      } else {
        // JSONL row - object
        for (const col of inputColumns) {
          if (col in row) {
            addToBucket(input, col, row[col]);
          }
        }
        for (const col of outputColumns) {
          if (col in row) {
            addToBucket(output, col, row[col]);
          }
        }
        for (const col of metadataColumns) {
          if (col in row) {
            addToBucket(metadata, col, row[col]);
          }
        }
      }

      return { input, output, metadata };
    });
  }, [
    rows,
    columns,
    inputColumns,
    outputColumns,
    metadataColumns,
    collapseKeys,
    keysToCollapseSet,
  ]);

  const tableColumns = useMemo(
    () => [
      columnHelper.accessor("input", {
        header: () => (
          <>
            Input <Counter>{inputColumns.length}</Counter>
          </>
        ),
        cell: (row) => <PreviewCell {...row} />,
      }),
      columnHelper.accessor("output", {
        header: () => (
          <>
            Output <Counter>{outputColumns.length}</Counter>
          </>
        ),
        cell: (row) => <PreviewCell {...row} />,
      }),
      columnHelper.accessor("metadata", {
        header: () => (
          <>
            Metadata <Counter>{metadataColumns.length}</Counter>
          </>
        ),
        cell: (row) => <PreviewCell {...row} />,
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
