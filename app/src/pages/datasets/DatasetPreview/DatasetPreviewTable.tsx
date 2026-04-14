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
import { safelyParseJSONObjectString } from "@phoenix/utils/jsonUtils";

const containerCSS = css`
  min-height: 0;
`;

const dataColumnCSS = css`
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
  exampleId: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  metadata: Record<string, unknown>;
  splits: string[];
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

/**
 * Parse a split column value into a string array.
 * Accepts a JSON array (e.g. '["train", "v1"]'), a plain string, or an actual array.
 */
export function parseSplitValue(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String);
  }
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }
  const trimmed = raw.trim();
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch {
    // not JSON
  }
  return [trimmed];
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
  /** Column containing split names */
  splitColumn?: string | null;
  /** Column containing example IDs */
  exampleIdColumn?: string | null;
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
  splitColumn,
  exampleIdColumn,
}: DatasetPreviewTableProps) {
  "use no memo";
  const keysToCollapseSet = useMemo(
    () => new Set(keysToCollapse),
    [keysToCollapse]
  );

  const hasSplitColumn = !!splitColumn;

  // Transform raw rows into dataset preview format
  const previewData = useMemo(() => {
    /**
     * Sets a value at a (possibly nested) dot-separated key path in an object.
     * e.g. setNestedValue(obj, "a.b", 1) → obj = { a: { b: 1 } }
     */
    const setNestedValue = (
      obj: Record<string, unknown>,
      key: string,
      value: unknown
    ) => {
      const parts = key.split(".");
      if (parts.length === 1) {
        obj[key] = value;
        return;
      }
      let current = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (
          !(part in current) ||
          typeof current[part] !== "object" ||
          current[part] === null
        ) {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }
      current[parts[parts.length - 1]] = value;
    };

    /**
     * Strips a bucket prefix from a column name if present.
     * e.g. getBucketKey("input.question", "input") → "question"
     */
    const getBucketKey = (col: string, bucketName: string): string => {
      const prefix = `${bucketName}.`;
      return col.toLowerCase().startsWith(prefix)
        ? col.slice(prefix.length)
        : col;
    };

    /**
     * Adds a value to the target bucket, unflattening dots in the key into
     * nested objects (e.g. "a.b" → { a: { b: value } }).
     *
     * Also handles collapse logic: if the key is in keysToCollapse and the
     * value is an object, its children are spread directly into the bucket.
     */
    const addToBucket = (
      bucket: Record<string, unknown>,
      key: string,
      value: unknown
    ) => {
      if (
        collapseKeys &&
        keysToCollapseSet.has(key) &&
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // Collapse: spread children into the bucket
        Object.assign(bucket, value);
      } else {
        setNestedValue(bucket, key, value);
      }
    };

    return rows.map((row): DatasetPreviewRow => {
      const input: Record<string, unknown> = {};
      const output: Record<string, unknown> = {};
      const metadata: Record<string, unknown> = {};
      let splits: string[] = [];
      let exampleId: string | null = null;

      if (Array.isArray(row)) {
        // CSV row - array of strings
        columns.forEach((col, idx) => {
          let value: unknown = row[idx] ?? "";
          // For CSV, try to parse JSON strings so they render as objects
          // instead of escaped JSON with backslashes
          if (typeof value === "string") {
            const parsed = safelyParseJSONObjectString(value);
            if (parsed !== undefined) {
              value = parsed;
            }
          }
          if (splitColumn && col === splitColumn) {
            splits = parseSplitValue(row[idx]);
          }
          if (exampleIdColumn && col === exampleIdColumn) {
            const raw = row[idx];
            exampleId = raw ? String(raw) : null;
          }
          if (inputColumns.includes(col)) {
            addToBucket(input, getBucketKey(col, "input"), value);
          }
          if (outputColumns.includes(col)) {
            addToBucket(output, getBucketKey(col, "output"), value);
          }
          if (metadataColumns.includes(col)) {
            addToBucket(metadata, getBucketKey(col, "metadata"), value);
          }
        });
      } else {
        // JSONL row - object
        if (splitColumn && splitColumn in row) {
          splits = parseSplitValue(row[splitColumn]);
        }
        if (exampleIdColumn && exampleIdColumn in row) {
          const raw = row[exampleIdColumn];
          exampleId = raw != null ? String(raw) : null;
        }
        for (const col of inputColumns) {
          if (col in row) {
            addToBucket(input, getBucketKey(col, "input"), row[col]);
          }
        }
        for (const col of outputColumns) {
          if (col in row) {
            addToBucket(output, getBucketKey(col, "output"), row[col]);
          }
        }
        for (const col of metadataColumns) {
          if (col in row) {
            addToBucket(metadata, getBucketKey(col, "metadata"), row[col]);
          }
        }
      }

      return { exampleId, input, output, metadata, splits };
    });
  }, [
    rows,
    columns,
    inputColumns,
    outputColumns,
    metadataColumns,
    collapseKeys,
    keysToCollapseSet,
    splitColumn,
    exampleIdColumn,
  ]);

  const tableColumns = useMemo(() => {
    const hasExampleId = previewData.some((row) => row.exampleId != null);
    return [
      ...(hasExampleId
        ? [
            columnHelper.accessor("exampleId", {
              id: "exampleId",
              header: () => <>Example ID</>,
              cell: ({ getValue }) => {
                const value = getValue();
                return (
                  <div css={contentCSS}>
                    {value == null ? (
                      <Text color="text-500">--</Text>
                    ) : (
                      <Text>{value}</Text>
                    )}
                  </div>
                );
              },
            }),
          ]
        : []),
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
      ...(hasSplitColumn
        ? [
            columnHelper.display({
              id: "splits",
              header: () => <>Splits</>,
              cell: ({ row }) => {
                const splits = row.original.splits;
                if (splits.length === 0) {
                  return (
                    <div css={contentCSS}>
                      <Text color="text-500">--</Text>
                    </div>
                  );
                }
                return (
                  <div css={contentCSS}>
                    <Text>{JSON.stringify(splits)}</Text>
                  </div>
                );
              },
            }),
          ]
        : []),
    ];
  }, [
    inputColumns.length,
    outputColumns.length,
    metadataColumns.length,
    hasSplitColumn,
    previewData,
  ]);

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
                <th key={header.id}>
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
