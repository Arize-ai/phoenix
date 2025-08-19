import { useMemo } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { css } from "@emotion/react";

import { Text, View } from "@phoenix/components";

type TableRow = {
  id: string;
  example: string;
  input: string;
  referenceOutput: string;
  tokens: {
    black: number;
    blue: number;
    purple: number;
  };
  latency: {
    black: number;
    blue: number;
    purple: number;
  };
  cost: {
    black: number;
    blue: number;
    purple: number;
  };
};

const tableData: TableRow[] = [
  {
    id: "example-1",
    example: "RGFØYZ...",
    input:
      '{"messages" [{"role": "assistant", "content": "To print \\"Hello, World!\\" in JavaScript, you can..."}',
    referenceOutput:
      '{"messages" [{"role": "assistant", "content": "To print \\"Hello, World!\\" in JavaScript, you can..."}',
    tokens: { black: 401, blue: 238, purple: 1314 },
    latency: { black: 1.33, blue: 1.49, purple: 2.83 },
    cost: { black: 0.004, blue: 0.032, purple: 0.002 },
  },
];

export function ExperimentCompareListPage() {
  const columns: ColumnDef<TableRow>[] = useMemo(
    () => [
      {
        header: "Example",
        accessorKey: "example",
        cell: ({ getValue }) => <Text size="S">{getValue() as string}</Text>,
      },
      {
        header: "Input",
        accessorKey: "input",
        cell: ({ getValue }) => {
          const value = getValue() as string;
          return (
            <Text size="S" color="text-500">
              {value}
            </Text>
          );
        },
      },
      {
        header: "Reference Output",
        accessorKey: "referenceOutput",
        cell: ({ getValue }) => {
          const value = getValue() as string;
          return (
            <Text size="S" color="text-500">
              {value}
            </Text>
          );
        },
      },
      {
        header: () => (
          <div>
            <Text size="S" weight="heavy">
              Tokens
            </Text>
            <ul
              css={css`
                list-style: none;
                padding: 0;
                margin: 0;
                font-size: 12px;
                color: var(--ac-global-text-color-600);
                li::before {
                  content: "—";
                  margin-right: var(--ac-global-dimension-size-100);
                }
              `}
            >
              <li>AVG 401</li>
              <li>AVG 238 ↓</li>
              <li>AVG 1314 ↑</li>
            </ul>
          </div>
        ),
        accessorKey: "tokens",
        cell: ({ getValue }) => {
          const tokens = getValue() as TableRow["tokens"];
          return (
            <ul
              css={css`
                list-style: none;
                padding: 0;
                margin: 0;
                li::before {
                  content: "—";
                  margin-right: var(--ac-global-dimension-size-100);
                }
              `}
            >
              <li>
                <Text size="S">{tokens.black}</Text>
              </li>
              <li>
                <Text size="S">{tokens.blue}</Text>
                <span>↓</span>
              </li>
              <li>
                <Text size="S">{tokens.purple}</Text>
                <span>↑</span>
              </li>
            </ul>
          );
        },
      },
      {
        header: () => (
          <div>
            <Text size="S" weight="heavy">
              Latency
            </Text>
            <ul
              css={css`
                list-style: none;
                padding: 0;
                margin: 0;
                font-size: 12px;
                color: var(--ac-global-text-color-600);
                li::before {
                  content: "—";
                  margin-right: var(--ac-global-dimension-size-100);
                }
              `}
            >
              <li>AVG 1.33s</li>
              <li>AVG 1.49s ↑</li>
              <li>AVG 2.83s ↑</li>
            </ul>
          </div>
        ),
        accessorKey: "latency",
        cell: ({ getValue }) => {
          const latency = getValue() as TableRow["latency"];
          return (
            <ul
              css={css`
                list-style: none;
                padding: 0;
                margin: 0;
                li::before {
                  content: "—";
                  margin-right: var(--ac-global-dimension-size-100);
                }
              `}
            >
              <li>
                <Text size="S">{latency.black}</Text>
              </li>
              <li>
                <Text size="S">{latency.blue}</Text>
                <span>↑</span>
              </li>
              <li>
                <Text size="S">{latency.purple}</Text>
                <span>↑</span>
              </li>
            </ul>
          );
        },
      },
      {
        header: () => (
          <div>
            <Text size="S" weight="heavy">
              Cost
            </Text>
            <ul
              css={css`
                list-style: none;
                padding: 0;
                margin: 0;
                font-size: 12px;
                color: var(--ac-global-text-color-600);
                li::before {
                  content: "—";
                  margin-right: var(--ac-global-dimension-size-100);
                }
              `}
            >
              <li>AVG $0.004</li>
              <li>AVG $0.032 ↑</li>
              <li>AVG $0.002 ↓</li>
            </ul>
          </div>
        ),
        accessorKey: "cost",
        cell: ({ getValue }) => {
          const cost = getValue() as TableRow["cost"];
          return (
            <ul
              css={css`
                list-style: none;
                padding: 0;
                margin: 0;
                li::before {
                  content: "—";
                  margin-right: var(--ac-global-dimension-size-100);
                }
              `}
            >
              <li>
                <Text size="S">${cost.black}</Text>
              </li>
              <li>
                <Text size="S">${cost.blue}</Text>
                <span>↑</span>
              </li>
              <li>
                <Text size="S">${cost.purple}</Text>
                <span>↓</span>
              </li>
            </ul>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <View padding="size-200">
      <Text size="L" weight="heavy" marginBottom="size-200">
        Experiment Comparison Table
      </Text>
      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
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
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </View>
  );
}
